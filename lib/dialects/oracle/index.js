import _values from 'lodash/values';
import _flatten from 'lodash/flatten';
import _map from 'lodash/map';
import _assign from 'lodash/assign';
// Oracle Client
// -------

import inherits from 'inherits';
import Client from '../../client';
import Promise from 'bluebird';
import * as helpers from '../../helpers';
import { bufferToString } from '../../query/string';
import Formatter from './formatter';

import Transaction from './transaction';
import QueryCompiler from './query/compiler';
import SchemaCompiler from './schema/compiler';
import ColumnBuilder from './schema/columnbuilder';
import ColumnCompiler from './schema/columncompiler';
import TableCompiler from './schema/tablecompiler';
import { ReturningHelper } from './utils';

// Always initialize with the "QueryBuilder" and "QueryCompiler"
// objects, which extend the base 'lib/query/builder' and
// 'lib/query/compiler', respectively.
export default function Client_Oracle(config) {
  Client.call(this, config);
}
inherits(Client_Oracle, Client);

_assign(Client_Oracle.prototype, {

  dialect: 'oracle',

  driverName: 'oracle',

  _driver: function _driver() {
    return require('oracle');
  },
  transaction: function transaction() {
    return new (Function.prototype.bind.apply(Transaction, [null].concat([this], Array.prototype.slice.call(arguments))))();
  },
  formatter: function formatter() {
    return new (Function.prototype.bind.apply(Formatter, [null].concat([this], Array.prototype.slice.call(arguments))))();
  },
  queryCompiler: function queryCompiler() {
    return new (Function.prototype.bind.apply(QueryCompiler, [null].concat([this], Array.prototype.slice.call(arguments))))();
  },
  schemaCompiler: function schemaCompiler() {
    return new (Function.prototype.bind.apply(SchemaCompiler, [null].concat([this], Array.prototype.slice.call(arguments))))();
  },
  columnBuilder: function columnBuilder() {
    return new (Function.prototype.bind.apply(ColumnBuilder, [null].concat([this], Array.prototype.slice.call(arguments))))();
  },
  columnCompiler: function columnCompiler() {
    return new (Function.prototype.bind.apply(ColumnCompiler, [null].concat([this], Array.prototype.slice.call(arguments))))();
  },
  tableCompiler: function tableCompiler() {
    return new (Function.prototype.bind.apply(TableCompiler, [null].concat([this], Array.prototype.slice.call(arguments))))();
  },
  prepBindings: function prepBindings(bindings) {
    var _this = this;

    return _map(bindings, function (value) {
      // returning helper uses always ROWID as string
      if (value instanceof ReturningHelper && _this.driver) {
        return new _this.driver.OutParam(_this.driver.OCCISTRING);
      } else if (typeof value === 'boolean') {
        return value ? 1 : 0;
      } else if (Buffer.isBuffer(value)) {
        return bufferToString(value);
      }
      return value;
    });
  },


  // Get a raw connection, called by the `pool` whenever a new
  // connection needs to be added to the pool.
  acquireRawConnection: function acquireRawConnection() {
    var _this2 = this;

    return new Promise(function (resolver, rejecter) {
      _this2.driver.connect(_this2.connectionSettings, function (err, connection) {
        if (err) return rejecter(err);
        Promise.promisifyAll(connection);
        if (_this2.connectionSettings.prefetchRowCount) {
          connection.setPrefetchRowCount(_this2.connectionSettings.prefetchRowCount);
        }
        resolver(connection);
      });
    });
  },


  // Used to explicitly close a connection, called internally by the pool
  // when a connection times out or the pool is shutdown.
  destroyRawConnection: function destroyRawConnection(connection) {
    return Promise.fromCallback(connection.close.bind(connection));
  },


  // Return the database for the Oracle client.
  database: function database() {
    return this.connectionSettings.database;
  },


  // Position the bindings for the query.
  positionBindings: function positionBindings(sql) {
    var questionCount = 0;
    return sql.replace(/\?/g, function () {
      questionCount += 1;
      return ':' + questionCount;
    });
  },
  _stream: function _stream(connection, obj, stream, options) {
    return new Promise(function (resolver, rejecter) {
      stream.on('error', function (err) {
        if (isConnectionError(err)) {
          connection.__knex__disposed = err;
        }
        rejecter(err);
      });
      stream.on('end', resolver);
      var queryStream = connection.queryStream(obj.sql, obj.bindings, options);
      queryStream.pipe(stream);
    });
  },


  // Runs the query on the specified connection, providing the bindings
  // and any other necessary prep work.
  _query: function _query(connection, obj) {

    if (!obj.sql) throw new Error('The query is empty');

    return connection.executeAsync(obj.sql, obj.bindings).then(function (response) {
      if (!obj.returning) return response;
      var rowIds = obj.outParams.map(function (v, i) {
        return response['returnParam' + (i ? i : '')];
      });
      return connection.executeAsync(obj.returningSql, rowIds);
    }).then(function (response) {
      obj.response = response;
      obj.rowsAffected = response.updateCount;
      return obj;
    }).catch(function (err) {
      if (isConnectionError(err)) {
        connection.__knex__disposed = err;
      }
      throw err;
    });
  },


  // Process the response as returned from the query.
  processResponse: function processResponse(obj, runner) {
    var response = obj.response;
    var method = obj.method;

    if (obj.output) return obj.output.call(runner, response);
    switch (method) {
      case 'select':
      case 'pluck':
      case 'first':
        response = helpers.skim(response);
        if (obj.method === 'pluck') response = _map(response, obj.pluck);
        return obj.method === 'first' ? response[0] : response;
      case 'insert':
      case 'del':
      case 'update':
      case 'counter':
        if (obj.returning) {
          if (obj.returning.length > 1 || obj.returning[0] === '*') {
            return response;
          }
          // return an array with values if only one returning value was specified
          return _flatten(_map(response, _values));
        }
        return obj.rowsAffected;
      default:
        return response;
    }
  }
});

// If the error is any of these, we'll assume we need to
// mark the connection as failed
var connectionErrors = ['ORA-12514', 'NJS-040', 'NJS-024', 'NJS-003', 'NJS-024'];

function isConnectionError(err) {
  return connectionErrors.some(function (prefix) {
    return err.message.indexOf(prefix) === 0;
  });
}
module.exports = exports['default'];