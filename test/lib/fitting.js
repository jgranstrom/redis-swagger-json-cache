'use strict';
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const Cache = require('../../lib/Cache');

const CacheStub = sinon.stub();

const fitting = proxyquire('../../lib/fitting', { './Cache': CacheStub });

describe('fitting', () => {
  beforeEach(() => {
    CacheStub.reset();
  });

  const someConfig = { 
    swagger: {
      appRoot: '/'
    }
  }

  const globalOptions = { a: 3 };

  const fittingDef = {
    helpers: 'some-helper-dir',
  }

  const bagpipes = {
    config: {
      swaggerNodeRunner: {
        config: someConfig,
        swagger: {},
      }
    }
  }

  bagpipes.config.swaggerNodeRunner.swagger[Cache.CONFIG_KEY] = globalOptions;

  it('should create a cache with swagger provided configurations', () => {
    fitting(fittingDef, bagpipes);
    expect(CacheStub).to.be.calledOnce;
    const providedOptions = CacheStub.args[0][0];
    
    expect(providedOptions).to.exist;
    expect(providedOptions.config).to.equal(someConfig);
    expect(providedOptions.globalOptions).to.equal(globalOptions);
    expect(providedOptions.requestHelper).to.exist;
    expect(providedOptions.CacheProvider).to.exist;
  })
})

