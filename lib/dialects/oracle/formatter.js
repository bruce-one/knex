import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import Formatter from '../../formatter';
import { ReturningHelper } from './utils';

var Oracle_Formatter = function (_Formatter) {
  _inherits(Oracle_Formatter, _Formatter);

  function Oracle_Formatter() {
    _classCallCheck(this, Oracle_Formatter);

    return _possibleConstructorReturn(this, _Formatter.apply(this, arguments));
  }

  Oracle_Formatter.prototype.alias = function alias(first, second) {
    return first + ' ' + second;
  };

  Oracle_Formatter.prototype.parameter = function parameter(value, notSetValue) {
    // Returning helper uses always ROWID as string
    if (value instanceof ReturningHelper && this.client.driver) {
      value = new this.client.driver.OutParam(this.client.driver.OCCISTRING);
    } else if (typeof value === 'boolean') {
      value = value ? 1 : 0;
    }
    return _Formatter.prototype.parameter.call(this, value, notSetValue);
  };

  return Oracle_Formatter;
}(Formatter);

export default Oracle_Formatter;
module.exports = exports['default'];