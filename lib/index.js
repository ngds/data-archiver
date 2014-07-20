var parse = require("./parse");
var handle = require("./handle");
var archiver = require("./archive");
var utility = require("./utility");
var sync = require('./synchronous');
var path = require('path');
var async = require('async');
var fs = require("fs.extra");

// Build CSW getRecords URLs.
function buildRequests (csw, start, increment, callback) {
  utility.buildGetRecords(csw, start, increment, function (getUrl) {
    callback(getUrl);
  });
}

// Scrape every metadata record in a CSW and download all of the linkages,
// except for WFS data.  We handle that separately.  Why?  Memory leaks!  The
// WFS OGC specification has no support for pagination, so we can't do any
// flow control like we can with CSWs.
function scrapeCsw (base, csw, start, increment, max) {
  start = typeof start !== "undefined" ? start : 1;
  increment = typeof increment !== "undefined" ? increment : 10;
  max = typeof max !== 'undefined' ? max : 10000000;

  var dirs = utility.buildDirs(base);

  // Pretty simple recursion here, expects a 'next' parameter in the CSW.
  function recursiveScrape (csw, start, increment, max) {
    buildRequests(csw, start, increment, function (get) {
      parse.parseCsw(get, function (data) {
        if (data) {
          async.waterfall([
            function (callback) {
              utility.constructorCsw(dirs, data, callback);
            },
            function (data, callback) {
              if (data) utility.processorCsw(data, callback);
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

// Scrape all of the WFS data in a CSW.  If it's an 'aasg:WellLogs' WFS, then
// download all of the linkages for every feature in the WFS along with all
// of the feature data.
function scrapeWfs (base, csw, start, increment, max) {
  start = typeof start !== "undefined" ? start : 1;
  increment = typeof increment !== "undefined" ? increment : 10;
  max = typeof max !== 'undefined' ? max : 10000000;

  var dirs = utility.buildDirs(base);

  // Another recursion here, expects the 'next' parameter same as 'scrapeCsw()'
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
                if (d) utility.processWfs(d, callback);
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

// Only scrape data from a specific host.  Expects a 'hosts' parameter
// (i.e. egi.ngds.utah.edu) to base queries on.  Also -- most of the logic
// contained here will execute synchronously.  This function should really only
// be used for weak servers that cannot deal with the amount of traffic that
// an asynchronous operation could potentially generate.
function scrapeServer (base, csw, host, start, increment, max) {
  start = typeof start !== "undefined" ? start : 1;
  increment = typeof increment !== "undefined" ? increment : 10;
  max = typeof max !== 'undefined' ? max : 10000000;

  var dirs = utility.buildDirs(base);

  // Pretty simple recursion here, expects a 'next' parameter in the CSW.
  function recursiveScrape (csw, start, increment, max) {
    buildRequests(csw, start, increment, function (get) {
      parse.parseCsw(get, function (data) {
        if (data) {
          sync.constructor(dirs, data, host, function (linkages) {
            if (linkages) {
              sync.processor(linkages)
            }
          })
        }
        if (data['next']) {
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

// This doesn't work yet, because of the constructor function.  For the sake
// of preventing inefficient memory usage, I built two different functions
// for constructing data packages for processing WFS information and 'everything
// else information'.  While this workflow does prevent excessive memory leaks,
// it also makes for a super convoluted workflow when trying to process everything
// all at once.  SO, we should have another constructor function for processing all
// of the data at once.
function scrapeAll (base, csw, start, increment, max, s3Bucket) {
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
              utility.constructor(dirs, data, 'all', callback);
            },
            function (data, callback) {
              async.each(data, function (d) {
                if (d['wfs']) {
                  utility.processWfs(d, callback);
                } else {
                  utility.processorCsw(d, callback);
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

// Abstract function for pinging HTTP, HTTPS and FTP links.  Expects a 'whichPing'
// parameter to determine whether to ping every single link it hits or if it
// should just ping each host once.
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

// Traverse every single file in the 'records' directory and upload them all
// to an Amazon S3 server.
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
            var fileCount = files.length;
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
                      if (recsIndex === recsCount) {
                        fs.rmrf(hosts[hostsIndex], function (err) {
                          if (err) console.log(err);
                          else {
                            hostsIndex++;
                            recursiveHost(hosts[hostsIndex]);
                          }
                        })
                      }
                    }
                  })
                }
              })
            }
            if (fileCount === 0) {
              recsIndex++;
              recursiveRecord(recs[recsIndex]);
            } else {
              recursiveUpload(files[fileIndex]);
            }
          })
        }
        recursiveRecord(recs[recsIndex]);
      })
    }
    recursiveHost(hosts[hostsIndex]);
  })
}

exports.scrapeCsw = scrapeCsw;
exports.scrapeWfs = scrapeWfs;
exports.scrapeAll = scrapeAll;
exports.makePing = makePing;
exports.baseAwsS3 = baseAwsS3;
exports.scrapeServer = scrapeServer;