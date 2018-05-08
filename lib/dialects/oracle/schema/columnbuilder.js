import _toArray from 'lodash/toArray';

import inherits from 'inherits';
import ColumnBuilder from '../../../schema/columnbuilder';

function ColumnBuilder_Oracle() {
  ColumnBuilder.apply(this, arguments);
}
inherits(ColumnBuilder_Oracle, ColumnBuilder);

// checkIn added to the builder to allow the column compiler to change the
// order via the modifiers ("check" must be after "default")
ColumnBuilder_Oracle.prototype.checkIn = function () {
  this._modifiers.checkIn = _toArray(arguments);
  return this;
};

export default ColumnBuilder_Oracle;
module.exports = exports['default'];