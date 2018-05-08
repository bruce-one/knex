import _isArray from 'lodash/isArray';
import _assign from 'lodash/assign';

import Promise from 'bluebird';
import * as helpers from './helpers';

var PassThrough = void 0;

// The "Runner" constructor takes a "builder" (query, schema, or raw)
// and runs through each of the query statements, calling any additional
// "output" method provided alongside the query and bindings.
function Runner(client, builder) {
  this.client = client;
  this.builder = builder;
  this.queries = [];

  // The "connection" object is set on the runner when
  // "run" is called.
  this.connection = void 0;
}

_assign(Runner.prototype, {

  // "Run" the target, calling "toSQL" on the builder, returning
  // an object or array of queries to run, each of which are run on
  // a single connection.
  run: function run() {
    var runner = this;
    return Promise.using(this.ensureConnection(), function (connection) {
      runner.connection = connection;

      runner.client.emit('start', runner.builder);
      runner.builder.emit('start', runner.builder);
      var sql = runner.builder.toSQL();

      if (runner.builder._debug) {
        helpers.debugLog(sql);
      }

      if (_isArray(sql)) {
        return runner.queryArray(sql);
      }
      return runner.query(sql);
    })

    // If there are any "error" listeners, we fire an error event
    // and then re-throw the error to be eventually handled by
    // the promise chain. Useful if you're wrapping in a custom `Promise`.
    .catch(function (err) {
      if (runner.builder._events && runner.builder._events.error) {
        runner.builder.emit('error', err);
      }
      throw err;
    })

    // Fire a single "end" event on the builder when
    // all queries have successfully completed.
    .tap(function () {
      runner.builder.emit('end');
    });
  },


  // Stream the result set, by passing through to the dialect's streaming
  // capabilities. If the options are
  stream: function stream(options, handler) {

    // If we specify stream(handler).then(...
    if (arguments.length === 1) {
      if (typeof options === 'function') {
        handler = options;
        options = {};
      }
    }

    // Determines whether we emit an error or throw here.
    var hasHandler = typeof handler === 'function';

    // Lazy-load the "PassThrough" dependency.
    PassThrough = PassThrough || require('readable-stream').PassThrough;

    var runner = this;
    var stream = new PassThrough({ objectMode: true });

    var hasConnection = false;
    var promise = Promise.using(this.ensureConnection(), function (connection) {
      hasConnection = true;
      runner.connection = connection;
      var sql = runner.builder.toSQL();
      var err = new Error('The stream may only be used with a single query statement.');
      if (_isArray(sql)) {
        if (hasHandler) throw err;
        stream.emit('error', err);
      }
      return runner.client.stream(runner.connection, sql, stream, options);
    });

    // If a function is passed to handle the stream, send the stream
    // there and return the promise, otherwise just return the stream
    // and the promise will take care of itsself.
    if (hasHandler) {
      handler(stream);
      return promise;
    }

    // Emit errors on the stream if the error occurred before a connection
    // could be acquired.
    // If the connection was acquired, assume the error occured in the client
    // code and has already been emitted on the stream. Don't emit it twice.
    promise.catch(function (err) {
      if (!hasConnection) stream.emit('error', err);
    });
    return stream;
  },


  // Allow you to pipe the stream to a writable stream.
  pipe: function pipe(writable, options) {
    return this.stream(options).pipe(writable);
  },


  // "Runs" a query, returning a promise. All queries specified by the builder are guaranteed
  // to run in sequence, and on the same connection, especially helpful when schema building
  // and dealing with foreign key constraints, etc.
  query: Promise.method(function (obj) {
    var _this = this;

    var _connection = this.connection,
        __knexUid = _connection.__knexUid,
        __knexTxId = _connection.__knexTxId;


    this.builder.emit('query', _assign({ __knexUid: __knexUid, __knexTxId: __knexTxId }, obj));

    var runner = this;
    var queryPromise = this.client.query(this.connection, obj);

    if (obj.timeout) {
      queryPromise = queryPromise.timeout(obj.timeout);
    }

    return queryPromise.then(function (resp) {
      var processedResponse = _this.client.processResponse(resp, runner);
      var queryContext = _this.builder.queryContext();
      var postProcessedResponse = _this.client.postProcessResponse(processedResponse, queryContext);

      _this.builder.emit('query-response', postProcessedResponse, _assign({ __knexUid: _this.connection.__knexUid }, obj), _this.builder);

      _this.client.emit('query-response', postProcessedResponse, _assign({ __knexUid: _this.connection.__knexUid }, obj), _this.builder);

      return postProcessedResponse;
    }).catch(Promise.TimeoutError, function (error) {
      var timeout = obj.timeout,
          sql = obj.sql,
          bindings = obj.bindings;


      var cancelQuery = void 0;
      if (obj.cancelOnTimeout) {
        cancelQuery = _this.client.cancelQuery(_this.connection);
      } else {
        // If we don't cancel the query, we need to mark the connection as disposed so that
        // it gets destroyed by the pool and is never used again. If we don't do this and
        // return the connection to the pool, it will be useless until the current operation
        // that timed out, finally finishes.
        _this.connection.__knex__disposed = error;
        cancelQuery = Promise.resolve();
      }

      return cancelQuery.catch(function (cancelError) {
        // If the cancellation failed, we need to mark the connection as disposed so that
        // it gets destroyed by the pool and is never used again. If we don't do this and
        // return the connection to the pool, it will be useless until the current operation
        // that timed out, finally finishes.
        _this.connection.__knex__disposed = error;

        // cancellation failed
        throw _assign(cancelError, {
          message: 'After query timeout of ' + timeout + 'ms exceeded, cancelling of query failed.',
          sql: sql, bindings: bindings, timeout: timeout
        });
      }).then(function () {
        // cancellation succeeded, rethrow timeout error
        throw _assign(error, {
          message: 'Defined query timeout of ' + timeout + 'ms exceeded when running query.',
          sql: sql, bindings: bindings, timeout: timeout
        });
      });
    }).catch(function (error) {
      _this.builder.emit('query-error', error, _assign({ __knexUid: _this.connection.__knexUid }, obj));
      throw error;
    });
  }),

  // In the case of the "schema builder" we call `queryArray`, which runs each
  // of the queries in sequence.
  queryArray: function queryArray(queries) {
    return queries.length === 1 ? this.query(queries[0]) : Promise.bind(this).return(queries).reduce(function (memo, query) {
      return this.query(query).then(function (resp) {
        memo.push(resp);
        return memo;
      });
    }, []);
  },


  // Check whether there's a transaction flag, and that it has a connection.
  ensureConnection: function ensureConnection() {
    var _this2 = this;

    if (this.connection) {
      return Promise.resolve(this.connection);
    }
    return this.client.acquireConnection().catch(Promise.TimeoutError, function (error) {
      if (_this2.builder) {
        error.sql = _this2.builder.sql;
        error.bindings = _this2.builder.bindings;
      }
      throw error;
    }).disposer(function () {
      // need to return promise or null from handler to prevent warning from bluebird
      return _this2.client.releaseConnection(_this2.connection);
    });
  }
});

export default Runner;
module.exports = exports['default'];