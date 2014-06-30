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
              utility.constructor(dirs, data, callback);
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
              utility.constructor(dirs, data, callback);
            },
            function (wfsData, callback) {
              async.each(wfsData, function (d) {
                if (d) {
                  var link = d['linkage'];
                  var parent = d['parent'];
                  var xmlId = d['fileId'];
                  utility.processWfs(link, parent, xmlId, callback);
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

function doEverything (base, csw, start, increment, max, s3Bucket) {
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
              utility.constructor(dirs, data, callback);
            },
            function (data, callback) {
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

function baseAwsS3 (base, s3Bucket) {
  var recordsPath = path.join(base, '/outputs/records');

  utility.longWalk(recordsPath, function (hosts) {
    var hostsIndex = 0;

    function recursiveHost (host) {
      utility.longWalk(host, function (recs) {
        var recsCount = recs.length;
        var recsIndex = 0;

        function recursiveRecord (rec) {
          utility.longWalk(rec, function (files) {
            var fileCount = file.length;
            var fileIndex = 0;

            function recursiveUpload (file) {
              archiver.uploadToS3(file, s3Bucket, function (res) {
                console.log(res);
                fileIndex++;

                if (fileIndex < fileCount) {
                  recursiveUpload(files[fileIndex]);
                }

                if (fileIndex === fileCount) {
                  fs.rmrf(recs[recsIndex], function (err) {
                    if (err) console.log(err);
                    else {
                      recsIndex++;
                      if (recsIndex < recsCount) {
                        recursiveRecord(recs[recsIndex]);
                      }
                      if (recsIndex < recsCount) {
                        hostsIndex++;
                        recursiveHost(hosts[hostsIndex]);
                      }
                    }
                  })
                }
              })
            }
            recursiveUpload(files[fileIndex]);
          })
        }
        recursiveRecord(recs[recIndex]);
      })
    }
    recursiveHost(hosts[hostsIndex]);
  })
}

exports.scrapeCsw = scrapeCsw;
exports.scrapeWfs = scrapeWfs;
exports.makePing = makePing;
exports.baseAwsS3 = baseAwsS3;