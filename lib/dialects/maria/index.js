import _Object$keys from 'babel-runtime/core-js/object/keys';
import _map from 'lodash/map';
import _assign from 'lodash/assign';

// MariaSQL Client
// -------
import inherits from 'inherits';
import Client_MySQL from '../mysql';
import Promise from 'bluebird';
import * as helpers from '../../helpers';
import Transaction from './transaction';

function Client_MariaSQL(config) {
  Client_MySQL.call(this, config);
}
inherits(Client_MariaSQL, Client_MySQL);

_assign(Client_MariaSQL.prototype, {

  dialect: 'mariadb',

  driverName: 'mariasql',

  transaction: function transaction() {
    return new (Function.prototype.bind.apply(Transaction, [null].concat([this], Array.prototype.slice.call(arguments))))();
  },
  _driver: function _driver() {
    return require('mariasql');
  },


  // Get a raw connection, called by the `pool` whenever a new
  // connection needs to be added to the pool.
  acquireRawConnection: function acquireRawConnection() {
    var _this = this;

    return new Promise(function (resolver, rejecter) {
      var connection = new _this.driver();
      connection.connect(_assign({ metadata: true }, _this.connectionSettings));
      connection.on('ready', function () {
        resolver(connection);
      }).on('error', function (err) {
        connection.__knex__disposed = err;
        rejecter(err);
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
    connection.removeAllListeners();
    var closed = Promise.resolve();
    if (connection.connected || connection.connecting) {
      closed = new Promise(function (resolve) {
        connection.once('close', resolve);
      });
    }
    connection.end();
    return closed;
  },


  // Return the database for the MariaSQL client.
  database: function database() {
    return this.connectionSettings.db;
  },


  // Grab a connection, run the query via the MariaSQL streaming interface,
  // and pass that through to the stream we've sent back to the client.
  _stream: function _stream(connection, sql, stream) {
    return new Promise(function (resolver, rejecter) {
      connection.query(sql.sql, sql.bindings).on('result', function (res) {
        res.on('error', rejecter).on('end', function () {
          resolver(res.info);
        }).on('data', function (data) {
          stream.write(handleRow(data, res.info.metadata));
        });
      }).on('error', rejecter);
    });
  },


  // Runs the query on the specified connection, providing the bindings
  // and any other necessary prep work.
  _query: function _query(connection, obj) {
    var _this2 = this;

    var tz = this.connectionSettings.timezone || 'local';
    return new Promise(function (resolver, rejecter) {
      if (!obj.sql) return resolver();
      var sql = _this2._formatQuery(obj.sql, obj.bindings, tz);
      connection.query(sql, function (err, rows) {
        if (err) {
          return rejecter(err);
        }
        handleRows(rows, rows.info.metadata);
        obj.response = [rows, rows.info];
        resolver(obj);
      });
    });
  },


  // Process the response as returned from the query.
  processResponse: function processResponse(obj, runner) {
    var response = obj.response;
    var method = obj.method;

    var rows = response[0];
    var data = response[1];
    if (obj.output) return obj.output.call(runner, rows /*, fields*/);
    switch (method) {
      case 'select':
      case 'pluck':
      case 'first':
        {
          var resp = helpers.skim(rows);
          if (method === 'pluck') return _map(resp, obj.pluck);
          return method === 'first' ? resp[0] : resp;
        }
      case 'insert':
        return [data.insertId];
      case 'del':
      case 'update':
      case 'counter':
        return parseInt(data.affectedRows, 10);
      default:
        return response;
    }
  }
});

function parseType(value, type) {
  switch (type) {
    case 'DATETIME':
    case 'TIMESTAMP':
      return new Date(value);
    case 'INTEGER':
      return parseInt(value, 10);
    default:
      return value;
  }
}

function handleRow(row, metadata) {
  var keys = _Object$keys(metadata);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var type = metadata[key].type;

    row[key] = parseType(row[key], type);
  }
  return row;
}

function handleRows(rows, metadata) {
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    handleRow(row, metadata);
  }
  return rows;
}

export default Client_MariaSQL;
module.exports = exports['default'];