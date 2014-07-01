var ftp = require('ftp-get');
var fs = require("fs.extra");
var http = require("http");
var https = require("https");
var request = require("request");
var path = require("path");
var _ = require("underscore");
var url = require("url");
var archiver = require("archiver");
var async = require("async");
var domain = require("domain");

// Check if an XML file exists, write one out if it doesn't exist.  Both
// 'outPath' and 'd' are optional parameters.  They only get used when this
// function gets called in async.waterfall();
function writeXml (outputXml, data, outPath, d, callback) {

  var args = [];
  for (var i = 0; i < arguments.length; i++) {
    args.push(arguments[i]);
  }

  outputXml = args.shift();
  data = args.shift();
  callback = args.pop();

  if (args.length > 0) outPath = args.shift(); else outPath = null;
  if (args.length > 0) d = args.shift(); else d = null;

  fs.exists(outputXml, function (exists) {
    if (exists) {
      callback(null, outPath, d);
    } else {
      fs.writeFile(outputXml, data, function (error) {
        if (error) callback(error);
        else callback(null, outPath, d);
      })
    }
  })
}

function downloadFTP (linkage, path, callback) {
  ftp.get(linkage, path, function (error, response) {
    if (error) callback(error);
    else callback(response);
  })
}

function downloadHTTP (linkage, path, callback) {
  var serverDomain = domain.create();

  serverDomain.on("error", function (err) {
    console.log(err);
  });

  serverDomain.run(function () {
    http.get(linkage, function (res) {
      var file = fs.createWriteStream(path);
      res.pipe(file);

      file.on("close", function () {
        callback(path);
      });

      file.on("error", function (err) {
        callback(err);
      });

      res.on("error", function (err) {
        file.end();
        callback(err);
      })
    })
  })
}

function downloadHTTPS (linkage, path, callback) {
  var serverDomain = domain.create();

  serverDomain.on("error", function (err) {
    console.log(err);
  });

  serverDomain.run(function () {
    https.get(linkage, function (res) {
      var file = fs.createWriteStream(path);
      res.pipe(file);

      file.on("close", function () {
        callback(path);
      });

      file.on("error", function (err) {
        callback(err);
      })

      res.on("error", function (err) {
        file.end();
        callback(err);
      })
    })
  })
}

function pingFTP (linkage, callback) {
  ftp.head(linkage, function (err, res) {
    if (err) callback(new Error(linkage));
    else callback(null, {"call": {"statusCode": 200}, "linkage": linkage}); 
  })
}

function pingHTTP (linkage, callback) {
  var parsed = url.parse(linkage);
  var options = {method: "HEAD", host: parsed["host"], path: parsed["path"]};
  var serverDomain = domain.create();

  serverDomain.on("error", function (err) {
    callback(err);
  });

  serverDomain.run(function () {
    http.get(options, function (res) {
      if (res) callback(null, {"call": res, "linkage": linkage});
      else callback(new Error(linkage));
      res.on("error", function (err) {
        callback(err);
      })
    })
  })
}

function pingHTTPS (linkage, callback) {
  var parsed = url.parse(linkage);
  var options = {method: "HEAD", host: parsed["host"], path: parsed["path"]};
  var serverDomain = domain.create();

  serverDomain.on("error", function (err) {
    callback(err);
  });

  serverDomain.run(function () {
    https.get(options, function (res) {
      if (res) callback(null, {"call": res, "linkage": linkage});
      else callback(new Error(linkage));
      res.on("error", function (err) {
        callback(err);
      })
    })
  })
}

// One single function that we can throw all linkages at for downloading.  HTTP,
// HTTPS and FTP all are handled slightly differently, but should all return
// the same information to the callback.  Operational errors should all get thrown
// in their own domains, so we achieve 100% up-time.
function download (directory, linkage, callback) {
  var module = this;
  module.pingPong(linkage, function (err, res) {
    if (res && res["call"].statusCode === 200) {
      var linkage = res["linkage"];
      module.configurePaths(directory, linkage, function (err, res) {
        var directory = res.directory.replace(/(\r\n|\n|\r)/gm,"");
        var file = res.file.replace(/(\r\n|\n|\r)/gm,"");
        var output = path.join(directory, file);

        if (res.linkage.indexOf("ftp") > -1) {
          module.downloadFTP(res.linkage, output, function (err, res) {
            if (err) callback(err);
            else callback(res);
          })
        } 
        else if (res.linkage.indexOf("http") > -1 && 
                 res.linkage.indexOf("https") <= -1) {
          module.downloadHTTP(res.linkage, output, function (err, res) {
            if (err) callback(err);
            else callback(res);
          })
        }
        else if (res.linkage.indexOf("https") > -1) {
          module.downloadHTTPS(res.linkage, output, function (err, res) {
            if (err) callback(err);
            else callback(res);
          })
        }
      })
    } else {
      callback("SOMETHING BROKE " + res);
    }
  })
}

// One single function that we can throw all linkages at for pinging and
// receiving a 'status code'.  Just like the high-level download function,
// this function handles HTTP, HTTPS and FTP all differently but should
// all return the same information to the callback.  Again, operational
// errors are thrown in their own domains to achieve 100% up-time.
function pingPong (linkage, callback) {
  var module = this;
  if (linkage.search("ftp") > -1) {
    module.pingFTP(linkage, function (err, res) {
      if (err) callback(err);
      else callback(null, res);
    });
  } else if (linkage.search("http") > -1 && linkage.search("https") <= -1) {
    module.pingHTTP(linkage, function (err, res) {
      if (err) callback(err);
      else callback(null, res);
    });
  } else if (linkage.search("https") > -1) {
    module.pingHTTPS(linkage, function (err, res) {
      if (err) callback(err);
      else callback(null, res);
    })
  }
}

// Takes the response from a ping and writes it to a CSV.
function pingLogger (linkage, callback) {
  var module = this;
  var time = new Date().toISOString();

  var PingError = function (messages) {
    this.messages = messages;
    return this.messages;
  };

  if (linkage.search("ftp") > -1) {
    module.pingFTP(linkage, function (error) {
      if (error) {
        callback(new PingError({"linkage": linkage, "time": time}));
      } else {
        callback(null, {"linkage": linkage, "time": time});
      }
    });
  } else if (linkage.search("http") > -1 && linkage.search("https") <= -1) {
    module.pingHTTP(linkage, function (error) {
      if (error) {
        callback(new PingError({"linkage": linkage, "time": time}));
      } else {
        callback(null, {"linkage": linkage, "time": time});
      }
    })
  } else if (linkage.search("https") > -1) {
    module.pingHTTPS(linkage, function (error) {
      if (error) {
        callback(new PingError({"linkage": linkage, "time": time}));
      } else {
        callback(null, {"linkage": linkage, "time": time});
      }
    })
  }
}

function buildDirectory (path, config, callback) {

  var args = [];
  for (var i = 0; i < arguments.length; i++) {
    args.push(arguments[i]);
  }

  path = args.shift();
  callback = args.pop();

  if (args.length > 0) config = args.shift(); else config = null;

  fs.exists(path, function (exists) {
    if (exists) {
      callback(null, path, config);
    } else {
      fs.mkdir(path, function (error) {
        if (error) callback(error);
        else callback(null, path, config);
      })
    }
  })
}

function configurePaths (directory, linkage, callback) {
  if (linkage) {
    var parsedUrl = url.parse(linkage);
    var fileName = parsedUrl.path.replace(/^\/*/,"");
    if (parsedUrl["hostname"] !== null && fileName.length > 0) {
      fileName = fileName.replace(/[^a-zA-Z0-9_.-]/gim, "");

      var config = {
        "file": fileName,
        "directory": directory,
        "linkage": linkage
      };

      callback(null, config);
    }
  }
}

function compressDirectory (uncompressed, compressed, callback) {
  var zipped = fs.createWriteStream(compressed);
  var archive = archiver("zip");

  zipped.on("close", function () {
    fs.rmrf(uncompressed, function (error) {
      if (error) callback(error);
      else callback(compressed);
    })
  });

  zipped.on("error", function (err) {
    callback(err);
  });

  archive.on("error", function (error) {
    zipped.end();
    throw error;
  });

  archive.pipe(zipped);
  archive.bulk([
    {expand: true, cwd: uncompressed, src: ["**"]}
  ]);
  archive.finalize(function (err) {
    zipped.end();
    if (err) throw err;
  });
}

exports.writeXml = writeXml;
exports.downloadFTP = downloadFTP;
exports.downloadHTTP = downloadHTTP;
exports.downloadHTTPS = downloadHTTPS;
exports.pingFTP = pingFTP;
exports.pingHTTP = pingHTTP;
exports.pingHTTPS = pingHTTPS;
exports.download = download;
exports.pingPong = pingPong;
exports.pingLogger = pingLogger;
exports.buildDirectory = buildDirectory;
exports.configurePaths = configurePaths;
exports.compressDirectory = compressDirectory;