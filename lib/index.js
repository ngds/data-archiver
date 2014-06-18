var parse = require("parse");
var handle = require("handle");
var archiver = require("archive");
var utility = require("utility");
var timber = require("timber");

function buildRequests (csw, increment, start, end, callback) {
  start = typeof start !== "undefined" ? start : 1;
  increment = typeof increment !== "undefined" ? increment : 10;
  end = typeof end !== "undefined" ? end : 10000000;
  utility.buildGetRecords(csw, increment, start, end, function (getUrl) {
    callback(getUrl);
  });
}

function pingHosts (dirs, data, globe, callback) {
  if (data.linkages) {
    async.each(data.linkages, function (linkage) {
      if (typeof linkage !== "undefined") {
        var host = url.parse(linkage)["host"];
        if (globe.indexOf(host) > -1) {
          globe.push(host);
          handle.pingPong(linkage, function (err, res) {
            if (err) callback(err);
            else {
              var status;
              if (res["res"]) {
                var status = {
                  "time": new Date().toISOString(),
                  "csw": data["csw"],
                  "id": data["fileId"],
                  "linkage": linkage,
                  "status": res["res"]["statusCode"],
                }
              }
              if (res["call"]) {
                var status = {
                  "time": new Date().toISOString(),
                  "csw": data["csw"],
                  "id": data["fileId"],
                  "linkage": linkage,
                  "status": res["call"]["statusCode"],
                }
              }
              timber.writeHostStatus(dirs, status, function (err, res) {
                if (err) callback(err);
                else callback();
              })
            }
          })
        }
      }
    })
  }
}

function pingLogger (dirs, data, callback) {
  if (data.linkages) {
    async.each(data.linkages, function (linkage) {
      if (typeof linkage !== "undefined") {
        handle.pingPong(linkage, function (err, res) {
          if (err) callback(err);
          if (res) {
            var status;
            if (res["res"]) {
              var status = {
                "time": new Date().toISOString(),
                "csw": data["csw"],
                "id": data["fileId"],
                "linkage": linkage,
                "status": res["res"]["statusCode"],
              }            
            }
            if (res["call"]) {
              var status = {
                "time": new Date().toISOString(),
                "csw": data["csw"],
                "id": data["fileId"],
                "linkage": linkage,
                "status": res["call"]["statusCode"],
              }
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
}

function scrapeCsw (base, csw, increment, start, end) {
  var dirs = utility.buildDirs(base);
  function recursiveScrape (csw, increment, start, end) {
    buildRequests(csw, increment, start, end, function (get) {
      parse.parseCsw(get, function (data) {
        if (data) {
          async.waterfall([
            function (callback) {
              constructor(dirs, data, callback);
            },
            function (data, callback) {
              processor(data, callback);
            },
          ], function (err, res) {
            if (err) console.log(err);
          })
        }
        if (data["next"]) {
          console.log(data["next"]);
          if (data["next"] > 0 && data["next"] <= max)
            recursiveScrape(base, data["next"], increment, max);
        }
      })
    })
  }
  recursiveScrape(csw, increment, start, end);
}

function pingLinkages (base, csw, increment, start, end) {
  var dirs = utility.buildDirs(base);
  function recursivePing (csw, increment, start, end) {
    buildRequests(csw, increment, start, end, function (get) {
      if (data) {
        data["csw"] = url;
        async.waterfall([
          function (callback) {
            pingLogger(dirs, data, callback);
          },
        ], function (err, res) {
          if (err) console.log(err);
        })
      }
      if (data["next"]) {
        console.log("NEXT: ", data["next"]);
        if (data["next"] > 0 && data["next"] <= max) 
          recursivePing(url, data["next"]);
      }      
    })
  }
  recursivePing(csw, increment, start, end);
}

function pingHost (base, csw, increment, start, end) {
  var globalObj = [];
  var dirs = utility.buildDirs(base);
  function recursivePing (csw, increment, start, end) {
    buildRequests(csw, increment, start, end, function (get) {
      if (data) {
        data["csw"] = url;
        async.waterfall([
          function (callback) {
            pingHosts(dirs, data, globalObj, callback);
          },
        ], function (err, res) {
          if (err) console.log(err);
        })
      }
      if (data["next"]) {
        console.log("NEXT: ", data["next"]);
        if (data["next"] > 0 && data["next"] <= max) 
          recursivePing(url, data["next"]);
      }      
    })
  }
  recursivePing(csw, increment, start, end);
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

function awsS3 () {
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
                  fs.rmrf(children[childIndex], function (err, res) {
                    if (err) console.log(err);
                    else {
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

