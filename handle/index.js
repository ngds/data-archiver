var ftp = require('ftp-get');
var fs = require("fs");
var http = require("http");
var https = require("https");
var request = require("request");
var path = require("path");
var _ = require("underscore");
var url = require("url");
var archiver = require("archiver");
var async = require("async");

module.exports = {
  // Write out XML data held in-memory to a text file.
  writeXML: function (outputXml, data) { 
    fs.writeFileSync(outputXml, data);
  },
  linkageLogger: function (data, log, callback) {
    fs.writeFile(log, data, function (error) {
      if (error)
        callback(error);
      callback();
    })
  },
  // Check whether an externally hosted file is hosted on an HTTP server or an
  // FTP server and then save it locally.
  downloadFTP: function (linkage, path, callback) {
    ftp.get(linkage, path, function (err, res) {
      if (err) return callback(err, res);
      if (typeof callback === "function")
        callback("DOWNLOADED FTP");
      })
  },
  downloadHTTP: function (linkage, path, callback) {
    http.get(linkage, function (response) {

      var file = fs.createWriteStream(path);
      response.pipe(file);

      file.on("close", function () {
        callback();
      });

      file.on("error", function (error) {
        callback(error);
      });

      response.on("error", function (error) {
        file.end();
      })

      process.on("uncaughtException", function (error) {
        console.log("EXCEPTION: " + error);
      })
    })
  },
  downloadHTTPS: function (linkage, path, callback) {
    https.get(linkage, function (response) {

      var file = fs.createWriteStream(path);
      response.pipe(file);

      file.on("close", function () {
        callback();
      });

      file.on("error", function (error) {
        callback(error);
      });
      
      response.on("error", function (error) {
        file.end();
      })

      process.on("uncaughtException", function (error) {
        console.log("EXCEPTION: " + error);
      })
    })
  },
  downloadFile: function (directory, linkage, callback) {
    var module = this;
    this.configurePaths(directory, linkage, function (res) {

      var directory = res.directory.replace(/(\r\n|\n|\r)/gm,"");
      var file = res.file.replace(/(\r\n|\n|\r)/gm,"");
      var outputPath = path.join(directory, file);

      module.buildDirectory(directory, function (error) {

        fs.exists(directory, function (exists) {
          if (exists) {                
            // Write FTP files to local outputs folder
            if (res.linkage.indexOf("ftp") === 0) {
              module.downloadFTP(res.linkage, outputPath, function () {
                if (typeof callback === "function") {
                  callback("DOWNLOADED FTP");
                }
              })
            } 
            // Write HTTP files to local outputs folder
            else if (res.linkage.indexOf("http") === 0 && 
                     res.linkage.indexOf("https") === -1) {
              module.downloadHTTP(res.linkage, outputPath, function () {
                if (typeof callback === "function") {
                  callback("DOWNLOADED HTTP");
                }
              })
            }
            // Write HTTPS files to local outputs folder
            else if (res.linkage.indexOf("https") === 0) {
              module.downloadHTTPS(res.linkage, outputPath, function () {
                if (typeof callback === "function") {
                  callback("DOWNLOADED HTTPS");
                }
              })
            }
          }
        })
      })      
    })
  },
  // Given an FTP or HTTP URL, ping it to see if the URL is alive.  If it is, 
  // continue with business as usual.  If not, then write out the URL to a dead
  // links file.
  pingUrl: function (linkage, callback) {
    var PingError = function (messages) {
      this.messages = messages;
      return this.messages;
    }

    var time = new Date().toISOString();
    // Ping FTP links
    if (linkage.indexOf("ftp") === 0) {
      ftp.head(linkage, function (error) {
        if (error) {
          callback(new PingError({"linkage": linkage, "time": time}));
        } else {
          callback(null, {"linkage": linkage, "time": time});
        }
      });
    }
    // Ping HTTP links
    else if (linkage.indexOf("http") === 0) {
      request(linkage, function (error, response) {
        if (!error && response.statusCode === 200) {
          callback(null, {"linkage": linkage, "time": time});
        } else {
          callback(new PingError({"linkage": linkage, "time": time}));
        }
      })
    }
    else {
      callback(new PingError({"linkage": linkage, "time": time}));
    }
  },
  // Function for building directories, and nothing more.
  buildDirectory: function (path, callback) {
    fs.exists(path, function (exists) {
      if (exists) {
        callback();
      } else {
        fs.mkdir(path, function (error) {
          if (error) {
            callback(error);
          }
          callback();
        })
      }
    })
  },
  // Given an array of linkages, parse them out, build some system paths and 
  // pass the 'filePath' to the callback.
  configurePaths: function (directory, linkage, callback) {
    if (linkage) {
      var parsedUrl = url.parse(linkage);

      // Remove any number of leading slashes (/)
      var fileName = parsedUrl.path.replace(/^\/*/,"");
      if (parsedUrl["hostname"] !== null && fileName.length > 0) {
        // Replace with an underscore anything that is not a-z, 
        // 'A-Z, 0-9, _, . or -
        fileName = fileName.replace(/[^a-zA-Z0-9_.-]/gim, "_");
        var dirName = parsedUrl.hostname.replace(/[^a-zA-Z0-9_.-]/gim, "_");
        var filePath = path.join(directory, dirName);

        callback({
          "file": fileName,
          "directory": filePath,
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
      console.log("Directory has been archived");
    });

    archive.on("error", function (error) {
      throw error;
    });

    archive.pipe(zipped);
    archive.bulk([
      {expand: true, cwd: uncompressed, src: ["*"]}
    ]);
    archive.finalize();
  },
};




