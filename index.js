#!/usr/bin/env node

var async = require("async");
var parse = require("./parse");
var handle = require("./handle");
var path = require("path");
var url = require("url");
var _ = require("underscore");
  //archive = require("./archive");

var argv = require("yargs")
  .usage("Command line utility for archiving NGDS data on Amazon S3")

  .alias("p", "parse")
  .describe("Parse a CSW")

  .alia("o", "out")
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
  var base = argv.out == argv.out ? argv.out : __dirname;

  var dirs = {
    "base": base
  };
  var dirs["out"] = path.join(dirs["base"], "output");
  var dirs["record"] = path.join(dirs["out"], "record");
  var dirs["archive"] = path.join(dirs["out"], "archive");
  var dirs["logs"] = path.join(dirs["out"], "logs");

  function make (callback) {
    for (var key in dirs) {
      handle.buildDirectory(dirs[key]);
    }
    callback(dirs);
  };

  make(function (response) {
    callback(response);
  });
}

function parseCsw () {

  var parameters = constructRequest(1, 50);
  parse.parseCsw(parameters, function (xml) {
		var linkages = xml.linkages;
    handle.configurePaths(linkages, function (filePath) {
      if (fileName != "") {
        handle.buildDirectory(filePath, function() {
          // Write the metadata ISO19139 XML
          handle.writeXML(filePath, xml.fileId, xml.fullRecord);
          // Write the referenced files
          handle.downloadFile(filePath, fileName, linkage);
        });
      }
    })
	});
}











