#!/usr/bin/env node

var async = require("async");
var parse = require("./parse");
var handle = require("./handle");
var utility = require("./utility");
var path = require("path");
var url = require("url");
var fs = require("fs");
var _ = require("underscore");
var querystring = require("querystring");

var argv = require("yargs")
  .usage("Command line utility for archiving NGDS data on Amazon S3")

  .alias("p", "parse")
  .describe("Parse a CSW")
  .argv;

var cmdQueue = [];
if (argv.parse) cmdQueue.push(parseCsw);

async.series(cmdQueue);

function parseCsw () {
  var DataStore = function () {
    var linkages = {};
    linkages.unique = [];
    linkages.status = [];
    linkages.dead = [];
    return linkages;
  };
  var datastore = new DataStore();
  var base = argv.out ? argv.out : path.dirname(require.main.filename);
  var dirs = utility.buildDirs(base);
  var logs = {
    "status": path.join(dirs["logs"], "linkage-status.csv"),
    "dead": path.join(dirs["logs"], "dead-linkages.csv"),
    "unique": path.join(dirs["logs"], "unique-linkages.csv"),
  }

  function pinger (data, store, callback) {
    async.forEach(data.linkages, function (linkage) {
      var parsedUrl = url.parse(linkage);
      var host = parsedUrl["protocol"] + "//" + parsedUrl["host"];
      if (_.indexOf(store["unique"], host) === -1) {
        store["unique"].push(host);
        handle.pingUrl(host, function (error, response) {
          if (error)
            error["ping"] = "DEAD";
            store["dead"].push(error);
            store["status"].push(error);
          if (response)
            response["ping"] = "ALIVE";
            store["status"].push(response);
        })
      }
    })
    callback(null);
  };

  function writeUrlStatus (store, logs, callback) {
    async.series([
      function (callback) {
        handle.linkageLogger(store["unique"], logs["unique"], function (error, response) {
          if (error) callback(null, error);
          callback(null, response);
        })
      },
      function (callback) {
        handle.linkageLogger(store["status"], logs["status"], function (error, response) {
          if (error) callback(null, error);
          callback(null, response);
        })
      },
      function (callback) {
        handle.linkageLogger(store["dead"], logs["dead"], function (error, response) {
          if (error) callback(null, error);
          callback(null, response);
        })
      },
    ],
    function (error, results) {
      if (error) callback(error);
      callback(results);
    })
  }

  function constructor (item, callback) {
    var directory = path.join(dirs["record"], item.fileId);
    var outXML = path.join(directory, item.fileId + ".xml");
    var construct = {
      "directory": directory,
      "outXML": outXML,
      "fileId": item.fileId,
      "linkages": item.linkages,
      "fullRecord": item.fullRecord,
    }
    callback(null, construct);
  };

  function processor (data, callback) {
    var directory = data["directory"];
    var outXML = data["outXML"];
    handle.buildDirectory(directory, function () {
      handle.writeXML(outXML);
      async.forEach(data.linkages, function (linkage) {
        utility.checkLinkage(datastore["dead"], linkage, function (linkage) {
          if (linkage.search("service=WFS") !== -1) {
            parse.parseGetCapabilitiesWFS(linkage, function (linkages) {
              async.forEach(linkages, function (linkage) {
                handle.configurePaths(directory, linkage, function (res) {
                  handle.buildDirectory(res.directory, function () {
                    var urlQuery = url.parse(res.linkage)["query"];
                    var typeName = querystring.parse(urlQuery)["typeNames"];
                    if (typeName === "aasg:WellLog") {
                      console.log("GOT A WELL LOG WFS");
                      parse.parseWellLogsWFS(res.linkage, res.directory, function (response) {
                        parse.parseWellLogs(response);
                      })
                    }

                    if (typeName !== "aasg:WellLog") {
                      parse.parseGetFeaturesWFS(res.linkage, res.directory, res.file, function (data) {
                        
                      })
                    }                   
                  })
                })
              })
            })
          } else {
            handle.downloadFile(directory, linkage, function (response) {
              console.log(response);
            });
          }
        })
      })
    callback("DOWNLOADED: " + directory); 
    })
  };

  var queue = async.queue(function (getRecordUrl, callback) {
    parse.parseCsw(getRecordUrl, function (data) {
      async.each(data, function (item) {
        async.waterfall([
          function (callback) {
            pinger(item, datastore, callback);
          },
          function (callback) {
            constructor(item, callback);
          },
          function (data, callback) {
            processor(data, function (response) {
              console.log(response);
            });
          },
        ], function (error, result) {
          if (error) callback(error);
        });
      })
    callback();
    })
  }, 1);

  queue.drain = function () {
    if (queue.length() === 0) {
      console.log("All getRecordUrls have been processed.");      
    }
  }
  
  function startQueue () {
    utility.doRequest(33875, 100, function (x) {
      var base = "http://geothermaldata.org/csw?";
      utility.buildUrl(base, x.counter, x.increment, function (getRecords) {
        queue.push(getRecords);
      });
    })
  }

  startQueue();
}