import _typeof from 'babel-runtime/helpers/typeof';
import _assign from 'lodash/assign';
import _flatten from 'lodash/flatten';
import _chunk from 'lodash/chunk';
import _isArray from 'lodash/isArray';
import _isNumber from 'lodash/isNumber';

import Promise from 'bluebird';

export default function batchInsert(client, tableName, batch) {
  var chunkSize = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 1000;


  var _returning = void 0;
  var autoTransaction = true;
  var transaction = null;

  var getTransaction = function getTransaction() {
    return new Promise(function (resolve, reject) {
      if (transaction) {
        autoTransaction = false;
        return resolve(transaction);
      }

      autoTransaction = true;
      client.transaction(resolve).catch(reject);
    });
  };

  var wrapper = _assign(new Promise(function (resolve, reject) {
    var chunks = _chunk(batch, chunkSize);

    if (!_isNumber(chunkSize) || chunkSize < 1) {
      return reject(new TypeError('Invalid chunkSize: ' + chunkSize));
    }

    if (!_isArray(batch)) {
      return reject(new TypeError('Invalid batch: Expected array, got ' + (typeof batch === 'undefined' ? 'undefined' : _typeof(batch))));
    }

    //Next tick to ensure wrapper functions are called if needed
    return Promise.delay(1).then(getTransaction).then(function (tr) {
      return Promise.mapSeries(chunks, function (items) {
        return tr(tableName).insert(items, _returning);
      }).then(function (result) {
        result = _flatten(result || []);

        if (autoTransaction) {
          //TODO: -- Oracle tr.commit() does not return a 'thenable' !? Ugly hack for now.
          return (tr.commit(result) || Promise.resolve()).then(function () {
            return result;
          });
        }

        return result;
      }).catch(function (error) {
        if (autoTransaction) {
          return tr.rollback(error).then(function () {
            return Promise.reject(error);
          });
        }

        return Promise.reject(error);
      });
    }).then(resolve).catch(reject);
  }), {
    returning: function returning(columns) {
      _returning = columns;

      return this;
    },
    transacting: function transacting(tr) {
      transaction = tr;

      return this;
    }
  });

  return wrapper;
}
module.exports = exports['default'];