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
var timber = require("../timber");
var domain = require("domain");

http.globalAgent.maxSockets = 5;

module.exports = {
  // Write out XML data held in-memory to a text file.
  writeXML: function (outputXml, data, callback) {
    fs.exists(outputXml, function (exists) {
      if (exists) {
        callback(null);
      } else {
        fs.writeFile(outputXml, data, function (error) {
          if (error) callback(error);
          else callback();
        })
      }
    })
  },
  downloadFTP: function (linkage, path, callback) {
    ftp.get(linkage, path, function (error, response) {
      if (error) callback(error);
      else callback();
    })
  },
  downloadHTTP: function (linkage, path, callback) {
    var serverDomain = domain.create();

    serverDomain.on("error", function (err) {
      console.log(err);
    })

    serverDomain.run(function () {
      http.get(linkage, function (res) {
        var file = fs.createWriteStream(path);
        res.pipe(file);

        file.on("close", function () {
          callback();
        });

        file.on("error", function (err) {
          throw err;
          callback();
        })

        res.on("error", function (err) {
          file.end();
          throw err;
          callback();
        })
      })
    })
  },
  downloadHTTPS: function (linkage, path, callback) {
    var serverDomain = domain.create();

    serverDomain.on("error", function (err) {
      console.log(err);
    })

    serverDomain.run(function () {
      https.get(linkage, function (res) {
        var file = fs.createWriteStream(path);
        res.pipe(file);

        file.on("close", function () {
          callback();
        });

        file.on("error", function (err) {
          callback(err);
        })

        res.on("error", function (err) {
          file.end();
          throw err;
          callback(err);
        })
      })
    })
  },
  pingFTP: function (linkage, callback) {
    ftp.head(linkage, function (err, res) {
      if (err) callback(new Error(linkage));
      else callback(null, {"call": {"statusCode": 200}, "linkage": linkage}); 
    })
  },
  pingHTTP: function (linkage, callback) {
    var parsed = url.parse(linkage);
    var options = {method: "HEAD", host: parsed["host"], path: parsed["path"]};
    var serverDomain = domain.create();

    serverDomain.on("error", function (err) {
      callback(err);
    })

    serverDomain.run(function () {
      http.get(options, function (res) {
        if (res) callback(null, {"call": res, "linkage": linkage});
        else callback(new Error(linkage));
        res.on("error", function (err) {
          callback(err);
        })
      })
    })
  },
  pingHTTPS: function (linkage, callback) {
    var parsed = url.parse(linkage);
    var options = {method: "HEAD", host: parsed["host"], path: parsed["path"]};
    var serverDomain = domain.create();

    serverDomain.on("error", function (err) {
      callback(err);
    })

    serverDomain.run(function () {
      https.get(options, function (res) {
        if (res) callback(null, {"call": res, "linkage": linkage});
        else callback(new Error(linkage));
        res.on("error", function (err) {
          callback(err);
        })
      })
    })
  },
  download: function (directory, linkage, callback) {
    var module = this;
    module.pingPong(linkage, function (err, res) {
      if (res && res["call"].statusCode === 200) {
        var linkage = res["linkage"];
        module.configurePaths(directory, linkage, function (res) {

          var directory = res.directory.replace(/(\r\n|\n|\r)/gm,"");
          var file = res.file.replace(/(\r\n|\n|\r)/gm,"");
          var output = path.join(directory, file);

          if (res.linkage.indexOf("ftp") > -1) {
            module.downloadFTP(res.linkage, output, function () {
              callback();
            })
          } 
          else if (res.linkage.indexOf("http") > -1 && 
                   res.linkage.indexOf("https") <= -1) {
            module.downloadHTTP(res.linkage, output, function () {
              callback();
            })
          }
          else if (res.linkage.indexOf("https") > -1) {
            module.downloadHTTPS(res.linkage, output, function () {
              callback();
            })
          }
        })
      } else {
        callback();
      }
    })
  },
  pingPong: function (linkage, callback) {
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
  },
  pingLogger: function (linkage, callback) {
    var module = this;
    var time = new Date().toISOString();
    var PingError = function (messages) {
      this.messages = messages;
      return this.messages;
    }

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
  },
  buildDirectory: function (path, callback) {
    fs.exists(path, function (exists) {
      if (exists) {
        callback(null, path);
      } else {
        fs.mkdir(path, function (error) {
          if (error) callback(error);
          else callback(null, path);
        })
      }
    })
  },
  configurePaths: function (directory, linkage, callback) {
    var module = this;
    if (linkage) {
      var parsedUrl = url.parse(linkage);
      // Remove any number of leading slashes (/)
      var fileName = parsedUrl.path.replace(/^\/*/,"");
      if (parsedUrl["hostname"] !== null && fileName.length > 0) {
        // Replace with an underscore anything that is not a-z, 
        // 'A-Z, 0-9, _, . or -
        fileName = fileName.replace(/[^a-zA-Z0-9_.-]/gim, "_");
        var dirName = parsedUrl.hostname.replace(/[^a-zA-Z0-9_.-]/gim, "_");

        callback({
          "file": fileName,
          "directory": directory,
          "linkage": linkage,
        });      
      }
    }
  },
  // Given a path to a directory, compress the directory as a ZIP archive.
  compressDirectory: function (uncompressed, compressed, callback) {
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
  },
};