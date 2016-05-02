/**
 * Provide some built in TTL functions
 */
'use strict';
const debug = require('debug')('redis-swagger-json-cache:TTL');
const moment = require('moment');
require('moment-timezone');

/**
 * Return seconds until next minute in time
 */
exports.untilNextMinute = (req, redisCacheGlobalOptions, redisCachePathOptions) => {
  const now = moment();
  const secondsTilNextMinute = 60 - now.seconds();
  debug('seconds til next minute', secondsTilNextMinute);
  return secondsTilNextMinute;
}

/**
 * Return seconds until midnight, use timezone in global options if provided
 */
exports.untilNextDay = (req, redisCacheGlobalOptions, redisCachePathOptions) => {
  let now = moment();

  if(redisCacheGlobalOptions.timezone) {
    now = moment(now).tz(redisCacheGlobalOptions.timezone);
  }

  const nextDay = moment(now).add(1, 'day');
  nextDay.seconds(0);
  nextDay.minutes(0);
  nextDay.hours(0);
  
  const secondsTilNextDay = nextDay.diff(now, 'seconds');
  debug('seconds til next day', secondsTilNextDay);
  return secondsTilNextDay;
}