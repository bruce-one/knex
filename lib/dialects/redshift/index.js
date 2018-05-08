import _map from 'lodash/map';
import _assign from 'lodash/assign';

// Redshift
// -------
import inherits from 'inherits';
import Client_PG from '../postgres';


import Transaction from './transaction';
import QueryCompiler from './query/compiler';
import ColumnBuilder from './schema/columnbuilder';
import ColumnCompiler from './schema/columncompiler';
import TableCompiler from './schema/tablecompiler';
import SchemaCompiler from './schema/compiler';

function Client_Redshift(config) {
  Client_PG.apply(this, arguments);
}
inherits(Client_Redshift, Client_PG);

_assign(Client_Redshift.prototype, {
  transaction: function transaction() {
    return new (Function.prototype.bind.apply(Transaction, [null].concat([this], Array.prototype.slice.call(arguments))))();
  },
  queryCompiler: function queryCompiler() {
    return new (Function.prototype.bind.apply(QueryCompiler, [null].concat([this], Array.prototype.slice.call(arguments))))();
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
  schemaCompiler: function schemaCompiler() {
    return new (Function.prototype.bind.apply(SchemaCompiler, [null].concat([this], Array.prototype.slice.call(arguments))))();
  },


  dialect: 'redshift',

  driverName: 'pg-redshift',

  _driver: function _driver() {
    return require('pg');
  },


  // Ensures the response is returned in the same format as other clients.
  processResponse: function processResponse(obj, runner) {
    var resp = obj.response;
    if (obj.output) return obj.output.call(runner, resp);
    if (obj.method === 'raw') return resp;
    if (resp.command === 'SELECT') {
      if (obj.method === 'first') return resp.rows[0];
      if (obj.method === 'pluck') return _map(resp.rows, obj.pluck);
      return resp.rows;
    }
    if (resp.command === 'INSERT' || resp.command === 'UPDATE' || resp.command === 'DELETE') {
      return resp.rowCount;
    }
    return resp;
  }
});

export default Client_Redshift;
module.exports = exports['default'];