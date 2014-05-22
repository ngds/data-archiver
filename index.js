#!/usr/bin/env node

var async = require("async");
var parse = require("./parse");
var handle = require("./handle");
var utility = require("./utility");
var path = require("path");
var url = require("url");
var fs = require("fs");
var _ = require("underscore");
  //archive = require("./archive");

var argv = require("yargs")
  .usage("Command line utility for archiving NGDS data on Amazon S3")

  .alias("p", "parse")
  .describe("Parse a CSW")

  .alias("u", "urls")
  .describe("Parse and ping all of the CSW linkages")

  .alias("o", "out")
  .describe("Specify a base directory for process outputs")
  .argv;

var cmdQueue = [];
if (argv.parse) cmdQueue.push(parseCsw);
if (argv.urls) cmdQueue.push(doEverything);

async.series(cmdQueue);

function taskFirst (dirs, xml, callback) {
  var directory = path.join(dirs["record"], xml.fileId);
  handle.buildDirectory(directory, function () {
    var outXML = path.join(directory, xml.fileId + ".xml");
    handle.writeXML(outXML, xml.fullRecord);
  })
  callback(null);
};

function taskSecond (glob, dirs, xml, callback) {
  async.each(xml.linkages, function (linkage) {
    var parsedUrl = url.parse(linkage);
    var host = parsedUrl["protocol"] + "//" + parsedUrl["host"];
    if (_.indexOf(glob["unique"], host) === -1) {
      glob["unique"].push(host);  

      handle.pingUrl(host, function (error, response) {
        if (error) {
          error["ping"] = "DEAD";
          glob["dead"].push(error);
          glob["status"].push(error);
        };

        if (response) {
          response["ping"] = "ALIVE";
          glob["status"].push(response);
        };
      })
    }
  });
  callback(null);
}

function taskThird (glob, dirs, xml, callback) {
  var directory = path.join(dirs["record"], xml.fileId);
  var dead = _.map(glob["dead"], function (record) {
    return record["linkage"];
  });
  async.each(xml.linkages, function (linkage) {
    var parsedUrl = url.parse(linkage);
    var host = parsedUrl["protocol"] + "//" + parsedUrl["host"];
    if (_.indexOf(dead, host) !== -1 && linkage !== "" && linkage !== null) {
      handle.configurePaths(directory, linkage, function (res) {
        handle.downloadFile(res.directory, res.file, res.linkage);
      })
      parse.parseOGC(directory, linkage);
    } 
  });
  callback(null);
}

function taskFifth (glob, dirs, xml, callback) {
  var pingLog = path.join(dirs["logs"], "linkage-status.csv");
  var deadLog = path.join(dirs["logs"], "dead-linkages.csv");
  var uniqueLog = path.join(dirs["logs"], "unique-linkages.csv");
  
  async.parallel([
    function (callback) {
      handle.linkageLogger(glob["status"], pingLog, function () {
        callback();
      })
    },
    function (callback) {
      handle.linkageLogger(glob["dead"], deadLog, function () {
        callback();
      })
    },
    function (callback) {
      handle.linkageLogger(glob["unique"], uniqueLog, function () {
        callback();
      })
    }
  ])
}


function doEverything () {
  var DataStore = function () {
    var linkages = {};
    linkages.unique = [];
    linkages.status = [];
    linkages.dead = [];

    return linkages;
  };

  var ds = new DataStore();
  
  var base = argv.out 
      ? argv.out 
      : path.dirname(require.main.filename);

  var dirs = utility.buildDirs(base);

  //33875
  utility.doRequest(33875, 100, function (data) {
    var base = "http://geothermaldata.org/csw?";
    utility.buildUrl(base, data.counter, data.increment, function (getRecords) {
      parse.parseCsw(getRecords, function (xml) {

        async.series([
          function (callback) {
            taskFirst(dirs, xml, callback);
          },
          function (callback) {
            taskSecond(ds, dirs, xml, callback);
          },
          function (callback) {
            taskThird(ds, dirs, xml, callback)
          },
        ], function (error, result) {
          if (error) console.log(error);
        })
      })
    })
  })
}








