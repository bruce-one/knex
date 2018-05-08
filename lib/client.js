import _Object$assign from 'babel-runtime/core-js/object/assign';
import _defaults from 'lodash/defaults';
import _cloneDeep from 'lodash/cloneDeep';
import _uniqueId from 'lodash/uniqueId';
import _assign from 'lodash/assign';
import Promise from 'bluebird';
import * as helpers from './helpers';

import Raw from './raw';
import Runner from './runner';
import Formatter from './formatter';
import Transaction from './transaction';

import QueryBuilder from './query/builder';
import QueryCompiler from './query/compiler';

import SchemaBuilder from './schema/builder';
import SchemaCompiler from './schema/compiler';
import TableBuilder from './schema/tablebuilder';
import TableCompiler from './schema/tablecompiler';
import ColumnBuilder from './schema/columnbuilder';
import ColumnCompiler from './schema/columncompiler';

import { Pool, TimeoutError } from 'tarn';
import inherits from 'inherits';
import { EventEmitter } from 'events';

import { makeEscape } from './query/string';


var debug = require('debug')('knex:client');
var debugQuery = require('debug')('knex:query');
var debugBindings = require('debug')('knex:bindings');

// The base client provides the general structure
// for a dialect specific client object.
function Client() {
  var config = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

  this.config = config;

  //Client is a required field, so throw error if it's not supplied.
  //If 'this.dialect' is set, then this is a 'super()' call, in which case
  //'client' does not have to be set as it's already assigned on the client prototype.
  if (!this.config.client && !this.dialect) {
    throw new Error('knex: Required configuration option \'client\' is missing.');
  }

  this.connectionSettings = _cloneDeep(config.connection || {});
  if (this.driverName && config.connection) {
    this.initializeDriver();
    if (!config.pool || config.pool && config.pool.max !== 0) {
      this.initializePool(config);
    }
  }
  this.valueForUndefined = this.raw('DEFAULT');
  if (config.useNullAsDefault) {
    this.valueForUndefined = null;
  }
}
inherits(Client, EventEmitter);

_assign(Client.prototype, {
  formatter: function formatter(builder) {
    return new Formatter(this, builder);
  },
  queryBuilder: function queryBuilder() {
    return new QueryBuilder(this);
  },
  queryCompiler: function queryCompiler(builder) {
    return new QueryCompiler(this, builder);
  },
  schemaBuilder: function schemaBuilder() {
    return new SchemaBuilder(this);
  },
  schemaCompiler: function schemaCompiler(builder) {
    return new SchemaCompiler(this, builder);
  },
  tableBuilder: function tableBuilder(type, tableName, fn) {
    return new TableBuilder(this, type, tableName, fn);
  },
  tableCompiler: function tableCompiler(tableBuilder) {
    return new TableCompiler(this, tableBuilder);
  },
  columnBuilder: function columnBuilder(tableBuilder, type, args) {
    return new ColumnBuilder(this, tableBuilder, type, args);
  },
  columnCompiler: function columnCompiler(tableBuilder, columnBuilder) {
    return new ColumnCompiler(this, tableBuilder, columnBuilder);
  },
  runner: function runner(builder) {
    return new Runner(this, builder);
  },
  transaction: function transaction(container, config, outerTx) {
    return new Transaction(this, container, config, outerTx);
  },
  raw: function raw() {
    var _ref;

    return (_ref = new Raw(this)).set.apply(_ref, arguments);
  },
  _formatQuery: function _formatQuery(sql, bindings, timeZone) {
    var _this = this;

    bindings = bindings == null ? [] : [].concat(bindings);
    var index = 0;
    return sql.replace(/\\?\?/g, function (match) {
      if (match === '\\?') {
        return '?';
      }
      if (index === bindings.length) {
        return match;
      }
      var value = bindings[index++];
      return _this._escapeBinding(value, { timeZone: timeZone });
    });
  },


  _escapeBinding: makeEscape({
    escapeString: function escapeString(str) {
      return '\'' + str.replace(/'/g, "''") + '\'';
    }
  }),

  query: function query(connection, obj) {
    var _this2 = this;

    if (typeof obj === 'string') obj = { sql: obj };
    obj.bindings = this.prepBindings(obj.bindings);

    var __knexUid = connection.__knexUid,
        __knexTxId = connection.__knexTxId;


    this.emit('query', _assign({ __knexUid: __knexUid, __knexTxId: __knexTxId }, obj));
    debugQuery(obj.sql, __knexTxId);
    debugBindings(obj.bindings, __knexTxId);

    obj.sql = this.positionBindings(obj.sql);

    return this._query(connection, obj).catch(function (err) {
      err.message = _this2._formatQuery(obj.sql, obj.bindings) + ' - ' + err.message;
      _this2.emit('query-error', err, _assign({ __knexUid: __knexUid, __knexTxId: __knexTxId }, obj));
      throw err;
    });
  },
  stream: function stream(connection, obj, _stream, options) {
    if (typeof obj === 'string') obj = { sql: obj };
    obj.bindings = this.prepBindings(obj.bindings);

    var __knexUid = connection.__knexUid,
        __knexTxId = connection.__knexTxId;


    this.emit('query', _assign({ __knexUid: __knexUid, __knexTxId: __knexTxId }, obj));
    debugQuery(obj.sql, __knexTxId);
    debugBindings(obj.bindings, __knexTxId);

    obj.sql = this.positionBindings(obj.sql);

    return this._stream(connection, obj, _stream, options);
  },
  prepBindings: function prepBindings(bindings) {
    return bindings;
  },
  positionBindings: function positionBindings(sql) {
    return sql;
  },
  postProcessResponse: function postProcessResponse(resp, queryContext) {
    if (this.config.postProcessResponse) {
      return this.config.postProcessResponse(resp, queryContext);
    }
    return resp;
  },
  wrapIdentifier: function wrapIdentifier(value, queryContext) {
    return this.customWrapIdentifier(value, this.wrapIdentifierImpl, queryContext);
  },
  customWrapIdentifier: function customWrapIdentifier(value, origImpl, queryContext) {
    if (this.config.wrapIdentifier) {
      return this.config.wrapIdentifier(value, origImpl, queryContext);
    }
    return origImpl(value);
  },
  wrapIdentifierImpl: function wrapIdentifierImpl(value) {
    return value !== '*' ? '"' + value.replace(/"/g, '""') + '"' : '*';
  },
  initializeDriver: function initializeDriver() {
    try {
      this.driver = this._driver();
    } catch (e) {
      helpers.exit('Knex: run\n$ npm install ' + this.driverName + ' --save\n' + e.stack);
    }
  },
  poolDefaults: function poolDefaults() {
    return { min: 2, max: 10, propagateCreateError: true };
  },
  getPoolSettings: function getPoolSettings(poolConfig) {
    var _this3 = this;

    poolConfig = _defaults({}, poolConfig, this.poolDefaults());

    ['maxWaitingClients', 'testOnBorrow', 'fifo', 'priorityRange', 'autostart', 'evictionRunIntervalMillis', 'numTestsPerRun', 'softIdleTimeoutMillis', 'Promise'].forEach(function (option) {
      if (option in poolConfig) {
        helpers.warn(['Pool config option "' + option + '" is no longer supported.', 'See https://github.com/Vincit/tarn.js for possible pool config options.'].join(' '));
      }
    });

    var timeouts = [this.config.acquireConnectionTimeout || 60000, poolConfig.acquireTimeoutMillis].filter(function (timeout) {
      return timeout !== undefined;
    });

    // acquire connection timeout can be set on config or config.pool
    // choose the smallest, positive timeout setting and set on poolConfig
    poolConfig.acquireTimeoutMillis = Math.min.apply(Math, timeouts);

    return _Object$assign(poolConfig, {
      create: function create() {
        return _this3.acquireRawConnection().tap(function (connection) {
          connection.__knexUid = _uniqueId('__knexUid');

          if (poolConfig.afterCreate) {
            return Promise.promisify(poolConfig.afterCreate)(connection);
          }
        });
      },

      destroy: function destroy(connection) {
        if (poolConfig.beforeDestroy) {
          helpers.warn('\n            beforeDestroy is deprecated, please open an issue if you use this\n            to discuss alternative apis\n          ');

          poolConfig.beforeDestroy(connection, function () {});
        }

        if (connection !== void 0) {
          return _this3.destroyRawConnection(connection);
        }
      },

      validate: function validate(connection) {
        if (connection.__knex__disposed) {
          helpers.warn('Connection Error: ' + connection.__knex__disposed);
          return false;
        }

        return _this3.validateConnection(connection);
      }
    });
  },
  initializePool: function initializePool(config) {
    if (this.pool) {
      helpers.warn('The pool has already been initialized');
      return;
    }

    this.pool = new Pool(this.getPoolSettings(config.pool));
  },
  validateConnection: function validateConnection(connection) {
    return true;
  },


  // Acquire a connection from the pool.
  acquireConnection: function acquireConnection() {
    var _this4 = this;

    if (!this.pool) {
      return Promise.reject(new Error('Unable to acquire a connection'));
    }

    return Promise.try(function () {
      return _this4.pool.acquire().promise;
    }).tap(function (connection) {
      debug('acquired connection from pool: %s', connection.__knexUid);
    }).catch(TimeoutError, function () {
      throw new Promise.TimeoutError('Knex: Timeout acquiring a connection. The pool is probably full. ' + 'Are you missing a .transacting(trx) call?');
    });
  },


  // Releases a connection back to the connection pool,
  // returning a promise resolved when the connection is released.
  releaseConnection: function releaseConnection(connection) {
    debug('releasing connection to pool: %s', connection.__knexUid);
    var didRelease = this.pool.release(connection);

    if (!didRelease) {
      debug('pool refused connection: %s', connection.__knexUid);
    }

    return Promise.resolve();
  },


  // Destroy the current connection pool for the client.
  destroy: function destroy(callback) {
    var _this5 = this;

    var promise = null;

    if (this.pool) {
      promise = this.pool.destroy();
    } else {
      promise = Promise.resolve();
    }

    return promise.then(function () {
      _this5.pool = void 0;

      if (typeof callback === 'function') {
        callback();
      }
    }).catch(function (err) {
      if (typeof callback === 'function') {
        callback(err);
      }

      return Promise.reject(err);
    });
  },


  // Return the database being used by this client.
  database: function database() {
    return this.connectionSettings.database;
  },
  toString: function toString() {
    return '[object KnexClient]';
  },


  canCancelQuery: false,

  assertCanCancelQuery: function assertCanCancelQuery() {
    if (!this.canCancelQuery) {
      throw new Error("Query cancelling not supported for this dialect");
    }
  },
  cancelQuery: function cancelQuery() {
    throw new Error("Query cancelling not supported for this dialect");
  }
});

export default Client;
module.exports = exports['default'];