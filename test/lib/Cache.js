'use strict';
const Cache = require('../../lib/Cache');
const Promise = require('bluebird');
const sinon = require('sinon');

class MockCacheProvider {
  constructor() {
    this._cache = {};
  }

  getAsync(key) {
    return Promise.resolve(this._cache[key] && this._cache[key].value);
  }

  setAsync(key, value, ttl) {
    this._cache[key] = { ttl, value };
    return Promise.resolve();
  }
}

class BadMockCacheProvider {
  constructor() {
    this._cache = {};
  }

  getAsync(key) {
    return Promise.reject();
  }

  setAsync(key, value, ttl) {
    return Promise.reject();
  }
}

const MockHelpers = {
  a: {
    b: 123
  },
}

describe('Cache', () => {
  let cache = null;
  let badCache = null;

  beforeEach(() => {
    cache = new Cache({
      CacheProvider: MockCacheProvider,
      config: {},
      globalOptions: { name: 'test' },
      requestHelper: (helper) => MockHelpers[helper],
    });

    badCache = new Cache({
      CacheProvider: BadMockCacheProvider,
      config: {},
      globalOptions: { name: 'test' },
      requestHelper: (helper) => MockHelpers[helper],
    });
  });

  describe('getHelperFn', () => {
    it('should return the provided default requestHelper', () => {
      sinon.spy(cache, 'requestHelper');
      const providedDefault = 123;
      const result = cache.getHelperFn(null, providedDefault);
      expect(result).to.equal(providedDefault);
      expect(cache.requestHelper).not.to.be.called;
    });

    it('should return the mock helper', () => {
      sinon.spy(cache, 'requestHelper');
      const result = cache.getHelperFn({ helper: 'a', function: 'b' });
      expect(result).to.equal(MockHelpers.a.b);
      expect(cache.requestHelper).to.be.calledOnce;
    });
  });

  describe('propagateResponse', () => {
    it('should call ttlFn to get ttl', () => {
      sinon.spy(cache, 'ttlFn');
      cache.propagateResponse();
      expect(cache.ttlFn).to.be.calledOnce;
    });

    it('should call cache.setAsync with appropriate arguments', () => {
      sinon.spy(cache.cache, 'setAsync');
      const key = 'key';
      const data = 'data';
      const ttl = 5;
      cache.propagateResponse('key', data);
      expect(cache.cache.setAsync).to.be.calledOnce;
      expect(cache.cache.setAsync).to.be.calledWith(key, { body: data }, ttl);
    });

    it('should let cache errors fall through', (done) => {
      sinon.spy(badCache.cache, 'setAsync');
      const promise = badCache.propagateResponse();
      const thenFn = sinon.stub();
      const catchFn = sinon.stub();
      promise.then(thenFn);
      promise.catch(catchFn);
      promise.finally(() => {
        expect(thenFn).to.be.calledOnce;
        expect(catchFn).not.to.be.called;
      })
      .then(() => done())
      .catch((err) => done(err));
    });
  });

  describe('handleCacheHit', () => {
    it('should res.json with cached body', () => {
      const res = {
        json: sinon.spy(),
      };

      cache.handleCacheHit(null, { body: 123 }, null, res);
      expect(res.json).to.be.calledOnce;
      expect(res.json).to.be.calledWith(123);
    });
  });

  describe('handleCacheMiss', () => {
    it('should patch and proxy res.json', () => {
      const originalJson = sinon.spy();
      const res = {
        json: originalJson,
      };

      cache.handleCacheMiss(null, null, null, res);
      expect(res._actualJson).to.equal(originalJson);
      expect(res.json).not.to.equal(originalJson);

      res.json(123);
      expect(originalJson).to.be.calledOnce;
      expect(originalJson).to.be.calledWith(123);
    });

    it('should propagate successful response', () => {
      const res = {
        statusCode: 200,
        json: (data) => data,
      };

      const key = 'a';
      const data = 123;
      const req = {};
      const pathOptions = {};

      cache.propagateResponse = sinon.spy();
      cache.handleCacheMiss(key, pathOptions, req, res);

      res.json(data);
      expect(cache.propagateResponse).to.be.calledOnce;
      expect(cache.propagateResponse).to.be.calledWith(key, data, req, pathOptions);
    });

    it('should not propagate failed response', () => {
      const res = {
        statusCode: 404,
        json: (data) => data,
      };

      cache.propagateResponse = sinon.spy();
      cache.handleCacheMiss(null, null, null, res);

      res.json();
      expect(cache.propagateResponse).not.to.be.called;
    });
  });

  describe('handleCachedPath', () => {
    it('should call keyFn to get key', () => {
      const req = {};
      const res = {};
      const pathOptions = {};
      const next = () => {};
      sinon.spy(cache, 'keyFn');
      cache.handleCachedPath(req, res, pathOptions, next);

      expect(cache.keyFn).to.be.calledOnce;
      expect(cache.keyFn).to.be.calledWith(req, cache.globalOptions, pathOptions);
    });

    it('should call cache.getAsync with expected the cache key', () => {
      const req = {
        originalUrl: 'test',
      };
      const res = {};
      const pathOptions = {};
      const next = () => {};
      const expectedKey = `${cache.globalOptions.name}:${req.originalUrl}`;
      sinon.spy(cache.cache, 'getAsync');
      cache.handleCachedPath(req, res, pathOptions, next);

      expect(cache.cache.getAsync).to.be.calledOnce;
      expect(cache.cache.getAsync).to.be.calledWith(expectedKey);
    });

    it('should call handleCacheMiss and next if key not in cache', (done) => {
      const req = {
        originalUrl: 'test',
      };
      const res = {};
      const pathOptions = {};
      const next = sinon.spy();
      const expectedKey = `${cache.globalOptions.name}:${req.originalUrl}`;
      sinon.spy(cache, 'handleCacheHit');
      sinon.spy(cache, 'handleCacheMiss');
      cache.handleCachedPath(req, res, pathOptions, next)
      .then(() => {
        expect(next).to.be.calledOnce;
        expect(cache.handleCacheMiss).to.be.calledOnce;
        expect(cache.handleCacheMiss).to.be.calledWith(expectedKey, pathOptions, req, res);
        expect(cache.handleCacheHit).not.to.be.called;
      })
      .then(() => done())
      .catch((err) => done(err));
    });

    it('should call handleCacheHit and res.json with cache body, and not next()', (done) => {
      const req = {
        originalUrl: 'test',
      };
      const res = {
        json: sinon.spy(),
      };
      const pathOptions = {};
      const next = sinon.spy();
      const expectedKey = `${cache.globalOptions.name}:${req.originalUrl}`;
      sinon.spy(cache, 'handleCacheHit');
      sinon.spy(cache, 'handleCacheMiss');

      const cachedData = { value: { body: 123 } };

      cache.cache._cache[expectedKey] = cachedData;
      cache.handleCachedPath(req, res, pathOptions, next)
      .then(() => {
        expect(cache.handleCacheHit).to.be.calledOnce;
        expect(cache.handleCacheHit).to.be.calledWith(expectedKey, cachedData.value, req, res);

        expect(next).not.to.be.called;
        expect(res.json).to.be.calledOnce;
        expect(res.json).to.be.calledWith(cachedData.value.body);

        expect(cache.handleCacheMiss).not.to.be.called;
      })
      .then(() => done())
      .catch((err) => done(err));
    });

    it('should let cache errors fall through', (done) => {
      const req = {};
      const res = {};
      const pathOptions = {};
      const next = sinon.spy();

      const promise = badCache.handleCachedPath(req, res, pathOptions, next);
      const thenFn = sinon.stub();
      const catchFn = sinon.stub();
      promise.then(thenFn);
      promise.catch(catchFn);
      promise.finally(() => {
        expect(thenFn).to.be.calledOnce;
        expect(catchFn).not.to.be.called;
        expect(next).to.be.calledOnce;
      })
      .then(() => done())
      .catch((err) => done(err));
    });
  });

  describe('middleware', () => {
    it('should not handle not enabled paths', () => {
      const req = {
        swagger: { path: {} },
      };
      const res = {};
      const next = sinon.spy();

      sinon.spy(cache, 'handleCachedPath');
      cache.middleware(req, res, next);

      expect(next).to.be.calledOnce;
      expect(cache.handleCachedPath).not.to.be.called;
    });

    it('should not handle non-GET requests', () => {
      const req = {
        swagger: { path: {} },
      };
      req.swagger.path[Cache.CONFIG_KEY] = { enabled: true };
      const res = {};
      const next = sinon.spy();

      sinon.spy(cache, 'handleCachedPath');
      cache.middleware(req, res, next);

      expect(next).to.be.calledOnce;
      expect(cache.handleCachedPath).not.to.be.called;
    });

    it('should handle enabled GET requests', () => {
      const req = {
        swagger: { path: {} },
        method: 'GET',
      };

      const pathOptions = { enabled: true };
      req.swagger.path[Cache.CONFIG_KEY] = pathOptions;
      const res = {};
      const next = sinon.spy();

      sinon.spy(cache, 'handleCachedPath');
      cache.middleware(req, res, next);

      expect(cache.handleCachedPath).to.be.calledOnce;
      expect(cache.handleCachedPath).to.be.calledWith(req, res, pathOptions, next);
      expect(next).not.to.be.called;
    });
  });
})