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
          function (datastore, callback) {
            constructor(dirs, item, datastore, callback);
          },
          function (data, datastore, callback) {
            processor(data, datastore, callback);
          },
          function (sanityCheck, callback) {
            zipper(sanityCheck, callback);
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
    utility.doRequest(50/*33875*/, 5, function (x) {
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
      handle.pingLogger(host, function (error, response) {
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
  var counter = item.length;
  var increment = 0;
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
  callback(null, construct, store);
};

function processor (construct, store, callback) {
  var counter = construct.length;
  var increment = 0;
  var insanityCheck = [];
  var sanityCheck = [];
  async.each(construct, function (data) {
    if (typeof data !== "undefined") {
      handle.buildDirectory(data["parent"], function (parent) {
        handle.buildDirectory(data["child"], function (child) {
          handle.writeXML(data["outXML"], data["fullRecord"], function () {
            if (_.indexOf(store["dead"], data["host"]) === -1) {
              if (data["linkage"].search("service=WFS") !== -1) {
/*
                sanityCheck.push({
                  "child": data["child"], 
                  "archive": data["childArchive"]
                });
*/
                if (_.indexOf(insanityCheck, data["childArchive"]) === -1) {
                  insanityCheck.push(data["childArchive"]);                  
                }

                increment += 1;
                if (increment === counter) {
                  callback(null, sanityCheck);        
                }
              } else {
                handle.download(data["child"], data["linkage"], function () {
                  if (_.indexOf(insanityCheck, data["childArchive"]) === -1) {
                    insanityCheck.push(data["childArchive"]);                  
                    sanityCheck.push({
                      "child": data["child"], 
                      "archive": data["childArchive"]
                    });
                  }

                  increment += 1;
                  if (increment === counter) {
                    callback(null, sanityCheck);        
                  }
                })
              }
            }            
          });
        })
      })
    }
  })
}

function zipper (data, callback) {
  var counter = data.length;
  var increment = 0;
  data.forEach(function(item) {
    var uncompressed = item["child"];
    var compressed = item["archive"];
    handle.compressDirectory(uncompressed, compressed, function (res) {
      increment += 1;
      if (increment === counter) {
        callback(null);        
      }
    })    
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