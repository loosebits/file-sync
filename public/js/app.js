(function() {
'use strict';
var app = angular.module('app', ['ngMaterial', 'ngWebsocket']);
app.run(function($rootScope, $websocket, $location) {
  var ws = $websocket.$new({
    url: 'ws://' + $location.host() + ':' + $location.port() + '/',
    enqueue: true
  });
  $rootScope.ws = ws;
});
})();
