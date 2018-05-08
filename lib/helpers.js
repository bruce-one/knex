import _isTypedArray from 'lodash/isTypedArray';
import _isArray from 'lodash/isArray';
import _isPlainObject from 'lodash/isPlainObject';
import _isUndefined from 'lodash/isUndefined';
import _isFunction from 'lodash/isFunction';
import _keys from 'lodash/keys';
import _pick from 'lodash/pick';
import _map from 'lodash/map'; /* eslint no-console:0 */

import chalk from 'chalk';

// Pick off the attributes from only the current layer of the object.
export function skim(data) {
  return _map(data, function (obj) {
    return _pick(obj, _keys(obj));
  });
}

// Check if the first argument is an array, otherwise uses all arguments as an
// array.
export function normalizeArr() {
  var args = new Array(arguments.length);
  for (var i = 0; i < args.length; i++) {
    args[i] = arguments[i];
  }
  if (Array.isArray(args[0])) {
    return args[0];
  }
  return args;
}

export function debugLog(msg) {
  console.log(msg);
}

export function error(msg) {
  console.log(chalk.red('Knex:Error ' + msg));
}

// Used to signify deprecated functionality.
export function deprecate(method, alternate) {
  warn(method + ' is deprecated, please use ' + alternate);
}

// Used to warn about incorrect use, without error'ing
export function warn(msg) {
  console.log(chalk.yellow('Knex:warning - ' + msg));
}

export function exit(msg) {
  console.log(chalk.red(msg));
  process.exit(1);
}

export function containsUndefined(mixed) {
  var argContainsUndefined = false;

  if (_isTypedArray(mixed)) return false;

  if (mixed && _isFunction(mixed.toSQL)) {
    //Any QueryBuilder or Raw will automatically be validated during compile.
    return argContainsUndefined;
  }

  if (_isArray(mixed)) {
    for (var i = 0; i < mixed.length; i++) {
      if (argContainsUndefined) break;
      argContainsUndefined = this.containsUndefined(mixed[i]);
    }
  } else if (_isPlainObject(mixed)) {
    for (var key in mixed) {
      if (mixed.hasOwnProperty(key)) {
        if (argContainsUndefined) break;
        argContainsUndefined = this.containsUndefined(mixed[key]);
      }
    }
  } else {
    argContainsUndefined = _isUndefined(mixed);
  }

  return argContainsUndefined;
}

export function addQueryContext(Target) {
  // Stores or returns (if called with no arguments) context passed to
  // wrapIdentifier and postProcessResponse hooks
  Target.prototype.queryContext = function (context) {
    if (_isUndefined(context)) {
      return this._queryContext;
    }
    this._queryContext = context;
    return this;
  };
}