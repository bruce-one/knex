import _assign from 'lodash/assign';

// MySQL2 Client
// -------
import inherits from 'inherits';
import Client_MySQL from '../mysql';

import Transaction from './transaction';

// Always initialize with the "QueryBuilder" and "QueryCompiler"
// objects, which extend the base 'lib/query/builder' and
// 'lib/query/compiler', respectively.
function Client_MySQL2(config) {
  Client_MySQL.call(this, config);
}
inherits(Client_MySQL2, Client_MySQL);

_assign(Client_MySQL2.prototype, {

  // The "dialect", for reference elsewhere.
  driverName: 'mysql2',

  transaction: function transaction() {
    return new (Function.prototype.bind.apply(Transaction, [null].concat([this], Array.prototype.slice.call(arguments))))();
  },
  _driver: function _driver() {
    return require('mysql2');
  },
  validateConnection: function validateConnection(connection) {
    if (connection._fatalError) {
      return false;
    }
    return true;
  }
});

export default Client_MySQL2;
module.exports = exports['default'];