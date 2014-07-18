var _ = require('underscore')
  , fs = require('fs')
  , handle = require('./handle');

function constructor (dirs, item, thisHost, callback) {
  var linkages = _.map(item.linkages, function (linkage) {
    if (linkage) {
      var parsedUrl = url.parse(linkage)
        , host = parsedUrl.parse['host'];
      if (host && host === thisHost) {
        var parent = path.join(dirs['record'], host)
          , child = path.join(parent, item.fileId)
          , outXml = path.join(child, item.fileId + '.xml');

        return {
          'host': host,
          'parent': parent,
          'child': child,
          'linkage': linkage,
          'outXml': outXml,
          'fileId': item.fileId,
          'fullRecord': item.fullRecord
        }
      }
    }
  });
  callback(linkages);
}

function processor (construct, callback) {
  var counter = construct.length
    , increment = 0;

  function recursiveProcess(data, callback) {
    handle.buildDirectory(data['parent'], function () {
      if (data['child']) {
        handle.buildDirectory(data['child'], function () {
          handle.writeXml(data['outXml'], data['fullRecord'], function () {
            handle.download(data['child'], data['linkage'], function () {
              increment++;
              if (increment < counter) {
                recursiveProcess(construct[increment]);
              }
              if (increment === counter && callback) {
                callback(null);
              }
            })
          })
        })
      }
    })
  }

  recursiveProcess(construct[increment], function () {
    callback(null);
  })
}

exports.constructor = constructor;
exports.processor = processor;