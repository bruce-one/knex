import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import _values from 'lodash/values';
import _flatten from 'lodash/flatten';
import _map from 'lodash/map';
import _assign from 'lodash/assign';
// MSSQL Client
// -------

import inherits from 'inherits';

import Client from '../../client';
import Promise from 'bluebird';
import * as helpers from '../../helpers';

import Formatter from '../../formatter';
import Transaction from './transaction';
import QueryCompiler from './query/compiler';
import SchemaCompiler from './schema/compiler';
import TableCompiler from './schema/tablecompiler';
import ColumnCompiler from './schema/columncompiler';

var isArray = Array.isArray;


var SQL_INT4 = { MIN: -2147483648, MAX: 2147483647 };
var SQL_BIGINT_SAFE = { MIN: -9007199254740991, MAX: 9007199254740991

  // Always initialize with the "QueryBuilder" and "QueryCompiler" objects, which
  // extend the base 'lib/query/builder' and 'lib/query/compiler', respectively.
};function Client_MSSQL(config) {
  // #1235 mssql module wants 'server', not 'host'. This is to enforce the same
  // options object across all dialects.
  if (config && config.connection && config.connection.host) {
    config.connection.server = config.connection.host;
  }
  Client.call(this, config);
}
inherits(Client_MSSQL, Client);

_assign(Client_MSSQL.prototype, {

  dialect: 'mssql',

  driverName: 'mssql',

  _driver: function _driver() {
    return require('mssql');
  },
  formatter: function formatter() {
    return new (Function.prototype.bind.apply(MSSQL_Formatter, [null].concat([this], Array.prototype.slice.call(arguments))))();
  },
  transaction: function transaction() {
    return new (Function.prototype.bind.apply(Transaction, [null].concat([this], Array.prototype.slice.call(arguments))))();
  },
  queryCompiler: function queryCompiler() {
    return new (Function.prototype.bind.apply(QueryCompiler, [null].concat([this], Array.prototype.slice.call(arguments))))();
  },
  schemaCompiler: function schemaCompiler() {
    return new (Function.prototype.bind.apply(SchemaCompiler, [null].concat([this], Array.prototype.slice.call(arguments))))();
  },
  tableCompiler: function tableCompiler() {
    return new (Function.prototype.bind.apply(TableCompiler, [null].concat([this], Array.prototype.slice.call(arguments))))();
  },
  columnCompiler: function columnCompiler() {
    return new (Function.prototype.bind.apply(ColumnCompiler, [null].concat([this], Array.prototype.slice.call(arguments))))();
  },
  wrapIdentifierImpl: function wrapIdentifierImpl(value) {
    return value !== '*' ? '[' + value.replace(/\[/g, '[') + ']' : '*';
  },


  // Get a raw connection, called by the `pool` whenever a new
  // connection needs to be added to the pool.
  acquireRawConnection: function acquireRawConnection() {
    var _this = this;

    return new Promise(function (resolver, rejecter) {
      var connection = new _this.driver.ConnectionPool(_this.connectionSettings);
      connection.connect(function (err) {
        if (err) {
          return rejecter(err);
        }
        connection.on('error', function (err) {
          connection.__knex__disposed = err;
        });
        resolver(connection);
      });
    });
  },
  validateConnection: function validateConnection(connection) {
    if (connection.connected === true) {
      return true;
    }

    return false;
  },


  // Used to explicitly close a connection, called internally by the pool
  // when a connection times out or the pool is shutdown.
  destroyRawConnection: function destroyRawConnection(connection) {
    return connection.close();
  },


  // Position the bindings for the query.
  positionBindings: function positionBindings(sql) {
    var questionCount = -1;
    return sql.replace(/\?/g, function () {
      questionCount += 1;
      return '@p' + questionCount;
    });
  },


  // Grab a connection, run the query via the MSSQL streaming interface,
  // and pass that through to the stream we've sent back to the client.
  _stream: function _stream(connection, obj, stream, options) {
    var _this2 = this;

    options = options || {};
    if (!obj || typeof obj === 'string') obj = { sql: obj };
    return new Promise(function (resolver, rejecter) {
      stream.on('error', function (err) {
        rejecter(err);
      });
      stream.on('end', resolver);
      var _obj = obj,
          sql = _obj.sql;

      if (!sql) return resolver();
      var req = (connection.tx_ || connection).request();
      //req.verbose = true;
      req.multiple = true;
      req.stream = true;
      if (obj.bindings) {
        for (var i = 0; i < obj.bindings.length; i++) {
          _this2._setReqInput(req, i, obj.bindings[i]);
        }
      }
      req.pipe(stream);
      req.query(sql);
    });
  },


  // Runs the query on the specified connection, providing the bindings
  // and any other necessary prep work.
  _query: function _query(connection, obj) {
    var client = this;
    if (!obj || typeof obj === 'string') obj = { sql: obj };
    return new Promise(function (resolver, rejecter) {
      var _obj2 = obj,
          sql = _obj2.sql;

      if (!sql) return resolver();
      var req = (connection.tx_ || connection).request();
      // req.verbose = true;
      req.multiple = true;
      if (obj.bindings) {
        for (var i = 0; i < obj.bindings.length; i++) {
          client._setReqInput(req, i, obj.bindings[i]);
        }
      }
      req.query(sql, function (err, recordset) {
        if (err) {
          return rejecter(err);
        }
        obj.response = recordset.recordsets[0];
        resolver(obj);
      });
    });
  },


  // sets a request input parameter. Detects bigints and decimals and sets type appropriately.
  _setReqInput: function _setReqInput(req, i, binding) {
    if (typeof binding == 'number') {
      if (binding % 1 !== 0) {
        req.input('p' + i, this.driver.Decimal(38, 10), binding);
      } else if (binding < SQL_INT4.MIN || binding > SQL_INT4.MAX) {
        if (binding < SQL_BIGINT_SAFE.MIN || binding > SQL_BIGINT_SAFE.MAX) {
          throw new Error('Bigint must be safe integer or must be passed as string, saw ' + binding);
        }
        req.input('p' + i, this.driver.BigInt, binding);
      } else {
        req.input('p' + i, this.driver.Int, binding);
      }
    } else {
      req.input('p' + i, binding);
    }
  },


  // Process the response as returned from the query.
  processResponse: function processResponse(obj, runner) {
    if (obj == null) return;
    var response = obj.response;
    var method = obj.method;

    if (obj.output) return obj.output.call(runner, response);
    switch (method) {
      case 'select':
      case 'pluck':
      case 'first':
        response = helpers.skim(response);
        if (method === 'pluck') return _map(response, obj.pluck);
        return method === 'first' ? response[0] : response;
      case 'insert':
      case 'del':
      case 'update':
      case 'counter':
        if (obj.returning) {
          if (obj.returning === '@@rowcount') {
            return response[0][''];
          }

          if (isArray(obj.returning) && obj.returning.length > 1 || obj.returning[0] === '*') {
            return response;
          }
          // return an array with values if only one returning value was specified
          return _flatten(_map(response, _values));
        }
        return response;
      default:
        return response;
    }
  }
});

var MSSQL_Formatter = function (_Formatter) {
  _inherits(MSSQL_Formatter, _Formatter);

  function MSSQL_Formatter() {
    _classCallCheck(this, MSSQL_Formatter);

    return _possibleConstructorReturn(this, _Formatter.apply(this, arguments));
  }

  // Accepts a string or array of columns to wrap as appropriate.
  MSSQL_Formatter.prototype.columnizeWithPrefix = function columnizeWithPrefix(prefix, target) {
    var columns = typeof target === 'string' ? [target] : target;
    var str = '',
        i = -1;
    while (++i < columns.length) {
      if (i > 0) str += ', ';
      str += prefix + this.wrap(columns[i]);
    }
    return str;
  };

  return MSSQL_Formatter;
}(Formatter);

export default Client_MSSQL;
module.exports = exports['default'];