import _identity from 'lodash/identity';
import _reduce from 'lodash/reduce';
import _assign from 'lodash/assign';

// PostgreSQL Query Builder & Compiler
// ------
import inherits from 'inherits';

import QueryCompiler from '../../../query/compiler';

function QueryCompiler_PG(client, builder) {
  QueryCompiler.call(this, client, builder);
}
inherits(QueryCompiler_PG, QueryCompiler);

_assign(QueryCompiler_PG.prototype, {

  // Compiles a truncate query.
  truncate: function truncate() {
    return 'truncate ' + this.tableName + ' restart identity';
  },


  // is used if the an array with multiple empty values supplied
  _defaultInsertValue: 'default',

  // Compiles an `insert` query, allowing for multiple
  // inserts using a single query statement.
  insert: function insert() {
    var sql = QueryCompiler.prototype.insert.call(this);
    if (sql === '') return sql;
    var returning = this.single.returning;

    return {
      sql: sql + this._returning(returning),
      returning: returning
    };
  },


  // Compiles an `update` query, allowing for a return value.
  update: function update() {
    var updateData = this._prepUpdate(this.single.update);
    var wheres = this.where();
    var returning = this.single.returning;

    return {
      sql: this.with() + ('update ' + (this.single.only ? 'only ' : '') + this.tableName + ' ') + ('set ' + updateData.join(', ')) + (wheres ? ' ' + wheres : '') + this._returning(returning),
      returning: returning
    };
  },


  // Compiles an `update` query, allowing for a return value.
  del: function del() {
    var sql = QueryCompiler.prototype.del.apply(this, arguments);
    var returning = this.single.returning;

    return {
      sql: sql + this._returning(returning),
      returning: returning
    };
  },
  aggregate: function aggregate(stmt) {
    return this._aggregate(stmt, { distinctParentheses: true });
  },
  _returning: function _returning(value) {
    return value ? ' returning ' + this.formatter.columnize(value) : '';
  },
  forUpdate: function forUpdate() {
    return 'for update';
  },
  forShare: function forShare() {
    return 'for share';
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
    var bindings = [table, this.client.database()];

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

export default QueryCompiler_PG;
module.exports = exports['default'];