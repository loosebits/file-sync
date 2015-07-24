var express = require('express');
var app = express();
var expressWs = require('express-ws')(app);
var downloader = require('./torrent-download');
var _ = require('lodash');

app.use(express.static('public'));


var running;
app.ws('/', function(ws) {

  if (!running) {
    downloader(done, progress);
    running = true;
  }

});
var aWss = expressWs.getWss('/');
var done = function(err, torrents) {
  running = false;
  aWss.clients.forEach(function (client) {
    client.send(_.map(torrents, function(torrent) {
      return torrent.name;
    }).join('<br />'));
  });
};
var progress = function(data) {
  aWss.clients.forEach(function (client) {
    client.send(data.name + ' ' + data.output); 
  });
};


app.listen(3000);