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
if (argv.parse) queue.push(scaleRequest);

async.series(queue);
/*
function scaleRequest (total, increment, counter) {
  var counter = 0;
  increment = typeof increment !== "undefined" ? increment : 100;

  while (counter < total) {
  	counter += increment;
  }
  var placeHolder = (counter-increment),
    lastRecord = ((increment-(counter-total))+secondToLast);
  return {
  	"placeHolder": lastCounter,
  	"lastRecord": lastRecord,
  }
}
*/
function scaleRequest (options, callback) {
  var options = {
  	host: "catalog.usgin.org",
  	path: "/geothermal/csw?Request=GetRecords&service=CSW&typeNames=gmd:MD_Metadata&resultType=results&elementSetName=full",
  };


  http.get(options).on("response", function (response) {
  	var xml = new xmlStream(response, "utf-8");
  	xml.on("text: dct:references", function (results) {
//  	  var totalRecords = results.$.numberOfRecordsMatched;
//  	  var increment = 100;
      console.log(results);
  	})
  })
}

/*
function initialFunction () {
  var options = {
  	host: "catalog.usgin.org",
  	path: "/egi-geoportal/csw?request=GetRecords&service=CSW&version=2.0.2&resultType=results&maxRecords=100&"
  }

  http.get(options).on("response", function (response) {
    var xml = new xmlStream(response, "utf-8");
  	xml.on("text: dc:identifier", function (item) {
  	  console.log(item.$text);
  	})
  })
}
*/