import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import _isUndefined from 'lodash/isUndefined';

import Promise from 'bluebird';
import Transaction from '../../transaction';

var debugTx = require('debug')('knex:tx');

var Oracle_Transaction = function (_Transaction) {
  _inherits(Oracle_Transaction, _Transaction);

  function Oracle_Transaction() {
    _classCallCheck(this, Oracle_Transaction);

    return _possibleConstructorReturn(this, _Transaction.apply(this, arguments));
  }

  // disable autocommit to allow correct behavior (default is true)
  Oracle_Transaction.prototype.begin = function begin() {
    return Promise.resolve();
  };

  Oracle_Transaction.prototype.commit = function commit(conn, value) {
    this._completed = true;
    return conn.commitAsync().return(value).then(this._resolver, this._rejecter);
  };

  Oracle_Transaction.prototype.release = function release(conn, value) {
    return this._resolver(value);
  };

  Oracle_Transaction.prototype.rollback = function rollback(conn, err) {
    var _this2 = this;

    this._completed = true;
    debugTx('%s: rolling back', this.txid);
    return conn.rollbackAsync().throw(err).catch(function (error) {
      if (_isUndefined(error)) {
        error = new Error('Transaction rejected with non-error: ' + error);
      }

      return _this2._rejecter(error);
    });
  };

  Oracle_Transaction.prototype.acquireConnection = function acquireConnection(config) {
    var _this3 = this;

    var t = this;
    return Promise.try(function () {
      return config.connection || t.client.acquireConnection();
    }).then(function (connection) {
      connection.__knexTxId = _this3.txid;

      return connection;
    }).tap(function (connection) {
      if (!t.outerTx) {
        connection.setAutoCommit(false);
      }
    }).disposer(function (connection) {
      debugTx('%s: releasing connection', t.txid);
      connection.setAutoCommit(true);
      if (!config.connection) {
        t.client.releaseConnection(connection);
      } else {
        debugTx('%s: not releasing external connection', t.txid);
      }
    });
  };

  return Oracle_Transaction;
}(Transaction);

export default Oracle_Transaction;
module.exports = exports['default'];