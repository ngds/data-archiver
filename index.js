#!/usr/bin/env node

var async = require("async");
var parse = require("./parse");
var handle = require("./handle");
  //archive = require("./archive");

var argv = require("yargs")
  .usage("Command line utility for archiving NGDS data on Amazon S3")

  .alias("p", "parse")
  .describe("Parse a CSW")
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

function parseCsw () {
  var parameters = constructRequest(1, 1000);
  parse.parseCsw(parameters, function (xml) {
//    parse.downloadFiles(xml);
    handle.writeXML(xml);
//    parse.pingUrl(xml);

//    parse.writeLocalFile(response);
  })
}








