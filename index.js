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
      data.forEach(function (item) {
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
  var directory = path.join(dirs["record"], item.fileId);
  var archived = path.join(dirs["archive"], item.fileId + ".zip");
  var outXML = path.join(directory, item.fileId + ".xml");

  var construct = {
    "directory": directory,
    "archived": archived,
    "outXML": outXML,
    "fileId": item.fileId,
    "linkages": item.linkages,
    "fullRecord": item.fullRecord,
  }
  callback(null, construct, store);
};

function processor (dirs, data, store, callback) {
  var directory = data["directory"];
  var archived = data["archived"];
  var outXML = data["outXML"];
  handle.buildDirectory(dirs, directory, function () {
    handle.writeXML(outXML, data.fullRecord);
    var counter = data.linkages.length;
    var increment = 0;
    async.each(data.linkages, function (linkage) {
      var host = url.parse(linkage)["host"];
      if (_.indexOf(store["dead"], host) === -1) {
        if (linkage.search("service=WFS") !== -1) {
            /*
            parse.parseGetCapabilitiesWFS(linkage, function (linkages) {
              async.forEach(linkages, function (linkage) {
                handle.configurePaths(directory, linkage, function (res) {
                  handle.buildDirectory(res.directory, function () {
                    var urlQuery = url.parse(res.linkage)["query"];
                    var typeName = querystring.parse(urlQuery)["typeNames"];
                    if (typeName === "aasg:WellLog") {
                      console.log("GOT A WELL LOG WFS");
                      parse.parseWellLogsWFS(res.linkage, res.directory, function (response) {
                        parse.parseWellLogs(response);
                      })
                    }

                    if (typeName !== "aasg:WellLog") {
                      parse.parseGetFeaturesWFS(res.linkage, res.directory, res.file, function (data) {
                        
                      })
                    }                   
                  })
                })
              })
            })
            */
        } else {
          handle.shouldDownload(linkage, function(err, res) {
            if (res) {
              handle.downloadFile(dirs, directory, res, function () {
                increment += 1;
                if (increment === counter) {
                  callback(null, directory, archived);               
                }
              });
            }
          })
        }
      }
    })
  })
};

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
















