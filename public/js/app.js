(function() {
'use strict';
var app = angular.module('app', ['ngMaterial', 'ngWebsocket', 'ngResource', 'angular-humanize']);
app.run(function($rootScope, $websocket, $location) {
  var ws = $websocket.$new({
    url: 'ws://' + $location.host() + ':' + $location.port() + '/',
    enqueue: true
  });
  $rootScope.ws = ws;
})
.factory('Torrents',function($resource) {
  return $resource('torrents/:id', {id: '@id'}, {
    enqueue: { url: 'torrents/:id/enqueue', params: {id: '@id'}, method: 'get' },
  });
});
})();
