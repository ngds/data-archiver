var handle = require('./handle');
var timber = require('./timber');
var parse = require('./parse');
var fs = require('fs');
var path = require('path');
var url = require('url');
var _ = require('underscore');
var async = require('async');
var querystring = require('querystring');

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
  }
  return dirs;
}

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
}

// Traverses a directory and returns a message for each scope.
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
}

// Have a look at the linkages for a metadata record and return a JSON object
// containing all of the information we need to process WFS data.  This is
// separate from 'constructorCsw()' because it needs less information which we
// can take advantage of to prevent memory leaks.  We'll need another
// constructor function in order to do processing on all of the data at once.
function constructorWfs (dirs, item, callback) {

  var linkages = _.map(item.linkages, function (linkage) {
    if (linkage && linkage.search('service=WFS') !== -1) {
      var parsedUrl = url.parse(linkage);
      var host = parsedUrl['host'];
      if (host) {
        var parent = path.join(dirs['record'], host);

        return {
          'wfs': true,
          'host': host,
          'parent': parent,
          'linkage': linkage,
          'fileId': item.fileId
        }
      }
    }
  });

  callback(null, linkages);
}

// Have a look at the linkages for a metadata record and return a JSON object
// containing all of the information we need to process anything other than
// WFS data.
function constructorCsw (dirs, item, callback) {

  var linkages = _.map(item.linkages, function (linkage) {
    if (linkage && linkage.search('service=WFS') === -1) {
      var parsedUrl = url.parse(linkage);
      var host = parsedUrl["host"];
      if (host) {
        var parent = path.join(dirs["record"], host);
        var child = path.join(parent, item.fileId);
        var outXml = path.join(child, item.fileId + ".xml");

        return {
          'wfs': false,
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

  callback(null, linkages);
}

// Expects a constructorCsw object and uses that to build a file structure,
// write out an XML metadata record and download any linkage data.  Flow-
// control is done with async.waterfall().
function processorCsw (construct, callback) {
  var counter = construct.length;
  var increment = 0;

  _.each(construct, function (data) {
    if (data) {
      async.waterfall([
        function (callback) {
          handle.buildDirectory(data['parent'], function () {
            callback(null);
          });
        },
        function (callback) {
          if (data['child']) {
            handle.buildDirectory(data['child'], function () {
              callback(null);
            });
          }
        },
        function (callback) {
          handle.writeXml(data['outXml'], data['fullRecord'], callback);
        },
        function (outPath, d, callback) {
          handle.download(data['child'], data['linkage'], function () {
            increment++;
            callback(null);
          })
        }
      ], function (err) {
        if (err) callback(err);
      })
    }
    if (increment === counter) {
      callback(null, data['child'], data['childArchive']);
    }
  })
}

// A whole lot of processing for handling 'aasg:WellLogs' WFS data and any
// other WFS data.  Well Logs are handled differently, though.  Instead of just
// streaming the XML to an output text file, we actually iterate through the
// individual features and download the data linkages.
function processWfs (construct, parentCallback) {

  var linkage = construct['linkage'];
  var outPath = construct['parent'];
  var xmlId = construct['fileId'];

  parse.parseGetCapabilitiesWfs(linkage, function (wfsGet) {
    var wfsCounter = wfsGet.length;
    var wfsIndex = 0;

    function recursiveWfs (wfs) {
      async.waterfall([
        function (callback) {
          handle.configurePaths(outPath, wfs, callback);
        },
        function (config, callback) {
          config['xmlId'] = xmlId;
          handle.buildDirectory(config['directory'], config, callback);
        },
        function (hostPath, config, callback) {
          var outPath = path.join(hostPath, config['xmlId']);
          handle.buildDirectory(outPath, config, callback);
        },
        function (outPath, config, callback) {
          var urlQuery = url.parse(wfs)['query'];
          var typeName = querystring.parse(urlQuery)['typeNames'];
          callback(null, config, outPath, typeName);
        },
        function (config, outPath, type, callback) {
          var fileId = config['file'];
          if (type === 'aasg:WellLog') {
            parse.parseWellLogsWfs(wfs, outPath, function (d) {
              if (d) {
                async.waterfall([
                  function (callback) {
                    var outPathRecord = path.join(outPath, d['id']);
                    handle.buildDirectory(outPathRecord, d, callback);
                  },
                  function (outPath, d, callback) {
                    var wfsXml = path.join(outPath, d['id'] + '.xml');
                    handle.writeXml(wfsXml, d['xml'], outPath, d, callback);
                  },
                  function (outPath, d, callback) {
                    async.each(d['linkages'], function (link) {
                      handle.download(outPath, link, callback);
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
          var writePath = path.join(outPath, fileId + '.xml');
          parse.parseGetFeaturesWfs(wfs, writePath, function () {
            wfsIndex++;
            if (wfsIndex < wfsCounter) recursiveWfs(wfsGet[wfsIndex]);
            if (wfsIndex === wfsCounter) parentCallback(writePath);
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

exports.buildDirs = buildDirs;
exports.buildGetRecords = buildGetRecords;
exports.longWalk = longWalk;
exports.constructorWfs = constructorWfs;
exports.constructorCsw = constructorCsw;
exports.processorCsw = processorCsw;
exports.pingPong = pingPong;
exports.processWfs = processWfs;