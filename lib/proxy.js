var request = require('superagent');
var debug = require('debug')('isomorphine:proxy');
var util = require('./util');

var invariant = util.invariant;

/**
 * Creates a new Proxy.
 *
 * @param  {String}  name    The name of this entity.
 * @param  {Object}  entity  The entity map to be used.
 *
 * @return {Object}          Instance of `Proxy`
 *
 * @providesModule   Proxy
 */
module.exports = function Proxy(name, entity) {
  if (!(this instanceof Proxy)) return new Proxy(name, entity);

  debug('Creating a new proxy: ' + name);

  for (var method in entity) {
    this[method] = proxyDispatcher.bind(this, name, method);
  }
};

function proxyDispatcher(entityName, method) {
  invariant(method, 'Method is required.');

  // Get the arguments that should be passed to the server
  var payload = Array.prototype.slice.call(arguments).slice(2);

  // Save the callback function for later use
  var callback = util.firstFunction(payload);

  // Transform the callback function in the arguments into a special key
  // that will be used in the server to signal the client-side callback call
  payload = util.transformCallback(payload);

  var endpoint = util.buildEndpoint(entityName, method);

  debug('Calling API endpoint: ' + endpoint + '.');

  request
    .post(endpoint)
    .send({ payload: payload })
    .set('Accept', 'application/json')
    .end(function(err, res) {
      if (!res || !res.body) {
        res = { body: null };
        err = err || new Error('No response from server. ' +
          '(Hint: Have you mounted isomorphine.router() in your app?)');
      }

      handleResponse(err, res.body, callback);
    });
}

function handleResponse(err, data, callback) {
  callback = callback || util.emptyFunction;

  if (err) {
    debug('API request failed.', err);
    console.error(err);
    // @todo handle errors better
    if (callback) {
      callback(err);
    }
    return;
  }

  var values = data.values;

  if (!values || values.constructor !== Array) {
    return callback(new Error('Fetched payload is not an array.'));
  }

  debug('Resolving callback with ' + JSON.stringify(values, null, 3));

  // Sets the error argument
  values.unshift(null);

  callback.apply(this, values);
}
