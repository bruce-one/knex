import _assign from 'lodash/assign';

// MySQL Column Compiler
// -------
import inherits from 'inherits';
import ColumnCompiler from '../../../schema/columncompiler';
import * as helpers from '../../../helpers';

function ColumnCompiler_MSSQL() {
  ColumnCompiler.apply(this, arguments);
  this.modifiers = ['nullable', 'defaultTo', 'first', 'after', 'comment'];
}
inherits(ColumnCompiler_MSSQL, ColumnCompiler);

// Types
// ------

_assign(ColumnCompiler_MSSQL.prototype, {

  increments: 'int identity(1,1) not null primary key',

  bigincrements: 'bigint identity(1,1) not null primary key',

  bigint: 'bigint',

  double: function double(precision, scale) {
    if (!precision) return 'decimal';
    return 'decimal(' + this._num(precision, 8) + ', ' + this._num(scale, 2) + ')';
  },
  floating: function floating(precision, scale) {
    if (!precision) return 'decimal';
    return 'decimal(' + this._num(precision, 8) + ', ' + this._num(scale, 2) + ')';
  },
  integer: function integer(length) {
    length = length ? '(' + this._num(length, 11) + ')' : '';
    return 'int' + length;
  },


  mediumint: 'int',

  smallint: 'smallint',

  tinyint: function tinyint(length) {
    length = length ? '(' + this._num(length, 1) + ')' : '';
    return 'tinyint' + length;
  },
  varchar: function varchar(length) {
    return 'nvarchar(' + this._num(length, 255) + ')';
  },


  text: 'nvarchar(max)',

  mediumtext: 'nvarchar(max)',

  longtext: 'nvarchar(max)',

  // TODO: mssql supports check constraints as of SQL Server 2008
  // so make enu here more like postgres
  enu: 'nvarchar(100)',

  uuid: 'uniqueidentifier',

  datetime: 'datetime',

  timestamp: 'datetime',

  bit: function bit(length) {
    if (length > 1) {
      helpers.warn('Bit field is exactly 1 bit length for MSSQL');
    }
    return 'bit';
  },
  binary: function binary(length) {
    return length ? 'varbinary(' + this._num(length) + ')' : 'varbinary(max)';
  },


  bool: 'bit',

  // Modifiers
  // ------

  defaultTo: function defaultTo(value) {
    var defaultVal = ColumnCompiler_MSSQL.super_.prototype.defaultTo.apply(this, arguments);
    if (this.type !== 'blob' && this.type.indexOf('text') === -1) {
      return defaultVal;
    }
    return '';
  },
  first: function first() {
    helpers.warn('Column first modifier not available for MSSQL');
    return '';
  },
  after: function after(column) {
    helpers.warn('Column after modifier not available for MSSQL');
    return '';
  },
  comment: function comment(_comment) {
    if (_comment && _comment.length > 255) {
      helpers.warn('Your comment is longer than the max comment length for MSSQL');
    }
    return '';
  }
});

export default ColumnCompiler_MSSQL;
module.exports = exports['default'];