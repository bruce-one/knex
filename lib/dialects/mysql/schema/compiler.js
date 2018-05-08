import _assign from 'lodash/assign';

// MySQL Schema Compiler
// -------
import inherits from 'inherits';
import SchemaCompiler from '../../../schema/compiler';

function SchemaCompiler_MySQL(client, builder) {
  SchemaCompiler.call(this, client, builder);
}
inherits(SchemaCompiler_MySQL, SchemaCompiler);

_assign(SchemaCompiler_MySQL.prototype, {

  // Rename a table on the schema.
  renameTable: function renameTable(tableName, to) {
    this.pushQuery('rename table ' + this.formatter.wrap(tableName) + ' to ' + this.formatter.wrap(to));
  },


  // Check whether a table exists on the query.
  hasTable: function hasTable(tableName) {
    var sql = 'select * from information_schema.tables where table_name = ?';
    var bindings = [tableName];

    if (this.schema) {
      sql += ' and table_schema = ?';
      bindings.push(this.schema);
    } else {
      sql += ' and table_schema = database()';
    }

    this.pushQuery({
      sql: sql,
      bindings: bindings,
      output: function output(resp) {
        return resp.length > 0;
      }
    });
  },


  // Check whether a column exists on the schema.
  hasColumn: function hasColumn(tableName, column) {
    this.pushQuery({
      sql: 'show columns from ' + this.formatter.wrap(tableName) + ' like ' + this.formatter.parameter(column),
      output: function output(resp) {
        return resp.length > 0;
      }
    });
  }
});

export default SchemaCompiler_MySQL;
module.exports = exports['default'];