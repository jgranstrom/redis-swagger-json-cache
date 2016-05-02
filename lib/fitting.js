'use strict';
/**
 * Swagger fitting for express redis cache
 */
const path = require('path');
const Cache = require('./Cache');
const CachemanRedis = require('cacheman-redis');

module.exports = function create(fittingDef, bagpipes) {
  // Get configurations from swagger
  const swaggerNodeRunner = bagpipes.config.swaggerNodeRunner;
  const config = swaggerNodeRunner.config;
  const appRoot = swaggerNodeRunner.config.swagger.appRoot;
  const redisCacheGlobalOptions = swaggerNodeRunner.swagger[Cache.CONFIG_KEY];

  // Helper file resolver  
  const helpersDir = path.resolve(appRoot, fittingDef.helpers || 'api/helpers');
  const requestHelperFn = (helper) => require(path.join(helpersDir, helper));

  // Create a cache
  const cache = new Cache({
    config,
    CacheProvider: CachemanRedis,
    globalOptions: redisCacheGlobalOptions,
    requestHelper: requestHelperFn,
  });

  // Return the middleware connector for cache
  return (context, cb) => cache.middleware(context.request, context.response, cb);
};
