import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';

import Promise from 'bluebird';
import { warn } from '../../helpers';
import Transaction from '../../transaction';

var Redshift_Transaction = function (_Transaction) {
  _inherits(Redshift_Transaction, _Transaction);

  function Redshift_Transaction() {
    _classCallCheck(this, Redshift_Transaction);

    return _possibleConstructorReturn(this, _Transaction.apply(this, arguments));
  }

  Redshift_Transaction.prototype.savepoint = function savepoint(conn) {
    warn('Redshift does not support savepoints.');
    return Promise.resolve();
  };

  Redshift_Transaction.prototype.release = function release(conn, value) {
    warn('Redshift does not support savepoints.');
    return Promise.resolve();
  };

  Redshift_Transaction.prototype.rollbackTo = function rollbackTo(conn, error) {
    warn('Redshift does not support savepoints.');
    return Promise.resolve();
  };

  return Redshift_Transaction;
}(Transaction);

export default Redshift_Transaction;
module.exports = exports['default'];