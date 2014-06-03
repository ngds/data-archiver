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
var timber = require("../timber");

module.exports = {
  // Write out XML data held in-memory to a text file.
  writeXML: function (outputXml, data) { 
    fs.writeFileSync(outputXml, data);
  },
  downloadFTP: function (dirs, linkage, path, callback) {
    ftp.get(linkage, path, function (error, response) {
      if (error) callback(error);
      if (typeof callback === "function") {
        callback();
      }
    })
  },
  downloadHTTP: function (dirs, linkage, path, callback) {
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
        console.log(error);
      })
    })
  },
  downloadHTTPS: function (dirs, linkage, path, callback) {
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
        console.log(error);
      })
    })
  },
  downloadFile: function (dirs, directory, linkage, callback) {    
    var module = this;
    this.configurePaths(directory, linkage, function (res) {

      var directory = res.directory.replace(/(\r\n|\n|\r)/gm,"");
      var file = res.file.replace(/(\r\n|\n|\r)/gm,"");
      var outputPath = path.join(directory, file);

      module.buildDirectory(dirs, directory, function (error) {
        fs.exists(directory, function (exists) {
          if (exists) {                
            // Write FTP files to local outputs folder
            if (res.linkage.indexOf("ftp") === 0) {
              module.downloadFTP(dirs, res.linkage, outputPath, function (res) {
                if (typeof callback === "function") {
                  callback();
                }
              })
            } 
            // Write HTTP files to local outputs folder
            else if (res.linkage.indexOf("http") === 0 && 
                     res.linkage.indexOf("https") === -1) {
              module.downloadHTTP(dirs, res.linkage, outputPath, function () {
                if (typeof callback === "function") {
                  callback();
                }
              })
            }
            // Write HTTPS files to local outputs folder
            else if (res.linkage.indexOf("https") === 0) {
              module.downloadHTTPS(dirs, res.linkage, outputPath, function () {
                if (typeof callback === "function") {
                  callback();
                }
              })
            }
          }
        })
      })      
    })
  },
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
    else if (linkage.indexOf("http") === 0 || linkage.indexOf("https") === 0) {
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
  buildDirectory: function (dirs, path, callback) {
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
  shouldDownload: function (linkage, callback) {
    var formats = [".pdf", ".xls", ".xlsx", ".doc", ".rdf", "wfs", "WFS", 
                   ".csv", ".txt", ".tsv", ".xml", ".json", ".zip", ".tar",
                   ".gz", ".pdf", "ows", ".html", ".htm"];
    _.each(formats, function (format) {
      if (linkage.search(format) > -1)
        callback(null, linkage);
      else callback(new Error);
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
  compressDirectory: function (dirs, uncompressed, compressed, callback) {
    var zipped = fs.createWriteStream(compressed);
    var archive = archiver("zip");

    zipped.on("close", function () {
      callback();
    });

    archive.on("error", function (error) {
      throw error;
    });

    archive.pipe(zipped);
    archive.bulk([
      {expand: true, cwd: uncompressed, src: ["**"]}
    ]);
    archive.finalize();
  },
};




