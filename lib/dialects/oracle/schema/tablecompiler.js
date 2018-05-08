import _map from 'lodash/map';
import _assign from 'lodash/assign';
/* eslint max-len:0 */

import inherits from 'inherits';
import * as utils from '../utils';
import TableCompiler from '../../../schema/tablecompiler';
import * as helpers from '../../../helpers';
import Trigger from './trigger';

// Table Compiler
// ------

function TableCompiler_Oracle() {
  TableCompiler.apply(this, arguments);
}
inherits(TableCompiler_Oracle, TableCompiler);

_assign(TableCompiler_Oracle.prototype, {
  addColumns: function addColumns(columns, prefix) {
    if (columns.sql.length > 0) {
      prefix = prefix || this.addColumnsPrefix;

      var columnSql = _map(columns.sql, function (column) {
        return column;
      });
      var alter = this.lowerCase ? 'alter table ' : 'ALTER TABLE ';

      var sql = '' + alter + this.tableName() + ' ' + prefix;
      if (columns.sql.length > 1) {
        sql += '(' + columnSql.join(', ') + ')';
      } else {
        sql += columnSql.join(', ');
      }

      this.pushQuery({
        sql: sql,
        bindings: columns.bindings
      });
    }
  },


  // Compile a rename column command.
  renameColumn: function renameColumn(from, to) {
    // Remove quotes around tableName
    var tableName = this.tableName().slice(1, -1);
    return this.pushQuery(Trigger.renameColumnTrigger(tableName, from, to));
  },
  compileAdd: function compileAdd(builder) {
    var table = this.formatter.wrap(builder);
    var columns = this.prefixArray('add column', this.getColumns(builder));
    return this.pushQuery({
      sql: 'alter table ' + table + ' ' + columns.join(', ')
    });
  },


  // Adds the "create" query to the query sequence.
  createQuery: function createQuery(columns, ifNot) {
    var sql = 'create table ' + this.tableName() + ' (' + columns.sql.join(', ') + ')';
    this.pushQuery({
      // catch "name is already used by an existing object" for workaround for "if not exists"
      sql: ifNot ? utils.wrapSqlWithCatch(sql, -955) : sql,
      bindings: columns.bindings
    });
    if (this.single.comment) this.comment(this.single.comment);
  },


  // Compiles the comment on the table.
  comment: function comment(_comment) {
    this.pushQuery('comment on table ' + this.tableName() + ' is \'' + _comment + '\'');
  },


  addColumnsPrefix: 'add ',

  alterColumnsPrefix: 'modify ',

  dropColumn: function dropColumn() {
    var columns = helpers.normalizeArr.apply(null, arguments);
    this.pushQuery('alter table ' + this.tableName() + ' drop (' + this.formatter.columnize(columns) + ')');
  },
  changeType: function changeType() {
    // alter table + table + ' modify ' + wrapped + '// type';
  },
  _indexCommand: function _indexCommand(type, tableName, columns) {
    return this.formatter.wrap(utils.generateCombinedName(type, tableName, columns));
  },
  primary: function primary(columns, constraintName) {
    constraintName = constraintName ? this.formatter.wrap(constraintName) : this.formatter.wrap(this.tableNameRaw + '_pkey');
    this.pushQuery('alter table ' + this.tableName() + ' add constraint ' + constraintName + ' primary key (' + this.formatter.columnize(columns) + ')');
  },
  dropPrimary: function dropPrimary(constraintName) {
    constraintName = constraintName ? this.formatter.wrap(constraintName) : this.formatter.wrap(this.tableNameRaw + '_pkey');
    this.pushQuery('alter table ' + this.tableName() + ' drop constraint ' + constraintName);
  },
  index: function index(columns, indexName) {
    indexName = indexName ? this.formatter.wrap(indexName) : this._indexCommand('index', this.tableNameRaw, columns);
    this.pushQuery('create index ' + indexName + ' on ' + this.tableName() + ' (' + this.formatter.columnize(columns) + ')');
  },
  dropIndex: function dropIndex(columns, indexName) {
    indexName = indexName ? this.formatter.wrap(indexName) : this._indexCommand('index', this.tableNameRaw, columns);
    this.pushQuery('drop index ' + indexName);
  },
  unique: function unique(columns, indexName) {
    indexName = indexName ? this.formatter.wrap(indexName) : this._indexCommand('unique', this.tableNameRaw, columns);
    this.pushQuery('alter table ' + this.tableName() + ' add constraint ' + indexName + ' unique (' + this.formatter.columnize(columns) + ')');
  },
  dropUnique: function dropUnique(columns, indexName) {
    indexName = indexName ? this.formatter.wrap(indexName) : this._indexCommand('unique', this.tableNameRaw, columns);
    this.pushQuery('alter table ' + this.tableName() + ' drop constraint ' + indexName);
  },
  dropForeign: function dropForeign(columns, indexName) {
    indexName = indexName ? this.formatter.wrap(indexName) : this._indexCommand('foreign', this.tableNameRaw, columns);
    this.pushQuery('alter table ' + this.tableName() + ' drop constraint ' + indexName);
  }
});

export default TableCompiler_Oracle;
module.exports = exports['default'];