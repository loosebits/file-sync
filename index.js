'use strict';
var express = require('express');
var app = express();
var expressWs = require('express-ws')(app);
var Downloader = require('./torrent-download');
var _ = require('lodash');
var config = require('config');
var notifer = require('./pushNotifier');

app.use(express.static('public'));

var running;
app.ws('/', function(ws) {

  if (!running) {
    var downloader = new Downloader();
    downloader.on('authenticating', function() {
      sendToClients('Authenticating');
    });
    downloader.on('torrentsListed', function(torrents) {
      sendToClients(_.map(torrents, function(torrent) {
        return torrent.name;
      }).join('<br />'));
    });
    downloader.on('startingDownload', function(torrent) {
      sendToClients('Starting download of ' + torrent);
    });
    downloader.on('downloadComplete', function(torrent) {
      sendToClients(torrent + ' downloaded!');
    });
    downloader.on('downloadComplete', notifer);
    downloader.on('rsyncOutput', function(data) {
      sendToClients(data.name + ' ' + data.output);
    });
    downloader.on('torrentsRemoved', function(data) {
      sendToClients('Torrents removed');
    });
    downloader.on('finished', function(torrents) {
      sendToClients('Finished!<br />' + _.map(torrents, function(torrent) {
        return torrent.name;
      }).join('<br />'));
      running = false;
    });
    downloader.on('error', function(error) {
      sendToClients('Failed: ' + error.step + ' ' + error.error);
      running = false;
    });
    downloader.start();
    running = true;
  }

});
var aWss = expressWs.getWss('/');
var sendToClients = function(message) {
  aWss.clients.forEach(function (client) {
    try {
      client.send(message);
    } catch (ignore) { //Client lost connection
    }
  });
};


app.listen(config.get('serverPort'), function(err) {
  console.log('Torrent Web started on port ' + config.get('serverPort'));
});