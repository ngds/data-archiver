var parse = require("./parse");
var handle = require("./handle");
var archiver = require("./archive");
var utility = require("./utility");
var path = require('path');
var async = require('async');

function buildRequests (csw, start, increment, callback) {
  utility.buildGetRecords(csw, start, increment, function (getUrl) {
    callback(getUrl);
  });
}

function scrapeCsw (base, csw, start, increment, max) {
  start = typeof start !== "undefined" ? start : 1;
  increment = typeof increment !== "undefined" ? increment : 10;
  max = typeof max !== 'undefined' ? max : 10000000;

  var dirs = utility.buildDirs(base);

  function recursiveScrape (csw, start, increment, max) {
    buildRequests(csw, start, increment, function (get) {
      parse.parseCsw(get, function (data) {
        if (data) {
          async.waterfall([
            function (callback) {
              utility.constructorCsw(dirs, data, callback);
            },
            function (data, callback) {
              utility.processorCsw(data, callback);
            },
          ], function (err) {
            if (err) console.log(err);
          })
        }
        if (data["next"]) {
          var start = Number(data['next']);
          console.log(start);
          if (start > 0 && start <= max)
            recursiveScrape(csw, start, increment, max);
        }
      })
    })
  }
  recursiveScrape(csw, start, increment, max);
}

function scrapeWfs (base, csw, start, increment, max) {
  start = typeof start !== "undefined" ? start : 1;
  increment = typeof increment !== "undefined" ? increment : 10;
  max = typeof max !== 'undefined' ? max : 10000000;

  var dirs = utility.buildDirs(base);

  function recursiveScrape (csw, start, increment, max) {
    buildRequests(csw, start, increment, function (get) {
      parse.parseCsw(get, function (data) {
        if (data) {
          async.waterfall([
            function (callback) {
              utility.constructorWfs(dirs, data, callback);
            },
            function (wfsData, callback) {
              async.each(wfsData, function (d) {
                if (d) {
                  utility.processWfs(d['linkage'], d['parent'], callback);
                }
              })
            },
          ], function (err) {
            if (err) console.log(err);
          })
        }
        if (data["next"]) {
          var start = Number(data['next']);
          console.log(start);
          if (start > 0 && start <= max)
            recursiveScrape(csw, start, increment, max);
        }
      })
    })
  }
  recursiveScrape(csw, start, increment, max);
}

function makePing (base, csw, start, increment, max, whichPing) {
  start = typeof start !== "undefined" ? start : 1;
  increment = typeof increment !== "undefined" ? increment : 10;
  max = typeof max !== 'undefined' ? max : 10000000;

  var dirs = utility.buildDirs(base);
  var global = [];

  function recursivePing (csw, start, increment, max) {
    buildRequests(csw, start, increment, function (get) {
      parse.parseCsw(get, function (data) {
        if (data) {
          data['csw'] = csw;
          async.waterfall([
            function (callback) {
              if (whichPing === "hosts") {
                var filePath = path.join(dirs['status'], 'host-ping-logger.csv');
                utility.pingPong(filePath, data, global, callback);
              }
              if (whichPing === "linkages") {
                var filePath = path.join(dirs['status'], 'linkage-ping-logger.csv');
                utility.pingPong(filePath, data, callback);
              }
            },
          ], function (err) {
            if (err) console.log(err);
          })
        }
        if (data['next']) {
          var start = Number(data['next']);
          console.log(start);
          if (start > 0 && start <= max) {
            recursivePing(csw, start, increment, max);
          }
        }
      })
    })
  }
  recursivePing(csw, start, increment, max);
}

exports.scrapeCsw = scrapeCsw;
exports.scrapeWfs = scrapeWfs;
exports.makePing = makePing;



/*

function awsS3 () {
  var base = path.dirname(require.main.filename);
  var dirs = utility.buildDirs(base);
  var vault = argv.vault;
  utility.longWalk(dirs["record"], function (parents) {
    var parentCounter = parents.length;
    var parentIndex = 0;
    function recursiveWalk (parent) {
      utility.longWalk(parent, function (children) {
        var childCounter = children.length;
        var childIndex = 0;
        function recursiveStroll (child) {
          utility.longWalk(child, function (cFile) {
            var cFileCounter = cFile.length;
            var cFileIndex = 0;
            function recursiveUpload (file) {
              archiver.uploadToS3(file, function (res) {
                console.log(res);
                cFileIndex += 1;
                if (cFileIndex < cFileCounter) {
                  recursiveUpload(cFile[cFileIndex]);
                }
                if (cFileIndex === cFileCounter) {
                  fs.rmrf(children[childIndex], function (err, res) {
                    if (err) console.log(err);
                    else {
                      childIndex += 1;
                      if (childIndex < childCounter) {
                        recursiveStroll(children[childIndex]);
                      }
                      if (childIndex === childCounter) {
                        parentIndex += 1;
                        recursiveWalk(parents[parentIndex]);
                      }                      
                    }
                  })
                }
              })
            }
            recursiveUpload(cFile[cFileIndex]);
          })
        }
        recursiveStroll(children[childIndex]);
      })
    }
    recursiveWalk(parents[parentIndex]);
  })
}

*/