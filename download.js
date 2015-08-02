'use strict';
var Q = require('q');
var Rsync = require('rsync');
var config = require('config');
var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');

var Downloader = function() {
  Downloader.super_.call(this);
  var self = this;
  self.torrents = [];
  // function quitting() {
  //   if (self.rsyncPid) {
  //     self.rsyncPid.kill();
  //   }
  //   process.exit();
  // }
  // process.on("SIGINT", quitting); // run signal handler on CTRL-C
  // process.on("SIGTERM", quitting); // run signal handler on SIGTERM
  // process.on("exit", quitting);
};
require('util').inherits(Downloader, EventEmitter);

Downloader.prototype.enqueue = function(torrent) {
  torrent.status = 'queued';
  if (!_.find(this.queue, {id: torrent.id})) {
    this.torrents.push(torrent);
  }
};

Downloader.prototype.queue = function() {
  return _.clone(this.queue);
};

Downloader.prototype.download = function() {
  var self = this;
  if (self.running) {
    return;
  }
  self.running = true;
  var deferred = Q.defer();
  var downloadTorrents = function(torrents, index) {
    index = index || 0;
    if (index >= torrents.length) {
      self.running = false;
      deferred.resolve(torrents);
      self.torrents = [];
      return;
    }
    torrents[index].status = 'downloading';
    self.emit('startingDownload', torrents[index]);
    self.rsyncPid = new Rsync().flags('azvP')
    .source(config.get('ssh.user') + '@' + config.get('ssh.host') + ':' + config.get('ssh.path') +
      '/' + torrents[index].name.replace(/[^a-zA-Z0-9\\-\\._]+/g, '*'))
    .destination(config.get('destination'))
    .execute(function(err, code, cmd) {
      if (err) {
        torrents[index].status = 'downloadFailed';
        self.emit('error', {step: 'download', error: err});
      } else {
        self.emit('downloadComplete', torrents[index]);
        torrents[index].status = 'downloaded';
      }
      downloadTorrents(torrents, index + 1);
    }, function(data) {
      console.log(data.toString());
      var m = /\d+\s+(\d+)%\s+(\d+\.?\d+[^\s]+)\s+(\d+:\d+:\d+)/.exec(data.toString());
      if (m) {
        self.emit('rsyncOutput', {torrent: torrents[index], progress: {
          percentComplete: m[1],
          transferSpeed: m[2],
          timeRemaining: m[3]
        }});  
      }
    }, function(data) {
      self.emit('rsyncError', {name: torrents[index].name, output: data.toString()});
    });
  };
  downloadTorrents(self.torrents);
  return deferred.promise;
};

module.exports = new Downloader();