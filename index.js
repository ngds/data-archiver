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

var argv = require("yargs")
  .usage("Command line utility for archiving NGDS data on Amazon S3")

  .alias("p", "parse")
  .describe("Parse a CSW")
  .argv;

var cmdQueue = [];
if (argv.parse) cmdQueue.push(parseCsw);

async.series(cmdQueue);

function parseCsw () {
  var base = argv.out ? argv.out : path.dirname(require.main.filename);
  var dirs = utility.buildDirs(base);
  var vault = "ngds-archive";
  var datastore = new utility.datastore();
  
  var queue = async.queue(function (getRecordUrl, callback) {
    console.log("GET: " + getRecordUrl["host"] + getRecordUrl["path"]);
    parse.parseCsw(getRecordUrl, function (data) {
      async.each(data, function (item) {
        async.waterfall([
          /*
          function (callback) {
            vault(callback);
          },
          */
          function (callback) {
            pinger(item, datastore, callback);
          },
//          function (datastore, callback) {
//            logger(dirs, datastore, callback);
//          },
          function (datastore, callback) {
            constructor(dirs, item, datastore, callback);
          },
          function (data, datastore, callback) {
            processor(dirs, data, datastore, callback);
          },
          function (directory, archive, callback) {
            zipper(directory, archive, callback);
          },
          function (uncompressed, compressed, callback) {
            iceberg(uncompressed, compressed, vault, function (response) {
              console.log(response);
            })
          }
        ], function (error, result) {
          if (error) callback(error);
        });
      })
      callback();
    })
  }, 1);

  queue.drain = function () {
    if (queue.length() === 0) {
      console.log("All getRecordUrls have been processed.");      
    }
  }
  
  function startQueue () {
    utility.doRequest(33875, 20, function (x) {
      var base = "http://geothermaldata.org/csw?";
      utility.buildUrl(base, x.counter, x.increment, function (getRecords) {
        queue.push(getRecords);
      });
    })
  }
  startQueue();
};

function pinger (data, store, callback) {
  async.forEach(data.linkages, function (linkage) {
    var parsedUrl = url.parse(linkage);
    var host = parsedUrl["protocol"] + "//" + parsedUrl["host"];
    if (_.indexOf(store["unique"], host) === -1) {
      store["unique"].push(host);
      handle.pingUrl(host, function (error, response) {
        if (error) {
          error["ping"] = "DEAD";
          store["status"].push(error);
          store["dead"].push(host);
        } else if (response) {
          response["ping"] = "ALIVE";
          store["status"].push(response);
        }
      })
    }
  })
  callback(null, store);
};

function logger (dirs, datastore, callback) {
  timber.writeUrlStatus(dirs, datastore, function () {
    callback(null, datastore);
  })
};

function constructor (dirs, item, store, callback) {
  var construct = _.each(item.linkages, function (linkage) {
    var parsedUrl = url.parse(linkage);
    var host = parsedUrl["protocol"] + "//" + parsedUrl["host"];
    var parent = path.join(dirs["record"], host);
    var parentArchive = path.join(dirs["record"], host + ".zip");

    var child = path.join(parent, item.fileId);
    var childArchive = path.join(parent, item.fileId + ".zip");
    var outXML = path.join(parent, item.fileId + ".xml");
    
    return {
      "host": host,
      "parent": parent,
      "parentArchive": parentArchive,
      "child": child,
      "archive": childArchive,
      "outXML": outXML,
      "fileId": item.fileId,
      "linkage": linkage,
      "fullRecord": item.fullRecord,
    }
  });
  callback(null, construct, store);
};

function processor (dirs, construct, store, callback) {
  async.each(construct, function (data) {
    handle.buildDirectory(data["parent"], function (err, parent) {
      if (err) callback(err);
      handle.buildDirectory(data["child"], function (err, child) {
        if (err) callback(err);
        handle.writeXML(data["outXML"], data["fullRecord"]);
        if (_.indexOf(store["dead"], data["host"]) === -1) {
          handle.download(store["child"], store["linkage"], function () {
            var sanityCheck;
          })
        }
      })
    })
    callback(null, data["child"], data["childArchive"]);
  })
}

function zipper (uncompressed, compressed, callback) {
  handle.compressDirectory(uncompressed, compressed, function () {
    callback(null, uncompressed, compressed);
  })
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