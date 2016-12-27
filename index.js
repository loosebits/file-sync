'use strict';
require('es6-promise').polyfill();
var express = require('express');
var app = express();
var expressWs = require('express-ws')(app);
var _ = require('lodash');
var config = require('config');
var notifer = require('./pushNotifier');
var downloader = require('./download');
var transmission = require('./transmission');
var bodyParser = require('body-parser');



var mapEvent = function(event, data) {
  switch (event) {
    case 'downloadComplete':
      return {event: 'downloadComplete', data: data};
    case 'rsyncOutput':
      return {event: 'downloadingTorrent', data: data};
    case 'error': 
      return {event: 'error', data: data};
  }
};
var torrents = [];

app.use(bodyParser.json());

app.get('/destinations', function(req, res) {
  res.json(config.get('destinations'));
})

app.get('/torrents', function(req, res) {
  transmission.getTorrents().then(function(_torrents) {
     _.each(_torrents, function(t) {
       if (!_.findWhere(torrents, {id: t.id})) {
          t.destination = _.find(Object.keys(config.get("destinations")), function(destinationName) {
            return config.get('destinations')[destinationName].default;
          });
          torrents.push(t);
       }
     });
     res.json(torrents);
   });
});

app.put('/torrents/:id', function(req, res, next) {
  var torrent = _.find(torrents, function(t) {
    return t.id == req.params.id;
  });
  if (torrent) {
    torrent.destination = req.body.destination;
    downloader.enqueue(torrent);
    downloader.download();
    res.json(torrent);
  } else {
    res.json({});
  }
});

app.delete('/torrents/:id', function(req, res) {
  var torrent = _.first(_.remove(torrents, function(t) {
    return t.id == req.params.id && (t.status === 'downloaded' || t.status === 'downloadFailed');
  }));
  if (torrent && torrent.status === 'downloadFailed' && config.get('transmission.deleteAfterCompleted')) {
    transmission.deleteTorrents(torrent);
  }
  res.send(torrent);
});

app.use(express.static('public'));

app.ws('/', function(ws) {
});

var aWss = expressWs.getWss('/');
var sendToClients = function(message) {
  aWss.clients.forEach(function (client) {
    try {
      client.send(JSON.stringify(message));
    } catch (ignore) { //Client lost connection
    }
  });
};

downloader.on('startingDownload', function(torrent) {
});
downloader.on('downloadComplete', function(torrent) {
  if (config.get('transmission.deleteAfterCompleted')) {
    transmission.deleteTorrents(torrent);
  }
  sendToClients(mapEvent('downloadComplete', torrent));
});
downloader.on('downloadComplete', notifer);
downloader.on('rsyncOutput', function(data) {
  sendToClients(mapEvent('rsyncOutput', data));
});
downloader.on('error', function(error) {
  sendToClients(mapEvent('error', error));
});


app.listen(config.get('serverPort'), function(err) {
  console.log('Torrent Web started on port ' + config.get('serverPort'));
});