'use strict';

var Push = require('pushover-notifications');
var config = require('config');
var _ = require('lodash');

var p;
if (config.has('pushOver.apiKey')) {
  p = new Push({ token: config.get('pushOver.apiKey') });
}

module.exports = function(torrent) {
  if (!p) {
    return;
  }
  _.each(config.get('pushOver.users'), function(user) {
    p.send({message: torrent.name + ' download complete.',
      title: 'Download Complete',
      user: user
    });
  });
};
