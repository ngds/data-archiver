#!/usr/bin/env node

var async = require("async"),
  expat = require("node-expat"),
  parser = new expat.Parser("UTF-8"),
  http = require("http"),
  xmlStream = require("xml-stream");

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

function scaleRequest (callback) {
  var parameters = constructRequest(0, 0),
    counter = 0,
    total,
    increment = 100;

  http.get(parameters).on("response", function (response) {
  	var xml = new xmlStream(response, "utf-8");
  	xml.on("endElement: csw:SearchResults", function (results) {
      total = results.$.numberOfRecordsMatched
      while (counter < total) {
  	    counter += increment;
      }
  
      var placeHolder = (counter-increment),
      lastRecord = ((increment-(counter-total))+placeHolder);

      if (typeof callback === "function") {
    	callback({
  	      "increment": increment,
  	      "placeHolder": placeHolder,
  	      "lastRecord": lastRecord,
        })
      }
  	})
  }).end();
}

function parseCsw () {
  scaleRequest(function (response) {
  	console.log(response);
  })
}
