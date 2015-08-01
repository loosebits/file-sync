'use strict';
var denodeify = require('denodeify');
var config = require('config');
var Q = require('q');
var _ = require('lodash');
var authRequest = denodeify(require('request'), function(err, response, body) {
  console.log('here');
  if (err) {
    return [err, response];
  } else if (response.statusCode !== 409 || !response.headers['x-transmission-session-id']) {
    return [new Error('Authentication failed', response), response];
  } else {
    return [err, response.headers['x-transmission-session-id']];
  }
});
var apiRequest = denodeify(require('request'), function(err, response, body) {
  if (err) {
    return [err, response];
  }
  if (response.statusCode < 200 || response.statusCode > 399) {
    return [new Error('Request failed with ' + response.statusCode, response), response];
  }
  if (body.result !== 'success') {
    return [new Error('Request failed with a transmission error', response), response];
  }
  return [err, body.arguments];
});
var auth = {
  user: config.get('transmission.user'),
  password: config.get('transmission.password')
};
function authenticate() {
  console.log('fpo');
  return authRequest(config.get('transmission.rpcUrl'), {
    auth: auth
  }).then(function(session) {
    return session;
  });
}

var Transmission = function() {
};

Transmission.prototype.getTorrents = function(all) {
  return authenticate().then(function(session) {
    console.log('session', session);
    return apiRequest(config.get('transmission.rpcUrl'), {
      body: {
        method: 'torrent-get',
        arguments: {
          fields: ['id', 'name', 'isFinished']
        }
      },
      auth: auth,
      json: true,
      method: 'post',
      headers: {
        'x-transmission-session-id': session
      }
    });
  }).then(function(torrents) {
    console.log('torrents', torrents);
    if (all) {
      return torrents;
    } else {
      return _.filter(torrents, function(t) {
        return t.isFinished;
      });
    }
  });
};

Transmission.prototype.deleteTorrents = function(torrents) {
  if (!_.isArray(torrents)) {
    torrents = [torrents];
  }
  return authenticate.then(function(session) {
    apiRequest(config.get('transmission.rpcUrl'), {
      auth: auth,
      json: true,
      method: 'post',
      headers: {
        'x-transmission-session-id': session
      },
      body: {
        method : "torrent-remove",
        arguments: {
          ids : _.map(torrents, function(t) { return t.id; }),
          "delete-local-data" : true
        }
      }
    });
  });
};

module.exports = Transmission;