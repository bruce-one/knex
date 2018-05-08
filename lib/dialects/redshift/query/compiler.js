import _identity from 'lodash/identity';
import _reduce from 'lodash/reduce';
import _assign from 'lodash/assign';

// Redshift Query Builder & Compiler
// ------
import inherits from 'inherits';

import QueryCompiler from '../../../query/compiler';
import QueryCompiler_PG from '../../postgres/query/compiler';
import * as helpers from '../../../helpers';

function QueryCompiler_Redshift(client, builder) {
  QueryCompiler_PG.call(this, client, builder);
}
inherits(QueryCompiler_Redshift, QueryCompiler_PG);

_assign(QueryCompiler_Redshift.prototype, {
  truncate: function truncate() {
    return 'truncate ' + this.tableName.toLowerCase();
  },


  // Compiles an `insert` query, allowing for multiple
  // inserts using a single query statement.
  insert: function insert() {
    var sql = QueryCompiler.prototype.insert.apply(this, arguments);
    if (sql === '') return sql;
    this._slightReturn();
    return {
      sql: sql
    };
  },


  // Compiles an `update` query, warning on unsupported returning
  update: function update() {
    var sql = QueryCompiler.prototype.update.apply(this, arguments);
    this._slightReturn();
    return {
      sql: sql
    };
  },


  // Compiles an `delete` query, warning on unsupported returning
  del: function del() {
    var sql = QueryCompiler.prototype.del.apply(this, arguments);
    this._slightReturn();
    return {
      sql: sql
    };
  },


  // simple: if trying to return, warn
  _slightReturn: function _slightReturn() {
    if (this.single.isReturning) {
      helpers.warn('insert/update/delete returning is not supported by redshift dialect');
    }
  },
  forUpdate: function forUpdate() {
    helpers.warn('table lock is not supported by redshift dialect');
    return '';
  },
  forShare: function forShare() {
    helpers.warn('lock for share is not supported by redshift dialect');
    return '';
  },


  // Compiles a columnInfo query
  columnInfo: function columnInfo() {
    var column = this.single.columnInfo;
    var schema = this.single.schema;

    // The user may have specified a custom wrapIdentifier function in the config. We
    // need to run the identifiers through that function, but not format them as
    // identifiers otherwise.
    var table = this.client.customWrapIdentifier(this.single.table, _identity);

    if (schema) {
      schema = this.client.customWrapIdentifier(schema, _identity);
    }

    var sql = 'select * from information_schema.columns where table_name = ? and table_catalog = ?';
    var bindings = [table.toLowerCase(), this.client.database().toLowerCase()];

    if (schema) {
      sql += ' and table_schema = ?';
      bindings.push(schema);
    } else {
      sql += ' and table_schema = current_schema()';
    }

    return {
      sql: sql,
      bindings: bindings,
      output: function output(resp) {
        var out = _reduce(resp.rows, function (columns, val) {
          columns[val.column_name] = {
            type: val.data_type,
            maxLength: val.character_maximum_length,
            nullable: val.is_nullable === 'YES',
            defaultValue: val.column_default
          };
          return columns;
        }, {});
        return column && out[column] || out;
      }
    };
  }
});

export default QueryCompiler_Redshift;
module.exports = exports['default'];