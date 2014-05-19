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

  .alias("o", "out")
  .describe("Specify a base directory for process outputs")
  .argv;

var queue = [];
if (argv.parse) queue.push(parseCsw);

async.series(queue);

function constructRequest(startPosition, maxRecords) {
  var host = "catalog.usgin.org",
    path = "/geothermal/csw?",
    request = "GetRecords",
    service = "CSW",
    resultType = "results",
    elementSetName = "full",
    outputSchema = "http://www.isotc211.org/2005/gmd";
  
  return {
    host: host,
    path: path + "Request=" + request + "&service=" + service + "&resultType=" 
      + resultType + "&elementSetName=" + elementSetName + "&startPosition=" 
      + startPosition + "&maxRecords=" + maxRecords + "&outputSchema="
      + outputSchema
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

function parseCsw () {
  var parameters = constructRequest(1, 1000);
  var dirs = constructDirectories();

  parse.parseCsw(parameters, function (xml) {
    var directory = path.join(dirs["records"], xml.fileId);
    handle.buildDirectory(directory, function () {
      var outputXml = path.join(directory, fileId, ".xml");
      handle.writeXML(outputXml, xml.fullRecord);

      var pingLog = path.join(dirs["logs"], "linkage-status.csv");
      var deadUrls = path.join(dirs["logs"], "dead-linkages.csv");
      handle.configurePaths(directory, xml.linkages, function (fsys) {
        handle.pingUrl(fsys.linkage, pingLog, deadUrls, function (status) {
          
        })
      })
    })
/*
    handle.configurePaths(linkages, function (filePath) {
      if (fileName !== "") {
        handle.buildDirectory(filePath, function() {
          // Write the metadata ISO19139 XML
          handle.writeXML(filePath, xml.fileId, xml.fullRecord);
          // Write the referenced files
          handle.downloadFile(filePath, fileName, linkage);
        });
      }
    })
*/
	});
}











