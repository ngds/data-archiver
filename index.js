#!/usr/bin/env node

var async = require("async");
var parse = require("./parse");
var handle = require("./handle");
var archiver = require("./archive");
var utility = require("./utility");
var timber = require("./timber");
var path = require("path");
var url = require("url");
var fs = require("fs");
var _ = require("underscore");
var querystring = require("querystring");

var memwatch = require("memwatch");
memwatch.on("stats", function (stats) {
  console.log("USAGE TREND: " + stats["usage_trend"]);
});

var argv = require("yargs")
  .usage("Command line utility for archiving NGDS data on Amazon Glacier")
  
  .alias("c", "csw")
  .describe("c", "CSW endpoint to scrape data from")

  .alias("m", "max")
  .describe("m", "Maximum limit of metadata records to scrape")

  .alias("s", "start")
  .describe("s", "Metadata record to start scraping from")

  .alias("i", "increment")
  .describe("i", "Number of metadata records to return per request")

  .alias("v", "vault")
  .describe("v", "Name of Amazon Glacier vault to pipe data to")

  .alias("p", "pingpong")
  .describe("p", "Ping every linkage in every metadata record")

  .alias("k", "parse")
  .describe("Parse a CSW")
  .demand("p")
  .argv;

var cmdQueue = [];
if (argv.parse) cmdQueue.push(scrapeCsw);
if (argv.pingpong) cmdQueue.push(pingPong);

async.series(cmdQueue);

function scrapeCsw () {
  var base = argv.vault 
    ? argv.vault
    : path.dirname(require.main.filename);
  var dirs = utility.buildDirs(base);
  var vault = "ngds-archive";
  function recursiveScrape (start) {
    start = typeof start !== "undefined" ? start : 1;
    var base = "http://geothermaldata.org/csw?";
    utility.buildGetRecords(base, start, 10, function (getUrl) {
      parse.parseCsw(getUrl, function (data) {
        if (data) {
          async.waterfall([
            function (callback) {
              constructor(dirs, data, callback);
            },
            function (data, callback) {
              processor(data, callback);
            },
            function (uncompressed, compressed, callback) {
              zipper(uncompressed, compressed, callback);
            },
          ], function (error, result) {
            if (error) callback(error);
          });
        }
        if (data["next"]) {
          console.log(data["next"]);
          if (data["next"] > 0)
            recursiveScrape(data["next"]);
        }
      })
    })    
  }
  recursiveScrape();
}

function pingPong () {
  var base = argv.vault 
    ? argv.vault
    : path.dirname(require.main.filename);
  var dirs = utility.buildDirs(base);
  function recursivePing (start) {
    start = typeof start !== "undefined" ? start : 1;
    var base = "http://geothermaldata.org/csw?";
    utility.buildGetRecords(base, start, 100, function (getUrl) {
      parse.parseCsw(getUrl, function (data) {
        if (data) {
          data["csw"] = base;
          async.waterfall([
            function (callback) {
              pingLogger(dirs, data, callback);
            },
          ])
        }

        if (data["next"]) {
          console.log("NEXT: ", data["next"]);
          if (data["next"] > 0) recursivePing(data["next"]);
        }
      })
    })    
  }
  recursivePing();
}

function pingLogger (dirs, data, callback) {
  async.each(data.linkages, function (linkage) {
    if (typeof linkage !== "undefined") {
      handle.pingPong(linkage, function (err, res) {
        if (err) callback(err);
        if (res) {
          var status = {
            "time": new Date().toISOString(),
            "csw": data["csw"],
            "id": data["fileId"],
            "linkage": linkage,
            "status": res["res"]["statusCode"],
          }

          timber.writePingStatus(dirs, status, function (err, res) {
            if (err) callback(err);
            else callback();
          })
        }
      })
    }
  })
}

function constructor (dirs, item, callback) {
  var linkages = _.map(item.linkages, function (linkage) {
      var parsedUrl = url.parse(linkage);
      var host = parsedUrl["host"];
      if (host) {
        var parent = path.join(dirs["record"], host);
        var parentArchive = path.join(dirs["record"], host + ".zip");
        var child = path.join(parent, item.fileId);
        var childArchive = path.join(parent, item.fileId + ".zip");
        var outXML = path.join(child, item.fileId + ".xml");
        
        return {
          "host": host,
          "parent": parent,
          "parentArchive": parentArchive,
          "child": child,
          "childArchive": childArchive,
          "linkage": linkage,
          "outXML": outXML,
        }          
      }
  });

  construct = {
    "linkages": linkages,
    "fileId": item.fileId,
    "fullRecord": item.fullRecord,
  }
  callback(null, construct);
};

function processor (construct, callback) {
  var counter = construct["linkages"].length;
  var increment = 1;
  async.each(construct["linkages"], function (data) {
    if (typeof data !== "undefined") {
      handle.buildDirectory(data["parent"], function (parent) {
        handle.buildDirectory(data["child"], function (child) {
          handle.writeXML(data["outXML"], construct["fullRecord"], function () {
            handle.download(data["child"], data["linkage"], function () {
              increment += 1;
              if (increment === counter) {
                callback(null, data["child"], data["childArchive"]);                
              }
            })
          })
        })
      })
    }
  })
}

function zipper (uncompressed, compressed, callback) {
  if (uncompressed && compressed) {
    handle.compressDirectory(uncompressed, compressed, function (res) {
      callback(null);        
    })    
  }
};

function vault (callback) {
  archiver.checkGlacierVaults(vault, function (error, response) {
    if (error) callback(error);
    else callback(null);
  });    
};

function iceberg (uncompressed, compressed, vault, callback) {
  archiver.uploadToGlacier(uncompressed, compressed, vault, function (error, response) {
    if (error) callback(error);
    else callback(response);
  })
};