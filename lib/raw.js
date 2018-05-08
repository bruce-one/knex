import _isNumber from 'lodash/isNumber';
import _isUndefined from 'lodash/isUndefined';
import _isObject from 'lodash/isObject';
import _isPlainObject from 'lodash/isPlainObject';
import _reduce from 'lodash/reduce';
import _assign from 'lodash/assign';

// Raw
// -------
import inherits from 'inherits';
import * as helpers from './helpers';
import { EventEmitter } from 'events';
import debug from 'debug';

import Formatter from './formatter';

import uuid from 'uuid';

var debugBindings = debug('knex:bindings');

var fakeClient = {
  formatter: function formatter(builder) {
    return new Formatter(fakeClient, builder);
  }
};

function Raw() {
  var client = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : fakeClient;

  this.client = client;

  this.sql = '';
  this.bindings = [];

  // Todo: Deprecate
  this._wrappedBefore = undefined;
  this._wrappedAfter = undefined;
  this._debug = client && client.config && client.config.debug;
}
inherits(Raw, EventEmitter);

_assign(Raw.prototype, {
  set: function set(sql, bindings) {
    this.sql = sql;
    this.bindings = _isObject(bindings) && !bindings.toSQL || _isUndefined(bindings) ? bindings : [bindings];

    return this;
  },
  timeout: function timeout(ms) {
    var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
        cancel = _ref.cancel;

    if (_isNumber(ms) && ms > 0) {
      this._timeout = ms;
      if (cancel) {
        this.client.assertCanCancelQuery();
        this._cancelOnTimeout = true;
      }
    }
    return this;
  },


  // Wraps the current sql with `before` and `after`.
  wrap: function wrap(before, after) {
    this._wrappedBefore = before;
    this._wrappedAfter = after;
    return this;
  },


  // Calls `toString` on the Knex object.
  toString: function toString() {
    return this.toQuery();
  },


  // Returns the raw sql for the query.
  toSQL: function toSQL(method, tz) {
    var obj = void 0;
    var formatter = this.client.formatter(this);

    if (Array.isArray(this.bindings)) {
      obj = replaceRawArrBindings(this, formatter);
    } else if (this.bindings && _isPlainObject(this.bindings)) {
      obj = replaceKeyBindings(this, formatter);
    } else {
      obj = {
        method: 'raw',
        sql: this.sql,
        bindings: _isUndefined(this.bindings) ? [] : [this.bindings]
      };
    }

    if (this._wrappedBefore) {
      obj.sql = this._wrappedBefore + obj.sql;
    }
    if (this._wrappedAfter) {
      obj.sql = obj.sql + this._wrappedAfter;
    }

    obj.options = _reduce(this._options, _assign, {});

    if (this._timeout) {
      obj.timeout = this._timeout;
      if (this._cancelOnTimeout) {
        obj.cancelOnTimeout = this._cancelOnTimeout;
      }
    }

    obj.bindings = obj.bindings || [];
    if (helpers.containsUndefined(obj.bindings)) {
      debugBindings(obj.bindings);
      throw new Error('Undefined binding(s) detected when compiling RAW query: ' + obj.sql);
    }

    obj.__knexQueryUid = uuid.v4();

    return obj;
  }
});

function replaceRawArrBindings(raw, formatter) {
  var expectedBindings = raw.bindings.length;
  var values = raw.bindings;
  var index = 0;

  var sql = raw.sql.replace(/\\?\?\??/g, function (match) {
    if (match === '\\?') {
      return match;
    }

    var value = values[index++];

    if (match === '??') {
      return formatter.columnize(value);
    }
    return formatter.parameter(value);
  });

  if (expectedBindings !== index) {
    throw new Error('Expected ' + expectedBindings + ' bindings, saw ' + index);
  }

  return {
    method: 'raw',
    sql: sql,
    bindings: formatter.bindings
  };
}

function replaceKeyBindings(raw, formatter) {
  var values = raw.bindings;
  var sql = raw.sql;


  var regex = /\\?(:(\w+):(?=::)|:(\w+):(?!:)|:(\w+))/g;
  sql = raw.sql.replace(regex, function (match, p1, p2, p3, p4) {
    if (match !== p1) {
      return p1;
    }

    var part = p2 || p3 || p4;
    var key = match.trim();
    var isIdentifier = key[key.length - 1] === ':';
    var value = values[part];

    if (value === undefined) {
      if (values.hasOwnProperty(part)) {
        formatter.bindings.push(value);
      }

      return match;
    }

    if (isIdentifier) {
      return match.replace(p1, formatter.columnize(value));
    }

    return match.replace(p1, formatter.parameter(value));
  });

  return {
    method: 'raw',
    sql: sql,
    bindings: formatter.bindings
  };
}

// Allow the `Raw` object to be utilized with full access to the relevant
// promise API.
require('./interface')(Raw);
helpers.addQueryContext(Raw);

export default Raw;
module.exports = exports['default'];