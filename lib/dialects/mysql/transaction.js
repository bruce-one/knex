import _isUndefined from 'lodash/isUndefined';
import _assign from 'lodash/assign';

import Transaction from '../../transaction';
import inherits from 'inherits';
import Debug from 'debug';
import * as helpers from '../../helpers';


var debug = Debug('knex:tx');

function Transaction_MySQL() {
  Transaction.apply(this, arguments);
}
inherits(Transaction_MySQL, Transaction);

_assign(Transaction_MySQL.prototype, {
  query: function query(conn, sql, status, value) {
    var t = this;
    var q = this.trxClient.query(conn, sql).catch(function (err) {
      return err.errno === 1305;
    }, function () {
      helpers.warn('Transaction was implicitly committed, do not mix transactions and ' + 'DDL with MySQL (#805)');
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
  }
});

export default Transaction_MySQL;
module.exports = exports['default'];