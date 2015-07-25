'use strict';
var Q = require('q');
var _ = require('lodash');
var Rsync = require('rsync');
var config = require('config');
var EventEmitter = require('events').EventEmitter;
var denodeify = require('denodeify');

require('es6-promise').polyfill();

var authRequest = denodeify(require('request'), function(err, response, body) {
  if (err) {
    console.log('failed');
    return [err, response];
  } else if (response.statusCode !== 409 || !response.headers['x-transmission-session-id']) {
    console.log('failed1');
    return [new Error('Authentication failed', response), response];
  } else {
    return [err, response.headers['x-transmission-session-id']];
  }
});
var apiRequest = denodeify(require('request'), function(err, response, body) {
  if (err) {
    console.log('failed3');
    return [err, response];
  }
  if (response.statusCode < 200 || response.statusCode > 399) {
    console.log('failed4');
    return [new Error('Request failed with ' + response.statusCode, response), response];
  }
  if (body.result !== 'success') {
    console.log('failed5');
    return [new Error('Request failed with a transmission error', response), response];
  }
  return [err, body.arguments];
});
var auth = {
  user: config.get('transmission.user'),
  password: config.get('transmission.password')
};
var Downloader = function() {
};
require('util').inherits(Downloader, EventEmitter);

Downloader.prototype.start = function() {
  var self = this;
  var errorHandler = function(step, err) {
    self.emit('error', {step: step, error: err});
  };
  self.emit('authenticating');
  authRequest(config.get('transmission.rpcUrl'), {
    auth: auth
  }).then(function(session) {
    self.session = session;
    self.emit('authenticated');
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
        'x-transmission-session-id': self.session
      }
    });
  }, _.curry(errorHandler, 'authenticating')).then(function(args) {
    var torrents = _.filter(args.torrents, function(t) {
      return t.isFinished;
    });
    self.emit('torrentsListed', torrents);
    if (!torrents.length) {
      self.emit('finished');
    }
    return torrents;
  }, _.curry(errorHandler, 'listingTorrents')).then(function(torrents) {
    var deferred = Q.defer();
    var downloadTorrents = function(data, index) {
      index = index || 0;
      self.emit('startingDownload', torrents[index].name);
      new Rsync().flags('azvP')
      .source(config.get('ssh.user') + '@' + config.get('ssh.host') + ':' + config.get('ssh.path') + '/' + torrents[index].name.replace(/[^a-zA-Z0-9\\-\\._]+/g, '*'))
      .destination(config.get('destination'))
      .execute(function(err, code, cmd) {
        if (err) {
          self.emit('error', {step: 'download', error: err});
          deferred.reject(err);
        } else if (index !== torrents.length - 1) {
          self.emit('downloadComplete', torrents[index].name);
          downloadTorrents(data, index + 1);
        } else {
          self.emit('downloadComplete', torrents[index].name);
          deferred.resolve(torrents);
        }
      }, function(data) {
        self.emit('rsyncOutput', {name: torrents[index].name, output: data.toString()});
      }, function(data) {
        self.emit('rsyncError', {name: torrents[index].name, output: data.toString()});
      });
    };
    downloadTorrents(torrents);
    return deferred.promise;
  }).then(function(torrents) {
    if (!config.get('transmission.deleteAfterCompleted')) {
      return false;
    }
    return apiRequest(config.get('transmission.rpcUrl'), {
      auth: auth,
      json: true,
      method: 'post',
      headers: {
        'x-transmission-session-id': self.session
      },
      body: {
        method : "torrent-remove",
        arguments: {
          ids : _.map(torrents, function(t) { return t.id; }),
          "delete-local-data" : true
        }
      }
    });
  }, _.curry(errorHandler, 'downloadingTorrents')).then(function(removed) {
    if (removed !== false) {
      self.emit('torrentsRemoved');
    }
    self.emit('finished');
  }, _.curry(errorHandler, 'removingTorrents'));
};

module.exports = Downloader;
