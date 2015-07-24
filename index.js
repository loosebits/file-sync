var express = require('express');
var app = express();
var expressWs = require('express-ws')(app);
var Downloader = require('./torrent-download');
var _ = require('lodash');

app.use(express.static('public'));


var running;
app.ws('/', function(ws) {

  if (!running) {
    var downloader = new Downloader();
    downloader.on('authenticating', function() {
      sendToClients('Authenticating');
    });
    downloader.on('error', function(error) {
      sendToClients('Failed: ' + error.step);
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
    downloader.on('rsyncOutput', function(data) {
      sendToClients(data.name + ' ' + data.output);
    });
    downloader.on('finished', function(torrents) {
      sendToClients('Finished!<br />' + _.map(torrents, function(torrent) {
        return torrent.name;
      }).join('<br />'));
      running = false;
    });
    downloader.start();
    running = true;
  }

});
var aWss = expressWs.getWss('/');
var sendToClients = function(message) {
  aWss.clients.forEach(function (client) {
    client.send(message);
  });
};


app.listen(3000);