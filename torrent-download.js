var Q = require('q');
var _ = require('lodash');
var Rsync = require('rsync');
var config = require('config');
var EventEmitter = require('events').EventEmitter;

var request = Q.denodeify(require('request'));
var auth = {
  user: config.get('transmission.user'),
  password: config.get('transmission.password')
};
var session;
var Downloader = function() {
};
require('util').inherits(Downloader, EventEmitter);
Downloader.prototype.start = function() {
  var self = this;
  self.emit('authenticating');
  request(config.get('transmission.rpcUrl'), {
    auth: auth
  }).then(function(args) {

    self.session = args[0].headers['x-transmission-session-id'];
    if (self.session) {
      self.emit('authenticated');
    } else {
      self.emit('error', {step: 'authenticating'});
    }
    return request(config.get('transmission.rpcUrl'), {
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
  }).then(function(args) {
    var res = args[1];
    self.emit('torrentsListed', res.arguments.torrents);
    if (!res.arguments.torrents.length) {
      self.emit('finished', []);
    }
    return _.filter(res.arguments.torrents, function(t) {
      return t.isFinished;
    });
  }).then(function(torrents) {
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
        } else if (index != torrents.length - 1) {
          self.emit('downloadComplete', torrents[index].name);
          downloadTorrents(data, index + 1);
        } else {
          self.emit('downloadComplete', torrents[index].name);
          self.emit('finished', torrents);
          deferred.resolve(torrents);
        }
      }, function(data) {
        self.emit('rsyncOutput', {name: torrents[index].name, output: data.toString()});
      }, function(data) {

      });
    };
    downloadTorrents(torrents);
    return deferred.promise;
  }).then(function(torrents) {
    return request(config.get('transmission.rpcUrl'), {
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
    
  });
};

module.exports = Downloader;
