#!/usr/bin/env node

var async = require("async");
var path = require("path");
var url = require("url");
var fs = require("fs.extra");
var _ = require("underscore");
var querystring = require("querystring");
var lib = require("./lib");

var memwatch = require("memwatch");
memwatch.on("stats", function (stats) {
  console.log("USAGE TREND: " + stats["usage_trend"]);
});

var argv = require("yargs")
  .usage("Command line utility for archiving NGDS data on Amazon S3")
  .example("$0 -d -c http://geothermaldata.org/csw?", 
    "Scrape an entire CSW and download all linkages")

  .alias("d", "download")
  .describe("d", "Scrape a CSW and download linkages")

  .alias("c", "csw")
  .describe("c", "CSW endpoint to scrape data from")

  .alias("m", "max")
  .describe("m", "Maximum limit of metadata records to scrape")

  .alias("f", "first")
  .describe("f", "Metadata record to start scraping from")

  .alias("i", "increment")
  .describe("i", "Number of metadata records to return per request")

  .alias("h", "pingHosts")
  .describe("h", "Ping every host")

  .alias('l', 'pingLinkages')
  .describe('l', 'Ping every linkage in every metadata record')

  .alias("w", "wfs")
  .describe("w", "Scrape WFS linkages")

  .alias("s", "s3")
  .describe("s", "Stream compressed directory to AWS S3")

  .alias("v", "vault")
  .describe("v", "Name of Amazon S3 vault to pipe data to")

  .demand("c")
  .argv;

var cmdQueue = [];
if (argv.download) cmdQueue.push(scrapeCsw);
if (argv.wfs) cmdQueue.push(scrapeWfs);
if (argv.pingHosts) cmdQueue.push(pingHosts);
if (argv.pingLinkages) cmdQueue.push(pingLinkages);
if (argv.s3 && argv.vault) cmdQueue.push(uploadS3);
async.series(cmdQueue);

function scrapeCsw () {
  var csw = argv.csw;
  var increment = argv.increment;
  var start = argv.first;
  var end = argv.end;
  var base = path.dirname(require.main.filename);
  lib.scrapeCsw(base, csw, increment, start, end);
}

function scrapeWfs () {
  var csw = argv.csw;
  var increment = argv.increment;
  var start = argv.first;
  var end = argv.end;
  var base = path.dirname(require.main.filename);
  lib.scrapeWfs(base, csw, increment, start, end);
}

function pingHosts () {
  var csw = argv.csw;
  var increment = argv.increment;
  var start = argv.first;
  var end = argv.end;
  var whichPing = "hosts";
  var base = path.dirname(require.main.filename);
  lib.makePing(base, csw, increment, start, end, whichPing);
}

function pingLinkages () {
  var csw = argv.csw;
  var increment = argv.increment;
  var start = argv.first;
  var end = argv.end;
  var whichPing = "linkages";
  var base = path.dirname(require.main.filename);
  lib.makePing(base, csw, increment, start, end, whichPing);
}

function uploadS3 () {
  var vault = argv.vault;
  var base = path.dirname(require.main.filename);
  lib.baseAwsS3(base, vault);
}