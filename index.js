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
  .example("$0 -d -c http://geothermaldata.org/csw?", 
    "Scrape an entire CSW and download all linkages")
  
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

  .alias("w", "wfs")
  .describe("w", "Scrape WFS linkages")

  .alias("p", "pingpong")
  .describe("p", "Ping every linkage in every metadata record")

  .alias("z", "zip")
  .describe("z", "Traverse outputs and force compression")

  .alias("g", "glacier")
  .describe("g", "Stream compressed directory to AWS Glacier")

  .alias("d", "download")
  .describe("d", "Scrape a CSW and download linkages")
//  .demand("c")
  .argv;

var cmdQueue = [];
if (argv.download) cmdQueue.push(scrapeCsw);
if (argv.pingpong) cmdQueue.push(pingPong);
if (argv.zip) cmdQueue.push(zipZap);
if (argv.glacier) cmdQueue.push(awsGlacier);
if (argv.wfs) cmdQueue.push(onlyProcessWfS);

async.series(cmdQueue);

function scrapeCsw () {
  var base = path.dirname(require.main.filename);
  var dirs = utility.buildDirs(base);
  var base = argv.csw;
  var increment = argv.increment;
  var start = argv.start;
  var max = argv.max;

  function recursiveScrape (base, start, increment, max) {
    start = typeof start !== "undefined" ? start : 1;
    increment = typeof increment !== "undefined" ? increment : 10;
    max = typeof max !== "undefined" ? max : 10000000;

    utility.buildGetRecords(base, start, increment, function (getUrl) {
      parse.parseCsw(getUrl, function (data) {
        if (data) {
          async.waterfall([
            function (callback) {
              constructor(dirs, data, callback);
            },
            function (data, callback) {
              processor(data, callback);
            },
/*
            function (uncompressed, compressed, callback) {
              zipper(uncompressed, compressed, callback);
            },
*/
          ], function (error, result) {
            if (error) callback(error);
          });
        }
        if (data["next"]) {
          console.log(data["next"]);
          if (data["next"] > 0 && data["next"] <= max)
            recursiveScrape(base, data["next"], increment, max);
        }
      })
    })    
  }
  recursiveScrape(base, start, increment, max);
}

function pingPong () {
  var base = path.dirname(require.main.filename);
  var dirs = utility.buildDirs(base);
  var base = argv.csw;
  var increment = argv.increment;
  var start = argv.start;
  var max = argv.max;

  function recursivePing (base, start, increment, max) {
    start = typeof start !== "undefined" ? start : 1;
    increment = typeof increment !== "undefined" ? increment : 100;
    max = typeof max !== "undefined" ? max : 10000000;
    
    utility.buildGetRecords(base, start, increment, function (getUrl) {
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
          if (data["next"] > 0 && data["next"] <= max) 
            recursivePing(data["next"]);
        }
      })
    })    
  }
  recursivePing(start);
}

function zipZap () {
  var base = path.dirname(require.main.filename);
  var dirs = utility.buildDirs(base);
  utility.longWalk(dirs["record"], function (parents) {
    var parentCounter = parents.length;
    var parentIndex = 0;
    function recursiveCompress (parent) {
      var parentExt = path.extname(parent);
      if (parentExt === ".zip") {
        parentIndex += 1;
        if (parentIndex !== parentCounter) {
          recursiveCompress(parents[parentIndex]);          
        }
      }

      if (parentExt !== ".zip") {
        parentIndex += 1;
        if (parentIndex <= parentCounter) {
          utility.longWalk(parent, function (children) {
            var childCounter = children.length;
            var childIndex = 0;
            function recursiveZip (child) {
              var childExt = path.extname(child);
              if (childExt === ".zip") {
                childIndex += 1;
                if (childIndex <= childCounter) {
                  console.log(child);
                  recursiveZip(children[childIndex]);
                } else {
                  recursiveCompress(parents[parentIndex]);
                }
              }

              if (childExt !== ".zip") {
                childIndex += 1;
                if (childIndex <= childCounter) {
                  zipper(child, child + ".zip", function () {
                    console.log(child + ".zip");
                    recursiveZip(children[childIndex]);                    
                  })
                } else {
                  zipper(parent, parent + ".zip", function () {
                    console.log(parent + ".zip");
                    recursiveCompress(parents[parentIndex]);
                  })
                }                
              }
            }

            recursiveZip(children[childIndex]);
          })
        }
      }
    }
    recursiveCompress(parents[parentIndex]);
  }) 
}

function awsGlacier () {
  var base = path.dirname(require.main.filename);
  var dirs = utility.buildDirs(base);
  var vault = argv.vault;
  utility.longWalk(dirs["record"], function (parents) {
    var parentCounter = parents.length;
    var parentIndex = 0;
    function recursiveWalk (parent) {
      utility.longWalk(parent, function (children) {
        var childCounter = children.length;
        var childIndex = 0;
        function recursiveStroll (child) {
          utility.longWalk(child, function (cFile) {
            var cFileCounter = cFile.length;
            var cFileIndex = 0;
            function recursiveUpload (file) {
              archiver.uploadToS3(file, function (res) {
                console.log(res);
                cFileIndex += 1;
                if (cFileIndex < cFileCounter) {
                  recursiveUpload(cFile[cFileIndex]);
                }
                if (cFileIndex === cFileCounter) {
                  childIndex += 1;
                  if (childIndex < childCounter) {
                    recursiveStroll(children[childIndex]);
                  }
                  if (childIndex === childCounter) {
                    parentIndex += 1;
                    recursiveWalk(parents[parentIndex]);
                  }
                }
              })
            }
            recursiveUpload(cFile[cFileIndex]);
          })
        }
        recursiveStroll(children[childIndex]);
      })
    }
    recursiveWalk(parents[parentIndex]);
  })
}

///////////////////////////////////////////////////////////////////////////////
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

function onlyProcessWfS (dir, linkage, callback) {
  var base = path.dirname(require.main.filename);
  var dirs = utility.buildDirs(base);
  var base = argv.csw;
  var increment = argv.increment;
  var start = argv.start;
  var max = argv.max;

  function recursiveScrape (base, start, increment, max) {
    start = typeof start !== "undefined" ? start : 1;
    increment = typeof increment !== "undefined" ? increment : 10;
    max = typeof max !== "undefined" ? max : 10000000;

    utility.buildGetRecords(base, start, increment, function (getUrl) {
      parse.parseCsw(getUrl, function (data) {
        if (data) {
          async.waterfall([
            function (callback) {
              constructor(dirs, data, callback);
            },
            function (data, callback) {
              processorWfs(data, callback);
            },
          ], function (error, result) {
            if (error) callback(error);
          });
        }
        if (data["next"]) {
          console.log(data["next"]);
          if (data["next"] > 0 && data["next"] <= max)
            recursiveScrape(base, data["next"], increment, max);
        }
      })
    })    
  }
  recursiveScrape(base, start, increment, max);
}

function processWFS (dir, linkage, callback) {
  parse.parseGetCapabilitiesWFS(linkage, function (wfsGet) {
    var wfsCounter = wfsGet.length;
    var wfsIndex = 0;
    function recursiveWfs (wfs) {
      handle.configurePaths(dir, wfs, function (res) {
        var outPath = path.join(res["directory"], res["file"]);
        handle.buildDirectory(outPath, function (out) {
          var urlQuery = url.parse(wfs)["query"];
          var typeName = querystring.parse(urlQuery)["typeNames"];
          if (typeName === "aasg:WellLog") {
            parse.parseWellLogsWFS(res, function (data) {
              if (data) {
                var outRecord = path.join(outPath, data["id"]);
                handle.buildDirectory(outRecord, function (dir) {
                  var wfsXml = path.join(outRecord, data["id"] + ".xml");
                  handle.writeXML(wfsXml, data["xml"], function () {
                    async.each(data["linkages"], function (linkage) {
                      handle.download(outRecord, linkage, function (res) {
                        console.log("RES:", res);
                      })                        
                    })
                  })
                })
              }
              if (data === "end_of_stream") {
                wfsIndex += 1;
                if (wfsIndex < wfsCounter) {
                  recursiveWfs(wfsGet[wfsIndex]);
                }
                if (wfsIndex === wfsCounter) {
                  callback();
                }
              }
            })
          } else {
            res["directory"] = outPath;
            parse.parseGetFeaturesWFS(res, function () {
              wfsIndex += 1;
              if (wfsIndex < wfsCounter) {
                recursiveWfs(wfsGet[wfsIndex]);
              }
              if (wfsIndex === wfsCounter) {
                callback();
              }
            })
          }
        })
      })
    }
    recursiveWfs(wfsGet[wfsIndex]);
  })    
}

function processorWfs (construct, callback) {
  var counter = construct["linkages"].length;
  var increment = 0;
  async.each(construct["linkages"], function (data) {
    if (typeof data !== "undefined") {
      handle.buildDirectory(data["parent"], function (parent) {
        handle.buildDirectory(data["child"], function (child) {
          if (data["linkage"].search("service=WFS") > -1) {
            processWFS(data["child"], data["linkage"], function () {
              console.log("ALL DONE: ", data["child"]);
            })
          }
        })
      })
    }
  })
}

function processor (construct, callback) {
  var counter = construct["linkages"].length;
  var increment = 0;
  async.each(construct["linkages"], function (data) {
    if (typeof data !== "undefined") {
      handle.buildDirectory(data["parent"], function (parent) {
        handle.buildDirectory(data["child"], function (child) {
          handle.writeXML(data["outXML"], construct["fullRecord"], function () {
            if (data["linkage"].search("service=WFS") !== -1) {
              increment += 1;
              if (increment === counter) {
                callback(null, data["child"], data["childArchive"]);
              }
            } else {
              handle.download(data["child"], data["linkage"], function () {
                console.log(data["child"])
                increment += 1;
                if (increment === counter) {
                  callback(null, data["child"], data["childArchive"]);                
                }
              })              
            }
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