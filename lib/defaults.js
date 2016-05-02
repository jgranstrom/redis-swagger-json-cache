'use strict';
/**
 * Provide default functions
 */
exports.DEFAULT_KEY_FN = (req, redisCacheGlobalOptions) => {
  return `${redisCacheGlobalOptions.name}:${req.originalUrl}`;
};

exports.DEFAULT_TTL_FN = () => 5;