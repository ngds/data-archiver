var handle = require('./handle');
var timber = require('./timber');
var fs = require("fs");
var path = require("path");
var url = require("url");
var _ = require("underscore");
var async = require('async');

function buildDirs (base) {
  var dirs = {};
  dirs["out"] = path.join(base, "outputs");
  dirs["record"] = path.join(dirs["out"], "records");
  dirs["status"] = path.join(dirs["out"], "status");

  for (var key in dirs) {
    if (fs.existsSync(dirs[key])) {
      console.log("Path exists: " + dirs[key]);
    } else {
      fs.mkdirSync(dirs[key]);
    }
  };
  return dirs;
};

function buildGetRecords (base, start, max, callback) {
  var host = url.parse(base)["host"];
  var path = url.parse(base)["path"];
  var request = "GetRecords";
  var service = "CSW";
  var resultType = "results";
  var elementSetName = "full";
  var outputSchema = "http://www.isotc211.org/2005/gmd";
  var typeNames = "gmd:MD_Metadata";
  var version = "2.0.2";
  
  callback({
    host: host,
    path: path + "Request=" + request + "&service=" + service + "&resultType=" 
      + resultType + "&elementSetName=" + elementSetName + "&startPosition=" 
      + start + "&maxRecords=" + max + "&outputSchema="
      + outputSchema + "&typeNames=" + typeNames + "&version=" + version
  })
};

function longWalk (parent, callback) {
  var module = this;
  var sanityParent = String(parent);
  module.walkDirectory(sanityParent, function (folders) {
    var full = _.map(folders, function (folder) {
      var sanityFolder = String(folder);
      return path.join(sanityParent, sanityFolder);
    });
    callback(full);
  })
};

function walkDirectory (path, callback) {
  fs.readdir(path, function (err, res) {
    if (err) callback(err);
    else callback(res);
  })
};

function constructor (dirs, item, callback) {
  var linkages = _.map(item.linkages, function (linkage) {
    var parsedUrl = url.parse(linkage);
    var host = parsedUrl["host"];
    if (host) {
      var parent = path.join(dirs["record"], host);
      var parentArchive = path.join(dirs["record"], host + ".zip");
      var child = path.join(parent, item.fileId);
      var childArchive = path.join(parent, item.fileId + ".zip");
      var outXml = path.join(child, item.fileId + ".xml");

      return {
        "host": host,
        "parent": parent,
        "parentArchive": parentArchive,
        "child": child,
        "childArchive": childArchive,
        "linkage": linkage,
        "outXml": outXml
      }
    }
  });

  construct = {
    "linkages": linkages,
    "fileId": item.fileId,
    "fullRecord": item.fullRecord
  };

  callback(null, construct);
};

function processor (construct, callback) {
  var counter = construct['linkages'].length;
  var increment = 0;

  async.each(construct['linkages'], function (data) {
    if (typeof data !== 'undefined') {
      async.waterfall([
        function (callback) {
          handle.buildDirectory(data['parent'], function () {
            callback(null);
          });
        },
        function (callback) {
          handle.buildDirectory(data['child'], function () {
            callback(null);
          });
        },
        function (callback) {
          handle.writeXml(data['outXml'], construct['fullRecord'], function () {
            callback(null);
          });
        },
        function (callback) {
          handle.download(data['child'], data['linkage'], function () {
            increment++;
            callback(null);
          })
        }
      ], function (err, res) {
        if (err) console.log(err);
        else console.log(res);
      })
    }
    if (increment === counter) {
      callback(null, data['child'], data['childArchive']);
    }
  })
};

function pingPong (filePath, data, globe, callback) {

  var args = [];
  for (var i = 0; i < arguments.length; i++) {
    args.push(arguments[i]);
  }

  filePath = args.shift();
  data = args.shift();
  callback = args.pop();

  if (args.length > 0) globe = args.shift(); else globe = null;

  function pingStatus (res, data, linkage) {
    if (res && data && linkage) {
      var status = {
        'time': new Date().toISOString(),
        'csw': data['csw'],
        'id': data['fileId'],
        'linkage': linkage
      };

      if (res['res']) {
        status['status'] = res['res']['statusCode'];
        return status;
      }

      if (res['call']) {
        status['status'] = res['call']['statusCode'];
        return status;
      }

      else {
        status['status'] = res;
        return status;
      }
    }
  }

  if (data.linkages) {
    async.each(data.linkages, function (linkage) {
      if (typeof linkage !== "undefined" && linkage.length > 0) {
        if (globe) {
          var parsed = url.parse(linkage);
          var host = parsed['protocol'] + '//' + parsed['host'];
          if (globe.indexOf(host) === -1) {
            globe.push(host);
            handle.pingPong(host, function (err, res) {
              var status;

              if (err) {
                var status = pingStatus(err, data, host);
              }

              if (res) {
                var status = pingStatus(res, data, host);
              }

              timber.writePingStatus(filePath, status, function (err) {
                if (err) callback(err);
                else callback(null);
              })
            })
          }
        } else {
          handle.pingPong(linkage, function (err, res) {
            if (err) callback(err);
            var status = pingStatus(res, data, linkage);
            timber.writePingStatus(filePath, status, function (err) {
              if (err) callback(err);
              else callback(null);
            })
          })
        }
      }
    })
  }
}

function processWfs (dir, linkage, callback) {
  parse.parseGetCapabilitiesWfs(linkage, function (wfsGet) {
    var wfsCounter = wfsGet.length;
    var wfsIndex = 0;

    function getTypeName (wfs, callback) {
      var urlQuery = url.parse(wfs)['query'];
      var type = querystring.parse(urlQuery)['typeNames'];
      callback(null, type);
    }

    function recursiveWfs (wfs) {
      async.waterfall([
        function (callback) {
          handle.configurePaths(dir, wfs, callback);
        },
        function (config, callback) {
          var outPath = path.join(config['directory'], config['file']);
          handle.buildDirectory(outPath, callback);
        },
        function (outPath, callback) {
          getTypeName(wfs, callback);
        },
        function (outPath, type, callback) {
          if (type === 'aasg:WellLog') {
            parse.parseWellLogsWfs(wfs, outPath, function (d) {
              if (d) {
                async.waterfall([
                  function (callback) {
                    var outPathRecord = path.join(outPath, d['id']);
                    handle.buildDirectory(outPathRecord, callback);
                  },
                  function (dir, callback) {
                    var wfsXml = path.join(dir, d['id'] + '.xml');
                    handle.writeXml(wfsXml, d['xml'], callback);
                  },
                  function (dir, data, callback) {
                    async.each(data['linkages'], function (link) {
                      handle.download(dir, link, callback);
                    })
                  }
                ])
              }

              if (d === 'end_of_stream') {
                wfsIndex++;
                if (wfsIndex < wfsCounter) recursiveWfs(wfsGet[wfsIndex]);
                if (wfsIndex === wfsCounter) callback();
              }

            });
          }

          parser.parseGetFeaturesWfs(wfs, outPath, function () {
            wfsIndex++;
            if (wfsIndex < wfsCounter) recursiveWfs(wfsGet[wfsIndex]);
            if (wfsIndex === wfsCounter) callback();
          })
        },
      ], function (err, res) {
        if (err) console.log(err);
        else console.log(res);
      })
    }
    if (wfsIndex === wfsCounter) callback();
    recursiveWfs(wfsGet[wfsIndex]);
  })
}

exports.buildDirs = buildDirs;
exports.buildGetRecords = buildGetRecords;
exports.longWalk = longWalk;
exports.constructor = constructor;
exports.processor = processor;
exports.pingPong = pingPong;
exports.processWfs = processWfs;