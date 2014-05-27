#!/usr/bin/env node

var async = require("async");
var parse = require("./parse");
var handle = require("./handle");
var utility = require("./utility");
var path = require("path");
var url = require("url");
var fs = require("fs");
var _ = require("underscore");

var stream = require("stream").Stream();


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

  function pinger (data, store, callback) {
    async.forEach(data.linkages, function (linkage) {
      var parsedUrl = url.parse(linkage);
      var host = parsedUrl["protocol"] + "//" + parsedUrl["host"];
      if (_.indexOf(store["unique"], host) === -1) {
        handle.pingUrl(linkage, function (error, response) {
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
        handle.downloadFile(directory, linkage);
      })
      callback("ALL DONE: " + outXML);
    })
  };

  var queue = async.queue(function (getRecordUrl, callback) {
    parse.parseCsw(getRecordUrl, function (data) {
      async.each(data, function (item) {
        async.waterfall([
          function (callback) {
            constructor(item, callback);
          },
          function (data, callback) {
            processor(data, function (data) {
              console.log(data);
            })
          },
        ], function (error, result) {
          if (error) console.log(error);
        });
      })
      callback();
    })
  }, 1);

  queue.drain = function () {
    console.log("All getRecordUrls have been processed.");
  }
  
  function startQueue () {
    utility.doRequest(/*33875*/10000, 5, function (x) {
      var base = "http://geothermaldata.org/csw?";
      utility.buildUrl(base, x.counter, x.increment, function (getRecords) {
        queue.push(getRecords);
      });
    })
  }

  startQueue();
}