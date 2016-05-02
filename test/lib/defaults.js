'use strict';
const DEFAULTS = require('../../lib/defaults');

describe('defaults', () => {
  describe('DEFAULT_KEY_FN', () => {
    it('should return appropriate default key', () => {
      const key = DEFAULTS.DEFAULT_KEY_FN({ originalUrl: 'abcdef' }, { name: '123' });
      expect(key).to.equal('123:abcdef');
    })
  });

  describe('DEFAULT_TTL_FN', () => {
    it('should return the default TTL seconds', () => {
      const ttl = DEFAULTS.DEFAULT_TTL_FN();
      expect(ttl).to.equal(5);
    });
  })
});