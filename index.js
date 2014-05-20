#!/usr/bin/env node

var async = require("async");
var parse = require("./parse");
var handle = require("./handle");
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

var queue = [];
if (argv.parse) queue.push(parseCsw);
if (argv.urls) queue.push(constructRequests);

async.series(queue);

function constructRequest(startPosition, maxRecords) {
  var host = "catalog.usgin.org",
    path = "/geothermal/csw?",
    request = "GetRecords",
    service = "CSW",
    resultType = "results",
    elementSetName = "full",
    outputSchema = "http://www.isotc211.org/2005/gmd",
    typeNames = "csw:Record";
  
  return {
    host: host,
    path: path + "Request=" + request + "&service=" + service + "&resultType=" 
      + resultType + "&elementSetName=" + elementSetName + "&startPosition=" 
      + startPosition + "&maxRecords=" + maxRecords + "&outputSchema="
      + outputSchema + "&typeNames=" + typeNames
  }
}

function constructDirectories (callback) {
  var base = argv.out 
      ? argv.out 
      : path.dirname(require.main.filename);

  var dirs = {};
  dirs["out"] = path.join(base, "outputs");
  dirs["record"] = path.join(dirs["out"], "records");
  dirs["archive"] = path.join(dirs["out"], "archive");
  dirs["logs"] = path.join(dirs["out"], "logs");

  for (var key in dirs) {
    if (fs.existsSync(dirs[key])) {
      console.log("Path exists: " + dirs[key]);
    } else {
      fs.mkdirSync(dirs[key]);
    }
  };
  return dirs;
}

function scaleRequest (total, increment, callback) {
  var counter = 1;
  while (counter < total) {
    counter += increment;
  }

  var placeHolder = (counter-increment);
  var lastRecord = ((increment-(counter-total))+placeHolder);

  if (typeof callback === "function") {
    callback({
      "increment": increment,
      "placeHolder": placeHolder,
      "lastRecord": lastRecord,
    })
  }
}

function parseLinkages(callback) {
  scaleRequest(33875, 100, function (response) {
    var counter = 1;
    var increment = response.increment;
    var holder = response.placeHolder;
    var last = response.lastRecord;
    if (counter === 1) {
      callback({"counter": counter, "increment": increment});      
    }
    while (counter < holder) {
      counter += increment;
      callback({"counter": counter, "increment": increment});
    }
    if (counter === holder) {
      increment = (last - holder);
      callback({"counter": counter, "increment": increment});
    }
  })
}

function constructRequests () {
  parseLinkages(function (response) {
    var url = constructRequest(response.counter, response.increment);
    console.log(url);
  })
}

function _parseLinkageHosts (start, end) {
  var parameters = constructRequest(start, end);
  var dirs = constructDirectories();
  var uniqueLinkages = [];

  parse.parseCsw(parameters, function (xml) {
    var pingLog = path.join(dirs["logs"], "linkage-status.csv");
    var deadUrls = path.join(dirs["logs"], "dead-linkages.csv");
    var linkageLog = path.join(dirs["logs"], "unique-linkages.csv");
    _.each(xml.linkages, function (linkage) {
      var host = url.parse(linkage)["protocol"] + "//" + url.parse(linkage)["host"];
      if (_.indexOf(uniqueLinkages, host) === -1) {
        uniqueLinkages.push(host);
        handle.writeLinkage(linkageLog, host);
        handle.pingUrl(host, pingLog, deadUrls, function (error, link) {
          if (error) console.log(error);
          if (link) console.log(link);
        })
      }
    })
  })
}

function parseCsw () {
  var parameters = constructRequest(1, 1000);
  var dirs = constructDirectories();

  parse.parseCsw(parameters, function (xml) {
    var directory = path.join(dirs["record"], xml.fileId);
    handle.buildDirectory(directory, function () {
      var outputXml = path.join(directory, xml.fileId + ".xml");
      handle.writeXML(outputXml, xml.fullRecord);
      var pingLog = path.join(dirs["logs"], "linkage-status.csv");
      var deadUrls = path.join(dirs["logs"], "dead-linkages.csv");
      handle.configurePaths(directory, xml.linkages, function (fsys) {
        handle.pingUrl(fsys.linkage, pingLog, deadUrls, function (error, link) {
          if (error) console.log(error);
//          handle.downloadFile(fsys.directory, fsys.file, link);
        })
      })
    })
	});
}











