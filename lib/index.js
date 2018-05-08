import _Object$defineProperties from 'babel-runtime/core-js/object/define-properties';
import _assign from 'lodash/assign';

import Raw from './raw';
import { warn } from './helpers';
import Client from './client';

import makeKnex from './util/make-knex';
import parseConnection from './util/parse-connection';

// The client names we'll allow in the `{name: lib}` pairing.
var aliases = {
  'mariadb': 'maria',
  'mariasql': 'maria',
  'pg': 'postgres',
  'postgresql': 'postgres',
  'sqlite': 'sqlite3'
};

export default function Knex(config) {
  if (typeof config === 'string') {
    return new Knex(_assign(parseConnection(config), arguments[2]));
  }
  var Dialect = void 0;
  if (arguments.length === 0 || !config.client && !config.dialect) {
    Dialect = Client;
  } else if (typeof config.client === 'function' && config.client.prototype instanceof Client) {
    Dialect = config.client;
  } else {
    var clientName = config.client || config.dialect;
    Dialect = require('./dialects/' + (aliases[clientName] || clientName) + '/index.js');
  }
  if (typeof config.connection === 'string') {
    config = _assign({}, config, { connection: parseConnection(config.connection).connection });
  }
  return makeKnex(new Dialect(config));
}

// Expose Client on the main Knex namespace.
Knex.Client = Client;

_Object$defineProperties(Knex, {
  VERSION: {
    get: function get() {
      warn('Knex.VERSION is deprecated, you can get the module version' + "by running require('knex/package').version");
      return '0.12.6';
    }
  },
  Promise: {
    get: function get() {
      warn('Knex.Promise is deprecated, either require bluebird or use the global Promise');
      return require('bluebird');
    }
  }
});

// Run a "raw" query, though we can't do anything with it other than put
// it in a query statement.
Knex.raw = function (sql, bindings) {
  warn('global Knex.raw is deprecated, use knex.raw (chain off an initialized knex object)');
  return new Raw().set(sql, bindings);
};

// Doing this ensures Browserify works. Still need to figure out
// the best way to do some of this.
if (process.browser) {
  require('./dialects/websql/index.js');
}
module.exports = exports['default'];