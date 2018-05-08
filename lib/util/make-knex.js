import _Object$defineProperties from 'babel-runtime/core-js/object/define-properties';
import _assign from 'lodash/assign';

import { EventEmitter } from 'events';

import Migrator from '../migrate';
import Seeder from '../seed';
import FunctionHelper from '../functionhelper';
import QueryInterface from '../query/methods';
import * as helpers from '../helpers';

import _batchInsert from './batchInsert';

export default function makeKnex(client) {

  // The object we're potentially using to kick off an initial chain.
  function knex(tableName, options) {
    var qb = knex.queryBuilder();
    if (!tableName) helpers.warn('calling knex without a tableName is deprecated. Use knex.queryBuilder() instead.');
    return tableName ? qb.table(tableName, options) : qb;
  }

  _assign(knex, {

    Promise: require('bluebird'),

    // A new query builder instance.
    queryBuilder: function queryBuilder() {
      return client.queryBuilder();
    },
    raw: function raw() {
      return client.raw.apply(client, arguments);
    },
    batchInsert: function batchInsert(table, batch) {
      var chunkSize = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1000;

      return _batchInsert(this, table, batch, chunkSize);
    },


    // Runs a new transaction, taking a container and returning a promise
    // for when the transaction is resolved.
    transaction: function transaction(container, config) {
      return client.transaction(container, config);
    },


    // Typically never needed, initializes the pool for a knex client.
    initialize: function initialize(config) {
      return client.initialize(config);
    },


    // Convenience method for tearing down the pool.
    destroy: function destroy(callback) {
      return client.destroy(callback);
    }
  });

  // Hook up the "knex" object as an EventEmitter.
  var ee = new EventEmitter();
  for (var key in ee) {
    knex[key] = ee[key];
  }

  // Allow chaining methods from the root object, before
  // any other information is specified.
  QueryInterface.forEach(function (method) {
    knex[method] = function () {
      var builder = knex.queryBuilder();
      return builder[method].apply(builder, arguments);
    };
  });

  knex.client = client;

  var VERSION = '0.12.6';

  _Object$defineProperties(knex, {

    __knex__: {
      get: function get() {
        helpers.warn('knex.__knex__ is deprecated, you can get the module version' + "by running require('knex/package').version");
        return VERSION;
      }
    },

    VERSION: {
      get: function get() {
        helpers.warn('knex.VERSION is deprecated, you can get the module version' + "by running require('knex/package').version");
        return VERSION;
      }
    },

    schema: {
      get: function get() {
        return client.schemaBuilder();
      }
    },

    migrate: {
      get: function get() {
        return new Migrator(knex);
      }
    },

    seed: {
      get: function get() {
        return new Seeder(knex);
      }
    },

    fn: {
      get: function get() {
        return new FunctionHelper(client);
      }
    }

  });

  // Passthrough all "start" and "query" events to the knex object.
  client.on('start', function (obj) {
    knex.emit('start', obj);
  });
  client.on('query', function (obj) {
    knex.emit('query', obj);
  });
  client.on('query-error', function (err, obj) {
    knex.emit('query-error', err, obj);
  });
  client.on('query-response', function (response, obj, builder) {
    knex.emit('query-response', response, obj, builder);
  });

  client.makeKnex = makeKnex;

  return knex;
}
module.exports = exports['default'];