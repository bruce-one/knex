import _JSON$stringify from 'babel-runtime/core-js/json/stringify';
import _isObject from 'lodash/isObject';
import _has from 'lodash/has';
import _tail from 'lodash/tail';
import _first from 'lodash/first';
import _groupBy from 'lodash/groupBy';

// Column Compiler
// Used for designating column definitions
// during the table "create" / "alter" statements.
// -------
import Raw from '../raw';
import * as helpers from './helpers';


function ColumnCompiler(client, tableCompiler, columnBuilder) {
  this.client = client;
  this.tableCompiler = tableCompiler;
  this.columnBuilder = columnBuilder;
  this.args = columnBuilder._args;
  this.type = columnBuilder._type.toLowerCase();
  this.grouped = _groupBy(columnBuilder._statements, 'grouping');
  this.modified = columnBuilder._modifiers;
  this.isIncrements = this.type.indexOf('increments') !== -1;
  this.formatter = client.formatter(columnBuilder);
  this.sequence = [];
  this.modifiers = [];
}

ColumnCompiler.prototype.pushQuery = function () {
  var _pushQuery;

  for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }

  (_pushQuery = pushQuery).call.apply(_pushQuery, [this].concat(args));
};

ColumnCompiler.prototype.pushAdditional = function () {
  var _pushAdditional;

  for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
    args[_key2] = arguments[_key2];
  }

  (_pushAdditional = pushAdditional).call.apply(_pushAdditional, [this].concat(args));
};

ColumnCompiler.prototype._defaultMap = {
  'columnName': function columnName() {
    if (!this.isIncrements) {
      throw new Error('You did not specify a column name for the ' + this.type + ' column.');
    }
    return 'id';
  }
};

ColumnCompiler.prototype.defaults = function (label) {
  if (this._defaultMap.hasOwnProperty(label)) {
    return this._defaultMap[label].bind(this)();
  } else {
    throw new Error('There is no default for the specified identifier ' + label);
  }
};

// To convert to sql, we first go through and build the
// column as it would be in the insert statement
ColumnCompiler.prototype.toSQL = function () {
  this.pushQuery(this.compileColumn());
  if (this.sequence.additional) {
    this.sequence = this.sequence.concat(this.sequence.additional);
  }
  return this.sequence;
};

// Compiles a column.
ColumnCompiler.prototype.compileColumn = function () {
  return this.formatter.wrap(this.getColumnName()) + ' ' + this.getColumnType() + this.getModifiers();
};

// Assumes the autoincrementing key is named `id` if not otherwise specified.
ColumnCompiler.prototype.getColumnName = function () {
  var value = _first(this.args);
  return value || this.defaults('columnName');
};

ColumnCompiler.prototype.getColumnType = function () {
  var type = this[this.type];
  return typeof type === 'function' ? type.apply(this, _tail(this.args)) : type;
};

ColumnCompiler.prototype.getModifiers = function () {
  var modifiers = [];

  for (var i = 0, l = this.modifiers.length; i < l; i++) {
    var modifier = this.modifiers[i];

    //Cannot allow 'nullable' modifiers on increments types
    if (!this.isIncrements || this.isIncrements && modifier === 'comment') {
      if (_has(this.modified, modifier)) {
        var val = this[modifier].apply(this, this.modified[modifier]);
        if (val) modifiers.push(val);
      }
    }
  }

  return modifiers.length > 0 ? ' ' + modifiers.join(' ') : '';
};

// Types
// ------

ColumnCompiler.prototype.increments = 'integer not null primary key autoincrement';
ColumnCompiler.prototype.bigincrements = 'integer not null primary key autoincrement';
ColumnCompiler.prototype.integer = ColumnCompiler.prototype.smallint = ColumnCompiler.prototype.mediumint = 'integer';
ColumnCompiler.prototype.biginteger = 'bigint';
ColumnCompiler.prototype.varchar = function (length) {
  return 'varchar(' + this._num(length, 255) + ')';
};
ColumnCompiler.prototype.text = 'text';
ColumnCompiler.prototype.tinyint = 'tinyint';
ColumnCompiler.prototype.floating = function (precision, scale) {
  return 'float(' + this._num(precision, 8) + ', ' + this._num(scale, 2) + ')';
};
ColumnCompiler.prototype.decimal = function (precision, scale) {
  if (precision === null) {
    throw new Error('Specifying no precision on decimal columns is not supported for that SQL dialect.');
  }
  return 'decimal(' + this._num(precision, 8) + ', ' + this._num(scale, 2) + ')';
};
ColumnCompiler.prototype.binary = 'blob';
ColumnCompiler.prototype.bool = 'boolean';
ColumnCompiler.prototype.date = 'date';
ColumnCompiler.prototype.datetime = 'datetime';
ColumnCompiler.prototype.time = 'time';
ColumnCompiler.prototype.timestamp = 'timestamp';
ColumnCompiler.prototype.enu = 'varchar';

ColumnCompiler.prototype.bit = ColumnCompiler.prototype.json = 'text';

ColumnCompiler.prototype.uuid = 'char(36)';
ColumnCompiler.prototype.specifictype = function (type) {
  return type;
};

// Modifiers
// -------

ColumnCompiler.prototype.nullable = function (nullable) {
  return nullable === false ? 'not null' : 'null';
};
ColumnCompiler.prototype.notNullable = function () {
  return this.nullable(false);
};
ColumnCompiler.prototype.defaultTo = function (value) {
  if (value === void 0) {
    return '';
  } else if (value === null) {
    value = "null";
  } else if (value instanceof Raw) {
    value = value.toQuery();
  } else if (this.type === 'bool') {
    if (value === 'false') value = 0;
    value = '\'' + (value ? 1 : 0) + '\'';
  } else if (this.type === 'json' && _isObject(value)) {
    return _JSON$stringify(value);
  } else {
    value = '\'' + value + '\'';
  }
  return 'default ' + value;
};
ColumnCompiler.prototype._num = function (val, fallback) {
  if (val === undefined || val === null) return fallback;
  var number = parseInt(val, 10);
  return isNaN(number) ? fallback : number;
};

export default ColumnCompiler;
module.exports = exports['default'];