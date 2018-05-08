import _clone from 'lodash/clone';
import _uniqueId from 'lodash/uniqueId';
import _map from 'lodash/map';
import _assign from 'lodash/assign';
/* globals openDatabase:false */

// WebSQL
// -------
import inherits from 'inherits';

import Transaction from './transaction';
import Client_SQLite3 from '../sqlite3';
import Promise from 'bluebird';


function Client_WebSQL(config) {
  Client_SQLite3.call(this, config);
  this.name = config.name || 'knex_database';
  this.version = config.version || '1.0';
  this.displayName = config.displayName || this.name;
  this.estimatedSize = config.estimatedSize || 5 * 1024 * 1024;
}
inherits(Client_WebSQL, Client_SQLite3);

_assign(Client_WebSQL.prototype, {
  transaction: function transaction() {
    return new (Function.prototype.bind.apply(Transaction, [null].concat([this], Array.prototype.slice.call(arguments))))();
  },


  dialect: 'websql',

  // Get a raw connection from the database, returning a promise with the connection object.
  acquireConnection: function acquireConnection() {
    var _this = this;

    return new Promise(function (resolve, reject) {
      try {
        /*jslint browser: true*/
        var db = openDatabase(_this.name, _this.version, _this.displayName, _this.estimatedSize);
        db.transaction(function (t) {
          t.__knexUid = _uniqueId('__knexUid');
          resolve(t);
        });
      } catch (e) {
        reject(e);
      }
    });
  },


  // Used to explicitly close a connection, called internally by the pool
  // when a connection times out or the pool is shutdown.
  releaseConnection: function releaseConnection() {
    return Promise.resolve();
  },


  // Runs the query on the specified connection,
  // providing the bindings and any other necessary prep work.
  _query: function _query(connection, obj) {
    return new Promise(function (resolver, rejecter) {
      if (!connection) return rejecter(new Error('No connection provided.'));
      connection.executeSql(obj.sql, obj.bindings, function (trx, response) {
        obj.response = response;
        return resolver(obj);
      }, function (trx, err) {
        rejecter(err);
      });
    });
  },
  _stream: function _stream(connection, sql, stream) {
    var client = this;
    return new Promise(function (resolver, rejecter) {
      stream.on('error', rejecter);
      stream.on('end', resolver);
      return client._query(connection, sql).then(function (obj) {
        return client.processResponse(obj);
      }).map(function (row) {
        stream.write(row);
      }).catch(function (err) {
        stream.emit('error', err);
      }).then(function () {
        stream.end();
      });
    });
  },
  processResponse: function processResponse(obj, runner) {
    var resp = obj.response;
    if (obj.output) return obj.output.call(runner, resp);
    switch (obj.method) {
      case 'pluck':
      case 'first':
      case 'select':
        {
          var results = [];
          for (var i = 0, l = resp.rows.length; i < l; i++) {
            results[i] = _clone(resp.rows.item(i));
          }
          if (obj.method === 'pluck') results = _map(results, obj.pluck);
          return obj.method === 'first' ? results[0] : results;
        }
      case 'insert':
        return [resp.insertId];
      case 'delete':
      case 'update':
      case 'counter':
        return resp.rowsAffected;
      default:
        return resp;
    }
  }
});

export default Client_WebSQL;
module.exports = exports['default'];