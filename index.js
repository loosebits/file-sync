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

function findNewTorrents(existingTorrents) {
  return new Promise(function(resolve, reject) {
    var newTorrents = [];
    transmission.getTorrents().then(function(_torrents) {
      _.each(_torrents, function(t) {
         if (!_.findWhere(existingTorrents, {id: t.id})) {
           newTorrents.push(t);
         }
       });
      resolve(newTorrents);
    }, function(err) {
      reject(err);
    });
  });
}

app.get('/torrents', function(req, res) {
  findNewTorrents(torrents).then(function(newTorrents) {
    torrents.concat(newTorrents);
    res.json(torrents);
  });
});

app.get('/torrents/:id/enqueue', function(req, res, next) {
  var torrent = _.find(torrents, function(t) {
    return t.id == req.params.id;
  });
  if (torrent) {
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

if (config.has('cron')) {
  try {
    var CronJob = new require('cron').CronJob;
    new CronJob(config.get('cron'), function() {
      findNewTorrents().then(function(torrents) {
        _.each(torrents, function(t) {
          downloader.enqueue(t);
          downloader.download();
        });
      }, function(err) {
        console.log(err);
      });
    }, null, true);
  } catch (e) {
    console.log("Invalid cron expression", e);
    process.exit(1);
  }
}


app.listen(config.get('serverPort'), function(err) {
  console.log('Torrent Web started on port ' + config.get('serverPort'));
});