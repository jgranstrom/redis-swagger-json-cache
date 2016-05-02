'use strict';
/**
 * Provide cache middleware for swagger express API
 */
const debug = require('debug')('redis-swagger-json-cache');
const CachemanRedis = require('cacheman-redis');
const Promise = require('bluebird');
const DEFAULTS = require('./defaults');

module.exports = exports = class Cache {

  /**
   * Swagger config key for swagger spec
   */
  static get CONFIG_KEY() { return 'x-redis-swagger-json-cache'; }

  /**
   * Create a new Cache
   */
  constructor(options) {
    debug('Creating cache');
    this.globalOptions = options.globalOptions;
    this.requestHelper = options.requestHelper;

    this.initCache(options.config.redis);
    this.initHelpers();
  }

  /**
   * Initialize the redis cache
   */
  initCache(redisConfig) {
    debug('Initiating cache');
    this.cache = new CachemanRedis(redisConfig);
    Promise.promisifyAll(this.cache);
  }

  /**
   * Initialize the helper functions for key and ttl
   */
  initHelpers() {
    debug('Initiating helpers');
    this.keyFn = this.getHelperFn(this.globalOptions.key, DEFAULTS.DEFAULT_KEY_FN);
    this.ttlFn = this.getHelperFn(this.globalOptions.ttl, DEFAULTS.DEFAULT_TTL_FN);
  }

  /**
   * Get a externally providede helper function
   */
  getHelperFn(option, defaultHelper) {
    debug('Getting helper', option);
    if(option && option.helper && option.function) {
      return this.requestHelper(option.helper)[option.function];
    } else {
      return defaultHelper;
    }
  }

  /**
   * Propagate a request response to the cache
   */
  propagateResponse(cacheKey, obj, req, pathOptions) {
    // Determine ttl for response cache
    const cacheTtl = this.ttlFn(req, this.globalOptions, pathOptions);
    debug('propagate response to cache', cacheKey, cacheTtl);
        
    // Set cache data and fall through any error
    this.cache.setAsync(cacheKey, { body: obj }, cacheTtl)
    .catch((error) => {
      // Log and fall through cache set errors
      debug('write error', error, cacheKey);
      console.error("redis-swagger-json-cache error", error);
    })
  }

  /**
   * Handle a cache hit, respond with cached data
   */
  handleCacheHit(cacheKey, cachedResult, req, res) {
    debug('cache-hit', cacheKey);
    res.json(cachedResult.body);
  }

  /**
   * Handle a cache miss,
   * Path response to intercept data to be cached
   */
  handleCacheMiss(cacheKey, pathOptions, req, res) {
    debug('cache-miss', cacheKey);

    res._actualJson = res.json;
    res.json = (obj) => {
      if(res.statusCode === 200) {
        this.propagateResponse(cacheKey, obj, req, pathOptions);
      } else {
        debug('cache-skip status !== 200', cacheKey);
      }

      res._actualJson(obj);
    }
  }

  /**
   * Handle a cached path request,
   * Try getting cached value and handle hits and misses
   * Fall through any errors in cache
   */
  handleCachedPath(req, res, pathOptions, next) {
    // Get cache key for request
    const cacheKey = this.keyFn(req, this.globalOptions, pathOptions);

    // Try to get cached entry
    this.cache.getAsync(cacheKey)
    .then((cachedResult) => {
      if(cachedResult) {
        this.handleCacheHit(cacheKey, cachedResult, req, res);
      } else {
        this.handleCacheMiss(cacheKey, pathOptions, req, res);
        // Let chain complete
        next();
      }
    })
    .catch((error) => {
      debug('get error', error, cacheKey);
      console.error("redis-swagger-json-cache error", error);
      next();
    });
  }

  /**
   * Middleware function to be called by express to inject cache
   */
  middleware(req, res, next) {
    debug('Passing middleware');
    
    const pathOptions = req.swagger.path[Cache.CONFIG_KEY];

    // Determine if path is cached for request
    if(req.method === 'GET' && this.globalOptions && pathOptions && pathOptions.enabled) {
      debug('cache-enabled', req.swagger.path)
      this.handleCachedPath(req, res, pathOptions, next);
    } else {
      // Cache disabled for route or API
      debug('cache-disabled', req.swagger.path);
      next();
    }
  }
}