#!/usr/bin/env node

var async = require("async"),
  parse = require("parse"),
  archive = require("archive");

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
    typeNames = "gmd:MD_Metadata",
    resultType = "results",
    elementSetName = "full";
  
  return {
    host: host,
    path: path + "Request=" + request + "&service=" + service + "&typeNames=" + 
      typeNames + "&resultType=" + resultType + "&elementSetName=" + 
      elementSetName + "&startPosition=" + startPosition + "&maxRecords=" +
      maxRecords
  }
}

function parseCsw () {
  var parameters = constructRequest(0, 0);
  
}