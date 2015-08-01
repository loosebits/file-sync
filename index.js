'use strict';
var express = require('express');
var app = express();
var expressWs = require('express-ws')(app);
var _ = require('lodash');
var config = require('config');
var notifer = require('./pushNotifier');

app.use(require('express-promise'));

var downloader = require('./download');
var Transmission = require('./Transmission');
var transmission = new Transmission();



var mapEvent = function(event, data) {
  switch (event) {
    case 'authenticated':
      return {event: 'authenticated'};
    case 'torrentsListed':
      return {event: 'torrentsListed', data: data};
    case 'downloadComplete':
      return {event: 'downloadComplete', data: data};
    case 'rsyncOutput':
      return {event: 'downloadingTorrent', data: data};
    case 'error': 
      return {event: 'error', data: data};
  }
};

app.get('/torrents', function(req, res) {
  console.log('hee');
  res.json(transmission.getTorrents());
});
app.use(express.static('public'));

app.ws('/', function(ws) {
  ws.on('message',function(data) {
    try {
      data = JSON.parse(data);
      if (data.event == 'start') {
        downloader.start(); //noop if running already
      } else if (data.event == 'sync') {
        sendStatus(ws);
      }
    } catch (ignore) {
    }
  });

});

var sendStatus = function(ws) {
  var events = _.compact(_.map(downloader.events(), function(e) {
    return mapEvent(e.event, e.data);
  }));
  if (!events.length) {
    ws.send(JSON.stringify({event: 'notStarted'}));
  }
  _.each(events, function(e) {
    console.log("Sending event", e);
    ws.send(JSON.stringify(e));
  });
};
var aWss = expressWs.getWss('/');
var sendToClients = function(message) {
  aWss.clients.forEach(function (client) {
    try {
      client.send(JSON.stringify(message));
    } catch (ignore) { //Client lost connection
    }
  });
};

downloader.on('authenticating', function() {
});
downloader.on('authenticated', function() {
  sendToClients(mapEvent('authenticated'));
});
downloader.on('torrentsListed', function(torrents) {
  sendToClients(mapEvent('torrentsListed', torrents));
});
downloader.on('startingDownload', function(torrent) {
});
downloader.on('downloadComplete', function(torrent) {
  sendToClients(mapEvent('downloadComplete', torrent));
});
downloader.on('downloadComplete', notifer);
downloader.on('rsyncOutput', function(data) {
  sendToClients(mapEvent('rsyncOutput', data));
});
downloader.on('torrentsRemoved', function(data) {
});
downloader.on('finished', function(torrents) {
});
downloader.on('error', function(error) {
  sendToClients(mapEvent('error', error));
});


app.listen(config.get('serverPort'), function(err) {
  console.log('Torrent Web started on port ' + config.get('serverPort'));
});