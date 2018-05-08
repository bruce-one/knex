import _isUndefined from 'lodash/isUndefined';
import _assign from 'lodash/assign';

import { pushQuery, pushAdditional } from './helpers';

// The "SchemaCompiler" takes all of the query statements which have been
// gathered in the "SchemaBuilder" and turns them into an array of
// properly formatted / bound query strings.
function SchemaCompiler(client, builder) {
  this.builder = builder;
  this.client = client;
  this.schema = builder._schema;
  this.formatter = client.formatter(builder);
  this.sequence = [];
}

_assign(SchemaCompiler.prototype, {

  pushQuery: pushQuery,

  pushAdditional: pushAdditional,

  createTable: buildTable('create'),

  createTableIfNotExists: buildTable('createIfNot'),

  alterTable: buildTable('alter'),

  dropTablePrefix: 'drop table ',

  dropTable: function dropTable(tableName) {
    this.pushQuery(this.dropTablePrefix + this.formatter.wrap(prefixedTableName(this.schema, tableName)));
  },
  dropTableIfExists: function dropTableIfExists(tableName) {
    this.pushQuery(this.dropTablePrefix + 'if exists ' + this.formatter.wrap(prefixedTableName(this.schema, tableName)));
  },
  raw: function raw(sql, bindings) {
    this.sequence.push(this.client.raw(sql, bindings).toSQL());
  },
  toSQL: function toSQL() {
    var sequence = this.builder._sequence;
    for (var i = 0, l = sequence.length; i < l; i++) {
      var query = sequence[i];
      this[query.method].apply(this, query.args);
    }
    return this.sequence;
  }
});

function buildTable(type) {
  return function (tableName, fn) {
    var builder = this.client.tableBuilder(type, tableName, fn);

    // pass queryContext down to tableBuilder but do not overwrite it if already set
    var queryContext = this.builder.queryContext();
    if (!_isUndefined(queryContext) && _isUndefined(builder.queryContext())) {
      builder.queryContext(queryContext);
    }

    builder.setSchema(this.schema);
    var sql = builder.toSQL();

    for (var i = 0, l = sql.length; i < l; i++) {
      this.sequence.push(sql[i]);
    }
  };
}

function prefixedTableName(prefix, table) {
  return prefix ? prefix + '.' + table : table;
}

export default SchemaCompiler;
module.exports = exports['default'];