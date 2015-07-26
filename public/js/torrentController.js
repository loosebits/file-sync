(function() {
'use strict';
angular.module('app').controller('torrentController', function($scope) {
  var ws = $scope.ws;
  var progress = $scope.progress = {
    authenticated: false,
    torrentsListed: false,
    torrents: []
  };
  $scope.start = function() {
    ws.$emit('start');
  };
  function torrentFinder(id, torrent) {
    return torrent.id === id;
  }
  ws.$on('authenticated', function() {
    $scope.$apply(function() {
      progress.authenticated = true;
    });
  });
  ws.$on('torrentsListed', function(result) {
    $scope.$apply(function() {
      progress.torrentsListed = true;
      progress.torrents = result;
    });
  });
  ws.$on('downloadingTorrent', function(data) {
    $scope.$apply(function() {
      var torrent = _.find(progress.torrents, _.curry(torrentFinder)(data.torrent.id));
      if (!torrent) {
        return;
      }
      torrent.progress = data.progress;
    });
  });
  ws.$on('downloadComplete', function(torrent) {
    console.log(torrent);
    $scope.$apply(function() {
      var t = _.find(progress.torrents, _.curry(torrentFinder)(torrent.id));
      t.progress = t.progress || {};
      t.progress.complete = true;
      t.progress.percentComplete = 100;
    });
  });
});
})();
