import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import Promise from 'bluebird';
import Transaction from '../../transaction';
var debug = require('debug')('knex:tx');

var Transaction_MSSQL = function (_Transaction) {
  _inherits(Transaction_MSSQL, _Transaction);

  function Transaction_MSSQL() {
    _classCallCheck(this, Transaction_MSSQL);

    return _possibleConstructorReturn(this, _Transaction.apply(this, arguments));
  }

  Transaction_MSSQL.prototype.begin = function begin(conn) {
    debug('%s: begin', this.txid);
    return conn.tx_.begin().then(this._resolver, this._rejecter);
  };

  Transaction_MSSQL.prototype.savepoint = function savepoint(conn) {
    var _this2 = this;

    debug('%s: savepoint at', this.txid);
    return Promise.resolve().then(function () {
      return _this2.query(conn, 'SAVE TRANSACTION ' + _this2.txid);
    });
  };

  Transaction_MSSQL.prototype.commit = function commit(conn, value) {
    var _this3 = this;

    this._completed = true;
    debug('%s: commit', this.txid);
    return conn.tx_.commit().then(function () {
      return _this3._resolver(value);
    }, this._rejecter);
  };

  Transaction_MSSQL.prototype.release = function release(conn, value) {
    return this._resolver(value);
  };

  Transaction_MSSQL.prototype.rollback = function rollback(conn, error) {
    var _this4 = this;

    this._completed = true;
    debug('%s: rolling back', this.txid);
    return conn.tx_.rollback().then(function () {
      return _this4._rejecter(error);
    }, function (err) {
      if (error) err.originalError = error;
      return _this4._rejecter(err);
    });
  };

  Transaction_MSSQL.prototype.rollbackTo = function rollbackTo(conn, error) {
    var _this5 = this;

    debug('%s: rolling backTo', this.txid);
    return Promise.resolve().then(function () {
      return _this5.query(conn, 'ROLLBACK TRANSACTION ' + _this5.txid, 2, error);
    }).then(function () {
      return _this5._rejecter(error);
    });
  };

  // Acquire a connection and create a disposer - either using the one passed
  // via config or getting one off the client. The disposer will be called once
  // the original promise is marked completed.


  Transaction_MSSQL.prototype.acquireConnection = function acquireConnection(config) {
    var t = this;
    var configConnection = config && config.connection;
    return Promise.try(function () {
      return (t.outerTx ? t.outerTx.conn : null) || configConnection || t.client.acquireConnection();
    }).tap(function (conn) {
      if (!t.outerTx) {
        t.conn = conn;
        conn.tx_ = conn.transaction();
      }
    }).disposer(function (conn) {
      if (t.outerTx) return;
      if (conn.tx_) {
        if (!t._completed) {
          debug('%s: unreleased transaction', t.txid);
          conn.tx_.rollback();
        }
        conn.tx_ = null;
      }
      t.conn = null;
      if (!configConnection) {
        debug('%s: releasing connection', t.txid);
        t.client.releaseConnection(conn);
      } else {
        debug('%s: not releasing external connection', t.txid);
      }
    });
  };

  return Transaction_MSSQL;
}(Transaction);

export default Transaction_MSSQL;
module.exports = exports['default'];