var Q = require('q');
var _ = require('lodash');
var Rsync = require('rsync');
var config = require('config');

var request = Q.denodeify(require('request'));
var auth = {
  user: config.get('transmission.user'),
  password: config.get('transmission.password')
};
module.exports = function(done, progress) {
  request(config.get('transmission.rpcUrl'), {
    auth: auth
  }).then(function(args) {
    var session = args[0].headers['x-transmission-session-id'];
    console.log(args[0].headers['x-transmission-session-id']);
    return request(config.get('transmission.rpcUrl'), {
      body: {
        method: 'torrent-get',
        arguments: {
          fields: ['id', 'name', 'isFinished']
        }
      },
      auth: auth,
      json: true,
      method: 'post',
      headers: {
        'x-transmission-session-id': session
      }
    });
  }).then(function(args) {
    var res = args[1];
    return _.filter(res.arguments.torrents, function(t) {
      return t.isFinished;
    });
  }).then(function(torrents) {
    var downloadTorrents = function(torrents, index) {
      index = index || 0;
      new Rsync().flags('azvP')
      .source(config.get('ssh.user') + '@' + config.get('ssh.host') + ':' + config.get('ssh.path') + '/' + torrents[index].name.replace(/[^a-zA-Z0-9\\-\\._]+/g, '*'))
      .destination(config.get('destination'))
      .execute(function(err, code, cmd) {
        if (err) {
          done(err, code);
        } else if (index != torrents.length - 1) {
          downloadTorrents(torrents, index + 1);
        } else {
          done(null, torrents);
        }
      }, function(data) {
        progress({name: torrents[index].name, output: data.toString()});
      }, function(data) {

      });
    };
    downloadTorrents(torrents);
  });
};
