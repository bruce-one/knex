import _getIterator from 'babel-runtime/core-js/get-iterator';
import _typeof from 'babel-runtime/helpers/typeof';
import _has from 'lodash/has';
/* eslint max-len: 0 */

// Redshift Table Builder & Compiler
// -------

import { warn } from '../../../helpers';
import inherits from 'inherits';

import TableCompiler_PG from '../../postgres/schema/tablecompiler';

function TableCompiler_Redshift() {
  TableCompiler_PG.apply(this, arguments);
}
inherits(TableCompiler_Redshift, TableCompiler_PG);

TableCompiler_Redshift.prototype.index = function (columns, indexName, indexType) {
  warn('Redshift does not support the creation of indexes.');
};

TableCompiler_Redshift.prototype.dropIndex = function (columns, indexName) {
  warn('Redshift does not support the deletion of indexes.');
};

// TODO: have to disable setting not null on columns that already exist...

// Adds the "create" query to the query sequence.
TableCompiler_Redshift.prototype.createQuery = function (columns, ifNot) {
  var createStatement = ifNot ? 'create table if not exists ' : 'create table ';
  var sql = createStatement + this.tableName() + ' (' + columns.sql.join(', ') + ')';
  if (this.single.inherits) sql += ' like (' + this.formatter.wrap(this.single.inherits) + ')';
  this.pushQuery({
    sql: sql,
    bindings: columns.bindings
  });
  var hasComment = _has(this.single, 'comment');
  if (hasComment) this.comment(this.single.comment);
};

TableCompiler_Redshift.prototype.primary = function (columns, constraintName) {
  var self = this;
  constraintName = constraintName ? self.formatter.wrap(constraintName) : self.formatter.wrap(this.tableNameRaw + '_pkey');
  if (columns.constructor !== Array) {
    columns = [columns];
  }
  var thiscolumns = self.grouped.columns;

  if (thiscolumns) {
    var _loop = function _loop(i) {
      var exists = thiscolumns.find(function (tcb) {
        return tcb.grouping === "columns" && tcb.builder && tcb.builder._method === "add" && tcb.builder._args && tcb.builder._args.indexOf(columns[i]) > -1;
      });
      if (exists) {
        exists = exists.builder;
      }
      var nullable = !(exists && exists._modifiers && exists._modifiers["nullable"] && exists._modifiers["nullable"][0] === false);
      if (nullable) {
        if (exists) {
          return {
            v: warn("Redshift does not allow primary keys to contain nullable columns.")
          };
        } else {
          return {
            v: warn("Redshift does not allow primary keys to contain nonexistent columns.")
          };
        }
      }
    };

    for (var i = 0; i < columns.length; i++) {
      var _ret = _loop(i);

      if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
    }
  }
  return self.pushQuery('alter table ' + self.tableName() + ' add constraint ' + constraintName + ' primary key (' + self.formatter.columnize(columns) + ')');
};

// Compiles column add. Redshift can only add one column per ALTER TABLE, so core addColumns doesn't work.  #2545
TableCompiler_Redshift.prototype.addColumns = function (columns, prefix, colCompilers) {
  if (prefix === this.alterColumnsPrefix) {
    TableCompiler_PG.prototype.addColumns.call(this, columns, prefix, colCompilers);
  } else {
    prefix = prefix || this.addColumnsPrefix;
    colCompilers = colCompilers || this.getColumns();
    for (var _iterator = colCompilers, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _getIterator(_iterator);;) {
      var _ref;

      if (_isArray) {
        if (_i >= _iterator.length) break;
        _ref = _iterator[_i++];
      } else {
        _i = _iterator.next();
        if (_i.done) break;
        _ref = _i.value;
      }

      var col = _ref;

      var quotedTableName = this.tableName();
      var colCompiled = col.compileColumn();

      this.pushQuery({
        sql: 'alter table ' + quotedTableName + ' ' + prefix + colCompiled,
        bindings: []
      });
    }
  }
};

export default TableCompiler_Redshift;
module.exports = exports['default'];