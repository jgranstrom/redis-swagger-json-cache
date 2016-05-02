[![Build Status](https://travis-ci.org/jgranstrom/redis-swagger-json-cache.svg?branch=master)](https://travis-ci.org/jgranstrom/redis-swagger-json-cache)
[![Coverage Status](https://coveralls.io/repos/jgranstrom/redis-swagger-json-cache/badge.svg?branch=master)](https://coveralls.io/r/jgranstrom/redis-swagger-json-cache?branch=master)

# redis-swagger-json-cache

Simple drop in redis cache for swagger JSON apis using express.

## Setup

1. `npm install redis-swagger-json-cache`

2.
Include `node_modules` in `fittingsDirs` array of your swagger configuration.
`fittingsDirs: [ api/fittings, 'node_modules' ]`

3.
Include `x-redis-swagger-json-cache` top level configuration in your swagger spec:

  ```
  x-redis-swagger-json-cache:
    name: 'my-api'
  ```

4.
Include `x-redis-swagger-json-cache` path specific configuration in your swagger spec to enable cache for path:

  ```
  paths:
    "/my-json-path":
      x-redis-swagger-json-cache:
        enabled: true
      get:
        ...
  ```
  
Good to go.

## Requirements
- Swagger
- Express
- Redis

## Configure redis
By default it will try to use a localhost redis. To configure add a redis configuration in your swagger configuration file
 
```
redis:
  host: 'redis'
```
  
or:
  
```
redis:
  connectionString: 'redis://127.0.0.1:6379'
```

## TTL
Time to live is calculated on demand in a cache miss so that you can do something more fancy then a set amount of time. 

To use a custom TTL create a helper file in your swagger helpers directory.

```
// in helpers/your-helper-file.js
exports.ttl = (req, redisCacheGlobalOptions, redisCachePathOptions) => {
  return redisCachePathOptions.ttl;
}
```

In this example include a ttl option in your path configuration.

```
paths:
  "/my-json-path":
    x-redis-swagger-json-cache:
      enabled: true
      ttl: 100
    get:
      ...
```

Tell the cache to use your helper

```
x-redis-swagger-json-cache:
  name: 'my-api'
  ttl:
    helper: your-helper-file
    function: ttl
```

You can do whatever fancy TTL logic needed, however it must be synchronous at this point.

### Build in TTL functions

#### untilNextMinute

Cache a new request until the next minute.

```
const TTL = require('redis-swagger-json-cache/TTL');
exports.ttl = TTL.untilNextMinute;
```

#### untilNextDay

Cache a new request until the next day, i.e. invalidate cached entry at midnight.

```
const TTL = require('redis-swagger-json-cache/TTL');
exports.ttl = TTL.untilNextDay;
```

You can also specify a timezone that will determine when midnight is. This is done in the top-level configuration of the cache.

```
x-redis-swagger-json-cache:
  name: 'my-api'
  ttl:
    helper: redis-swagger-json-cache
    function: ttl
  timezone: 'Europe/Stockholm'
```

## Key
The cache key for a response is determined calculated on demand in a cache miss so that you can base the keys on information about the request. 

To use a custom cache key you use the same method as in TTL.

```
x-redis-swagger-json-cache:
  name: 'my-api'
  key:
    helper: your-helper-file
    function: key
```

```
// in helpers/your-helper-file.js
exports.key = (req, redisCacheGlobalOptions, redisCachePathOptions) => {
  return `my-special-prefix:${req.originalUrl}`;
}
```

The default cache key is sufficient for most operations.

## Important notes
- Only supports JSON responses
- Only GET requests are cached
- Simple in nature, will not do fancy things with headers and redirects at this point
- Default TTL is 5 seconds
- Default cache key is name:full-url (includes query parameters)
- Errors will not be cached
- Errors on cache hits or misses will fall through to regular request, but will be logged
- Include debug, use `DEBUG=redis-swagger-json-cache*` to get debug information
- Will fail at startup if redis is not available

## TODO
- Implicit cache invalidation (PUT/POST/DELETE)
