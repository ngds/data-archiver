var ftp = require('ftp-get');
var fs = require("fs");
var http = require("http");
var https = require("https");
var request = require("request");
var path = require("path");
var _ = require("underscore");
var url = require("url");
var archiver = require("archiver");

module.exports = {
  // Write out XML data held in-memory to a text file.
  writeXML: function (outputXml, data) { 
    fs.writeFile(outputXml, data, function (error) {
      if (error) {
        console.log(error);
      }
    });     
  },
  writeLinkage: function (logFile, linkage) {
    var date = new Date().toISOString();
    var text = linkage + "," + date + ",\n";
    fs.appendFile(logFile, text, function (error) {
      if (error) throw error;
    })
  },
  linkageLogger: function (data, log, callback) {
    console.log(data);
    callback();
  },
  // Check whether an externally hosted file is hosted on an HTTP server or an
  // FTP server and then save it locally.
  downloadFile: function (directory, file, linkage) {
    var directory = directory.replace(/(\r\n|\n|\r)/gm,"");
    var file = file.replace(/(\r\n|\n|\r)/gm,"");

    this.buildDirectory(directory, function (error) {

      fs.exists(directory, function (exists) {
        if (exists) {

          var outputPath = path.join(directory, file);
              
          // Write FTP files to local outputs folder
          if (linkage.indexOf("ftp") === 0) {
            ftp.get(linkage, outputPath, function (err, res) {
              if (err) return console.log(err, res);
            })
          } 
          // Write HTTP files to local outputs folder
          else if (linkage.indexOf("http") === 0 && 
                   linkage.indexOf("https") === -1) {
            var download = function (url, destination, cb) {
              var file = fs.createWriteStream(destination);
              var request = http.get(url, function (response) {
                response.pipe(file);
                file.on("finish", function () {
                  file.close(cb);
                })
              })
            }
            download(linkage, outputPath);
          } 
          // Write HTTPS files to local outputs folder
          else if (linkage.indexOf("https") === 0) {
            var download = function (url, destination, cb) {
              var file = fs.createWriteStream(destination);
              var request = https.get(url, function (response) {
                response.pipe(file);
                file.on("finish", function () {
                  file.close(cb);
                })
              })
            }
            download(linkage, outputPath);
          }
        }
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
  compressDirectory: function (directory, callback) {
    var zipped = fs.createWriteStream(path.join(directory, ".zip"));
    var archive = archiver("zip");

    output.on("close", function () {
      console.log("Directory has been archived");
    });

    archive.on("error", function (error) {
      throw error;
    });

    archive.pipe(zipped);
    archive.bulk([
      {expand: true, cwd: directory, src: ["**"], dest: zipped}
    ]);
    archive.finalize();
  }
};








