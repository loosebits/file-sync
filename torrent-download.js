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
var Downloader = function() {
  var self = this;
  this.start = function() {
    self.emit('authenticating');
    request(config.get('transmission.rpcUrl'), {
      auth: auth
    }).then(function(args) {

      var session = args[0].headers['x-transmission-session-id'];
      if (session) {
        self.emit('authenticated');
      } else {
        self.emit('error', {step: 'authenticating'});
      }
      console.log(args[0].headers['x-transmission-session-id']);
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
          'x-transmission-session-id': session
        }
      });
    }).then(function(args) {
      var res = args[1];
      self.emit('torrentsListed', res.arguments.torrents);
      return _.filter(res.arguments.torrents, function(t) {
        return t.isFinished;
      });
    }).then(function(torrents) {
      var downloadTorrents = function(torrents, index) {
        index = index || 0;
        self.emit('startingDownload', torrents[index].name);
        new Rsync().flags('azvP')
        .source(config.get('ssh.user') + '@' + config.get('ssh.host') + ':' + config.get('ssh.path') + '/' + torrents[index].name.replace(/[^a-zA-Z0-9\\-\\._]+/g, '*'))
        .destination(config.get('destination'))
        .execute(function(err, code, cmd) {
          if (err) {
            self.emit('error', {step: 'download', error: err});
          } else if (index != torrents.length - 1) {
            self.emit('downloadComplete', torrents[index].name);
            downloadTorrents(torrents, index + 1);
          } else {
            self.emit('downloadComplete', torrents[index].name);
            self.emit('finished', torrents);
          }
        }, function(data) {
          self.emit('rsyncOutput', {name: torrents[index].name, output: data.toString()});
        }, function(data) {

        });
      };
      downloadTorrents(torrents);
    });
  };
};

require('util').inherits(Downloader, EventEmitter);
module.exports = Downloader;

