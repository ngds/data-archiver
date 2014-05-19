var ftp = require('ftp-get');
var fs = require("fs");
var http = require("http");
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
      } else {
        console.log("File saved: " + outputXml);
      }
    });     
  },
  // Check whether an externally hosted file is hosted on an HTTP server or an
  // FTP server and then save it locally.
  downloadFile: function (directory, file, linkage) {
    var outputPath = path.join(directory, file);
        
    // Write FTP files to local outputs folder
    if (linkage.indexOf("ftp") === 0) {
      ftp.get(linkage, outputPath, function (err, res) {
        if (err) return console.log(err, res);
        else return console.log("File saved: " + outputPath);
      })
    } 
    // Write HTTP files to local outputs folder
    else if (linkage.indexOf("http") === 0) {
      var download = function (url, destination, cb) {
        var file = fs.createWriteStream(destination);
        var request = http.get(url, function (response) {
          response.pipe(file);
          file.on("finish", function () {
            console.log("File saved: " + destination);
            file.close(cb);
          })
        })
      }
      download(linkage, outputPath);
    } 
  },
  // Given an FTP or HTTP URL, ping it to see if the URL is alive.  If it is, 
  // continue with business as usual.  If not, then write out the URL to a dead
  // links file.
  pingUrl: function (linkage, masterLog, deadLog, callback) {
    function writeLog (logfile, text) {
      fs.appendFile(logfile, text, function (error) {
        if (error) throw error;
      })
    };
    // Ping FTP links
    if (linkage.indexOf("ftp") === 0) {
      ftp.head(linkage, function (error) {
        if (error) {
          var status = "DEAD," + linkage + "\n";
          writeLog(masterLog, status);
          writeLog(deadLog, linkage + "\n");
          callback(new Error("Dead FTP: " + linkage));
        } else {
          var status = "ALIVE," + linkage + "\n";
          writeLog(masterLog, status);
          callback(null, linkage);
        }
      });
    }
    // Ping HTTP links
    else if (linkage.indexOf("http") === 0) {
      request(linkage, function (error, response) {
        if (!error && response.statusCode === 200) {
          var status = "ALIVE," + linkage + "\n";
          writeLog(masterLog, status);
          callback(null, linkage);
        } else {
          var status = "DEAD," + linkage + "\n";
          writeLog(masterLog, status);
          writeLog(deadLog, linkage + "\n");
          callback(new Error("Dead HTTP: " + linkage));
        }
      })
    }
    else {
      callback(new Error("Invalid URL: " + linkage));
    }
  },
  // Function for building directories, and nothing more.
  buildDirectory: function (path, callback) {
    fs.exists(path, function (exists) {
      if (exists) {
        //console.log(path + " already exists");
        callback();
      } else {
        fs.mkdir(path, function () {
          //console.log("Created: " + path);
          callback();
        })
      }
    })
  },
  // Given an array of linkages, parse them out, build some system paths and 
  // pass the 'filePath' to the callback.
  configurePaths: function (directory, linkages, callback) {
    _.each(linkages, function (linkage) {
      var parsedUrl = url.parse(linkage);
      // Remove any number of leading slashes (/)
      var fileName = parsedUrl.path.replace(/^\/*/,"");
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
    })
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