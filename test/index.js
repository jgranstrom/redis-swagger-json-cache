const chai = require('chai');
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
global.expect = chai.expect;
chai.use(sinonChai);