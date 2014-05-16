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
  var parameters = constructRequest(1, 50);
  parse.parseCsw(parameters, function (xml) {
		var linkages = xml.linkages;

			_.each(linkages, function (linkage) {
				//handle.pingUrl(linkage);
				
				var parsedUrl = url.parse(linkage);
				var fileName = parsedUrl.path.replace(/^\/*/,"");   // Remove any number of leading slashes (/)
				fileName = fileName.replace(/[^a-zA-Z0-9_.-]/gim, "_");  // Replace with an underscore anything that is not a-z, 'A-Z, 0-9, _, . or -
				var dirName = parsedUrl.hostname.replace(/[^a-zA-Z0-9_.-]/gim, "_");
				var filePath = path.join(__dirname, "outputs", dirName);
				
				if (fileName != "") {
					handle.buildDirectory(filePath, function() {
						// Write the metadata ISO19139 XML
						handle.writeXML(filePath, xml.fileId, xml.fullRecord);
						// Write the referenced files
						handle.downloadFile(filePath, fileName, linkage);
					});
				}
			});
  })
}