import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import _isUndefined from 'lodash/isUndefined';
import Debug from 'debug';
import Transaction from '../../transaction';
import * as helpers from '../../helpers';


var debug = Debug('knex:tx');

var Transaction_Maria = function (_Transaction) {
  _inherits(Transaction_Maria, _Transaction);

  function Transaction_Maria() {
    _classCallCheck(this, Transaction_Maria);

    return _possibleConstructorReturn(this, _Transaction.apply(this, arguments));
  }

  Transaction_Maria.prototype.query = function query(conn, sql, status, value) {
    var t = this;
    var q = this.trxClient.query(conn, sql).catch(function (err) {
      return err.code === 1305;
    }, function () {
      helpers.warn('Transaction was implicitly committed, do not mix transactions and ' + 'DDL with MariaDB (#805)');
    }).catch(function (err) {
      status = 2;
      value = err;
      t._completed = true;
      debug('%s error running transaction query', t.txid);
    }).tap(function () {
      if (status === 1) t._resolver(value);
      if (status === 2) {
        if (_isUndefined(value)) {
          value = new Error('Transaction rejected with non-error: ' + value);
        }
        t._rejecter(value);
      }
    });
    if (status === 1 || status === 2) {
      t._completed = true;
    }
    return q;
  };

  return Transaction_Maria;
}(Transaction);

export default Transaction_Maria;
module.exports = exports['default'];