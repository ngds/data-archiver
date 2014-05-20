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

var queue = [];
if (argv.parse) queue.push(parseCsw);
if (argv.urls) queue.push(constructRequests);

async.series(queue);

function constructRequests () {
  var base = argv.out 
      ? argv.out 
      : path.dirname(require.main.filename);

  var dirs = utility.buildDirs(base);
  var unique = [];
  
  utility.doRequest(33875, 100, function (d) {
    var base = "http://geothermaldata.org/csw?";
    utility.buildUrl(base, d.counter, d.increment, function (getRecords) {
      console.log(getRecords);
      parseLinkageHosts(getRecords, unique, dirs);      
    });
  })
}

function parseLinkageHosts (parameters, unique, dirs) {
  parse.parseCsw(parameters, function (xml) {
    var pingLog = path.join(dirs["logs"], "linkage-status.csv");
    var deadUrls = path.join(dirs["logs"], "dead-linkages.csv");
    var linkageLog = path.join(dirs["logs"], "unique-linkages.csv");
    _.each(xml.linkages, function (linkage) {
      var host = url.parse(linkage)["protocol"] + "//" + url.parse(linkage)["host"];
      if (_.indexOf(unique, host) === -1) {
        unique.push(host);
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











