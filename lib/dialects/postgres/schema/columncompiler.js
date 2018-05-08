import _assign from 'lodash/assign';

// PostgreSQL Column Compiler
// -------

import inherits from 'inherits';
import ColumnCompiler from '../../../schema/columncompiler';
import * as helpers from '../../../helpers';

function ColumnCompiler_PG() {
  ColumnCompiler.apply(this, arguments);
  this.modifiers = ['nullable', 'defaultTo', 'comment'];
}
inherits(ColumnCompiler_PG, ColumnCompiler);

_assign(ColumnCompiler_PG.prototype, {

  // Types
  // ------
  bigincrements: 'bigserial primary key',
  bigint: 'bigint',
  binary: 'bytea',

  bit: function bit(column) {
    return column.length !== false ? 'bit(' + column.length + ')' : 'bit';
  },


  bool: 'boolean',

  // Create the column definition for an enum type.
  // Using method "2" here: http://stackoverflow.com/a/10984951/525714
  enu: function enu(allowed) {
    return 'text check (' + this.formatter.wrap(this.args[0]) + ' in (\'' + allowed.join("', '") + '\'))';
  },


  double: 'double precision',
  decimal: function decimal(precision, scale) {
    if (precision === null) return 'decimal';
    return 'decimal(' + this._num(precision, 8) + ', ' + this._num(scale, 2) + ')';
  },

  floating: 'real',
  increments: 'serial primary key',
  json: function json(jsonb) {
    if (jsonb) helpers.deprecate('json(true)', 'jsonb()');
    return jsonColumn(this.client, jsonb);
  },
  jsonb: function jsonb() {
    return jsonColumn(this.client, true);
  },

  smallint: 'smallint',
  tinyint: 'smallint',
  datetime: function datetime(without) {
    return without ? 'timestamp' : 'timestamptz';
  },
  timestamp: function timestamp(without) {
    return without ? 'timestamp' : 'timestamptz';
  },

  uuid: 'uuid',

  // Modifiers:
  // ------
  comment: function comment(_comment) {
    var columnName = this.args[0] || this.defaults('columnName');

    this.pushAdditional(function () {
      this.pushQuery('comment on column ' + this.tableCompiler.tableName() + '.' + this.formatter.wrap(columnName) + " is " + (_comment ? '\'' + _comment + '\'' : 'NULL'));
    }, _comment);
  }
});

function jsonColumn(client, jsonb) {
  if (!client.version || parseFloat(client.version) >= 9.2) return jsonb ? 'jsonb' : 'json';
  return 'text';
}

export default ColumnCompiler_PG;
module.exports = exports['default'];