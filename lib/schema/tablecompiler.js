import _getIterator from 'babel-runtime/core-js/get-iterator';
import _isUndefined from 'lodash/isUndefined';
import _isArray from 'lodash/isArray';
import _indexOf from 'lodash/indexOf';
import _isEmpty from 'lodash/isEmpty';
import _tail from 'lodash/tail';
import _first from 'lodash/first';
import _map from 'lodash/map';
import _reduce from 'lodash/reduce';
import _groupBy from 'lodash/groupBy';
/* eslint max-len:0 */

// Table Compiler
// -------
import { pushAdditional, pushQuery } from './helpers';
import * as helpers from '../helpers';


function TableCompiler(client, tableBuilder) {
  this.client = client;
  this.tableBuilder = tableBuilder;
  this.method = tableBuilder._method;
  this.schemaNameRaw = tableBuilder._schemaName;
  this.tableNameRaw = tableBuilder._tableName;
  this.single = tableBuilder._single;
  this.grouped = _groupBy(tableBuilder._statements, 'grouping');
  this.formatter = client.formatter(tableBuilder);
  this.sequence = [];
  this._formatting = client.config && client.config.formatting;
}

TableCompiler.prototype.pushQuery = function () {
  for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }

  pushQuery.call.apply(pushQuery, [this].concat(args));
};

TableCompiler.prototype.pushAdditional = function () {
  for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
    args[_key2] = arguments[_key2];
  }

  pushAdditional.call.apply(pushAdditional, [this].concat(args));
};

// Convert the tableCompiler toSQL
TableCompiler.prototype.toSQL = function () {
  this[this.method]();
  return this.sequence;
};

TableCompiler.prototype.lowerCase = true;

// Column Compilation
// -------

// If this is a table "creation", we need to first run through all
// of the columns to build them into a single string,
// and then run through anything else and push it to the query sequence.
TableCompiler.prototype.createAlterTableMethods = null;
TableCompiler.prototype.create = function (ifNot) {
  var columnBuilders = this.getColumns();
  var columns = columnBuilders.map(function (col) {
    return col.toSQL();
  });
  var columnTypes = this.getColumnTypes(columns);
  if (this.createAlterTableMethods) {
    this.alterTableForCreate(columnTypes);
  }
  this.createQuery(columnTypes, ifNot);
  this.columnQueries(columns);
  delete this.single.comment;
  this.alterTable();
};

// Only create the table if it doesn't exist.
TableCompiler.prototype.createIfNot = function () {
  this.create(true);
};

// If we're altering the table, we need to one-by-one
// go through and handle each of the queries associated
// with altering the table's schema.
TableCompiler.prototype.alter = function () {
  var addColBuilders = this.getColumns();
  var addColumns = addColBuilders.map(function (col) {
    return col.toSQL();
  });
  var alterColBuilders = this.getColumns('alter');
  var alterColumns = alterColBuilders.map(function (col) {
    return col.toSQL();
  });
  var addColumnTypes = this.getColumnTypes(addColumns);
  var alterColumnTypes = this.getColumnTypes(alterColumns);

  this.addColumns(addColumnTypes);
  this.alterColumns(alterColumnTypes, alterColBuilders);
  this.columnQueries(addColumns);
  this.columnQueries(alterColumns);
  this.alterTable();
};

TableCompiler.prototype.foreign = function (foreignData) {
  if (foreignData.inTable && foreignData.references) {
    var keyName = foreignData.keyName ? this.formatter.wrap(foreignData.keyName) : this._indexCommand('foreign', this.tableNameRaw, foreignData.column);
    var column = this.formatter.columnize(foreignData.column);
    var references = this.formatter.columnize(foreignData.references);
    var inTable = this.formatter.wrap(foreignData.inTable);
    var onUpdate = foreignData.onUpdate ? (this.lowerCase ? ' on update ' : ' ON UPDATE ') + foreignData.onUpdate : '';
    var onDelete = foreignData.onDelete ? (this.lowerCase ? ' on delete ' : ' ON DELETE ') + foreignData.onDelete : '';
    if (this.lowerCase) {
      this.pushQuery((!this.forCreate ? 'alter table ' + this.tableName() + ' add ' : '') + 'constraint ' + keyName + ' ' + 'foreign key (' + column + ') references ' + inTable + ' (' + references + ')' + onUpdate + onDelete);
    } else {
      this.pushQuery((!this.forCreate ? 'ALTER TABLE ' + this.tableName() + ' ADD ' : '') + 'CONSTRAINT ' + keyName + ' ' + 'FOREIGN KEY (' + column + ') REFERENCES ' + inTable + ' (' + references + ')' + onUpdate + onDelete);
    }
  }
};

// Get all of the column sql & bindings individually for building the table queries.
TableCompiler.prototype.getColumnTypes = function (columns) {
  return _reduce(_map(columns, _first), function (memo, column) {
    memo.sql.push(column.sql);
    memo.bindings.concat(column.bindings);
    return memo;
  }, { sql: [], bindings: [] });
};

// Adds all of the additional queries from the "column"
TableCompiler.prototype.columnQueries = function (columns) {
  var queries = _reduce(_map(columns, _tail), function (memo, column) {
    if (!_isEmpty(column)) return memo.concat(column);
    return memo;
  }, []);
  for (var _iterator = queries, _isArray2 = Array.isArray(_iterator), _i = 0, _iterator = _isArray2 ? _iterator : _getIterator(_iterator);;) {
    var _ref;

    if (_isArray2) {
      if (_i >= _iterator.length) break;
      _ref = _iterator[_i++];
    } else {
      _i = _iterator.next();
      if (_i.done) break;
      _ref = _i.value;
    }

    var q = _ref;

    this.pushQuery(q);
  }
};

// Add a new column.
TableCompiler.prototype.addColumnsPrefix = 'add column ';

// All of the columns to "add" for the query
TableCompiler.prototype.addColumns = function (columns, prefix) {
  prefix = prefix || this.addColumnsPrefix;

  if (columns.sql.length > 0) {
    var columnSql = _map(columns.sql, function (column) {
      return prefix + column;
    });
    this.pushQuery({
      sql: (this.lowerCase ? 'alter table ' : 'ALTER TABLE ') + this.tableName() + ' ' + columnSql.join(', '),
      bindings: columns.bindings
    });
  }
};

// Alter column
TableCompiler.prototype.alterColumnsPrefix = 'alter column ';

TableCompiler.prototype.alterColumns = function (columns, colBuilders) {
  if (columns.sql.length > 0) {
    this.addColumns(columns, this.alterColumnsPrefix, colBuilders);
  }
};

// Compile the columns as needed for the current create or alter table
TableCompiler.prototype.getColumns = function (method) {
  var _this = this;

  var columns = this.grouped.columns || [];
  method = method || 'add';

  var queryContext = this.tableBuilder.queryContext();

  return columns.filter(function (column) {
    return column.builder._method === method;
  }).map(function (column) {
    // pass queryContext down to columnBuilder but do not overwrite it if already set
    if (!_isUndefined(queryContext) && _isUndefined(column.builder.queryContext())) {
      column.builder.queryContext(queryContext);
    }
    return _this.client.columnCompiler(_this, column.builder);
  });
};

TableCompiler.prototype.tableName = function () {
  var name = this.schemaNameRaw ? this.schemaNameRaw + '.' + this.tableNameRaw : this.tableNameRaw;

  return this.formatter.wrap(name);
};

// Generate all of the alter column statements necessary for the query.
TableCompiler.prototype.alterTable = function () {
  var alterTable = this.grouped.alterTable || [];
  for (var i = 0, l = alterTable.length; i < l; i++) {
    var statement = alterTable[i];
    if (this[statement.method]) {
      this[statement.method].apply(this, statement.args);
    } else {
      helpers.error('Debug: ' + statement.method + ' does not exist');
    }
  }
  for (var item in this.single) {
    if (typeof this[item] === 'function') this[item](this.single[item]);
  }
};

TableCompiler.prototype.alterTableForCreate = function (columnTypes) {
  this.forCreate = true;
  var savedSequence = this.sequence;
  var alterTable = this.grouped.alterTable || [];
  this.grouped.alterTable = [];
  for (var i = 0, l = alterTable.length; i < l; i++) {
    var statement = alterTable[i];
    if (_indexOf(this.createAlterTableMethods, statement.method) < 0) {
      this.grouped.alterTable.push(statement);
      continue;
    }
    if (this[statement.method]) {
      this.sequence = [];
      this[statement.method].apply(this, statement.args);
      columnTypes.sql.push(this.sequence[0].sql);
    } else {
      helpers.error('Debug: ' + statement.method + ' does not exist');
    }
  }
  this.sequence = savedSequence;
  this.forCreate = false;
};

// Drop the index on the current table.
TableCompiler.prototype.dropIndex = function (value) {
  this.pushQuery('drop index' + value);
};

// Drop the unique
TableCompiler.prototype.dropUnique = TableCompiler.prototype.dropForeign = function () {
  throw new Error('Method implemented in the dialect driver');
};

TableCompiler.prototype.dropColumnPrefix = 'drop column ';
TableCompiler.prototype.dropColumn = function () {
  var _this2 = this;

  var columns = helpers.normalizeArr.apply(null, arguments);
  var drops = _map(_isArray(columns) ? columns : [columns], function (column) {
    return _this2.dropColumnPrefix + _this2.formatter.wrap(column);
  });
  this.pushQuery((this.lowerCase ? 'alter table ' : 'ALTER TABLE ') + this.tableName() + ' ' + drops.join(', '));
};

// If no name was specified for this index, we will create one using a basic
// convention of the table name, followed by the columns, followed by an
// index type, such as primary or index, which makes the index unique.
TableCompiler.prototype._indexCommand = function (type, tableName, columns) {
  if (!_isArray(columns)) columns = columns ? [columns] : [];
  var table = tableName.replace(/\.|-/g, '_');
  var indexName = (table + '_' + columns.join('_') + '_' + type).toLowerCase();
  return this.formatter.wrap(indexName);
};

export default TableCompiler;
module.exports = exports['default'];