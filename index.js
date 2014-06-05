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
  .demand("k")
  .argv;

var cmdQueue = [];
if (argv.parse) cmdQueue.push(parseCsw);

async.series(cmdQueue);

function parseCsw () {
  var parameters = "http://geothermaldata.org/csw?request=GetRecords&service=CSW&version=2.0.2&resultType=results&outputSchema=http://www.isotc211.org/2005/gmd&typeNames=csw:Record&elementSetName=full&maxRecords=0";

  parse.scaleRequest(parameters);
}

function _parseCsw () {
  var base = argv.out ? argv.out : path.dirname(require.main.filename);
  var dirs = utility.buildDirs(base);
  var vault = "ngds-archive";
  var datastore = new utility.datastore();
  
  var queue = async.queue(function (getRecordUrl, callback) {
    console.log("GET: " + getRecordUrl["host"] + getRecordUrl["path"]);
    parse.parseCsw(getRecordUrl, function (data) {
      data.forEach(function (item) {
        async.waterfall([
          function (callback) {
            constructor(dirs, item, callback);
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
      })
      callback();
    })
  }, 1);

  queue.drain = function () {
    if (queue.length() === 0) {      
    }
  }
  
  function startQueue () {
    utility.doRequest(33875, 5, function (x) {
      var base = "http://geothermaldata.org/csw?";
      utility.buildUrl(base, x.counter, x.increment, function (getRecords) {
        queue.push(getRecords);
      });
    })
  }
  startQueue();
};
/*
function queue () {
  var queue = async.queue(function () {}, 1);
  function start () {
    utility.doRequest
  }
}
*/
function logger (dirs, datastore, callback) {
  timber.writeUrlStatus(dirs, datastore, function () {
    callback(null, datastore);
  })
};

function constructor (dirs, item, callback) {
  var construct = _.map(item.linkages, function (linkage) {
    if (linkage.length > 0) {
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
          "outXML": outXML,
          "fileId": item.fileId,
          "linkage": linkage,
          "fullRecord": item.fullRecord,
        }          
      }
    }
  });
  callback(null, construct);
};

function pingPong () {

}

function processor (construct, callback) {
  async.each(construct, function (data) {
    if (typeof data !== "undefined") {
      handle.buildDirectory(data["parent"], function (parent) {
        handle.buildDirectory(data["child"], function (child) {
          handle.writeXML(data["outXML"], data["fullRecord"], function () {
            if (data["linkage"].search("service=WFS") !== -1) {
              callback();
            } else {
              handle.download(data["child"], data["linkage"], function () {
                callback(null, data["child"], data["childArchive"]);
              })
            }
          });
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