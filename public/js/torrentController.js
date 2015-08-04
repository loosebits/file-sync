(function() {
'use strict';
angular.module('app').controller('torrentController', function($scope, Torrents) {
  var ws = $scope.ws;

  var handler = function(torrents) {
    _.each(torrents, function(t) {
      if (t.status === 'downloaded') {
        t.progress = t.progress || {};
        t.progress.percentComplete = 100;
      }
    });
  };

  $scope.torrents = Torrents.query(handler);

  $scope.refresh = function() {
    Torrents.query(function(torrents) {
      handler(torrents);
      _.each(torrents, function(t) {
        var torrent = _.findWhere($scope.torrents, {id: t.id});
        if (torrent) {
          _.extend(torrent, t);
        } else {
          $scope.torrents.push(t);
        }
      });
    });
  };

  function downloadableTorrent(t) {
    return !t.status || t.status === 'downloadFailed';
  }

  $scope.downloadAll = function() {
    $scope.torrents.$promise.then(function(torrents) {
      _(torrents).filter(downloadableTorrent).each(function(t) {
        t.$enqueue();
      }).value();
    });
  };

  $scope.downloadableTorrents = function() {
    return _.find($scope.torrents, downloadableTorrent);
  };

  $scope.delete = function(torrent) {
    torrent.$delete(function() {
      _($scope.torrents).remove({id: torrent.id}).value();
    });
  };

  ws.$on('downloadingTorrent', function(data) {
    $scope.$apply(function() {
      var torrent = _.find($scope.torrents,{id: data.torrent.id});
      if (!torrent) {
        return;
      }
      torrent.progress = data.progress;
    });
  });

  ws.$on('downloadComplete', function(torrent) {
    $scope.$apply(function() {
      var t = _.find($scope.torrents, {id: torrent.id});
      t.progress = t.progress || {};
      t.status = 'downloaded';
      t.progress.percentComplete = 100;
    });
  });
});
})();
