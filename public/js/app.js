(function() {
'use strict';
var app = angular.module('app', ['ngMaterial', 'ngWebsocket', 'ngResource', 'angular-humanize', 'ng-mfb']);
app.run(function($rootScope, $websocket, $location) {
  var ws = $websocket.$new({
    url: 'ws://' + $location.host() + ':' + $location.port() + '/',
    enqueue: true
  });
  $rootScope.ws = ws;
})
.factory('Torrents',function($resource) {
  return $resource('torrents/:id', {id: '@id'}, {
    save: { url: 'torrents/:id', params: {id: '@id'}, method: 'put' },
  });
})
.factory('Destinations', function($resource) {
	return $resource('destinations', {}, {
		query: {isArray: false}
	});
});
})();
