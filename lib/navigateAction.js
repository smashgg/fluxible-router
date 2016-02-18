/**
 * Copyright 2015, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

var objectAssign = require('object-assign');
var debug = require('debug')('navigateAction');

var GLOBAL_UUID_MAX = Math.pow(2, 53);

function generateUUID () {
    return Math.ceil(Math.random() * GLOBAL_UUID_MAX);
}

module.exports = function (context, payload, done) {
    var transactionId = generateUUID();
    var navigate = objectAssign({
        transactionId: transactionId
    }, payload);
    debug('dispatching NAVIGATE_START', navigate);
    context.dispatch('NAVIGATE_START', navigate);

    var routeStore = context.getStore('RouteStore');
    if (!routeStore.getCurrentRoute) {
        done(new Error('RouteStore has not implemented `getCurrentRoute` method.'));
        return;
    }
    debug('executing', payload);

    var route = routeStore.getCurrentRoute();

    if (!route) {
        var error404 = {
            statusCode: 404,
            transactionId: transactionId,
            message: 'Url \'' + payload.url + '\' does not match any routes'
        };

        context.dispatch('NAVIGATE_FAILURE', error404);
        done(objectAssign(new Error(), error404));
        return;
    }

    var action = route.get('action');

    if ('string' === typeof action && context.getAction) {
        action = context.getAction(action);
    }

    if (!action || 'function' !== typeof action) {
        debug('route has no action, dispatching without calling action');
        context.dispatch('NAVIGATE_SUCCESS', route);
        done();
        return;
    }

    debug('executing route action');
    context.executeAction(action, route, function (err) {
        if (err) {
            var error500 = {
                statusCode: err.statusCode || 500,
                transactionId: transactionId,
                message: err.message
            };

            context.dispatch('NAVIGATE_FAILURE', error500);
            done(objectAssign(err, error500));
        } else {
            context.dispatch('NAVIGATE_SUCCESS', route.set('navigate', navigate));
            done();
        }
    });
};
