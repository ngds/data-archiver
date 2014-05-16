var ftp = require('ftp-get');
var fs = require("fs");
var http = require("http");
var request = require("request");
var _ = require("underscore");

module.exports = {
  writeXML: function (response) {	
    var outputFile = "./outputs/" + response.fileId + ".xml",
      data = response.fullRecord;

    fs.writeFile(outputFile, data, function (err) {
      if (err) {
        console.log(err);
      } else {
        console.log("File saved: " + outputFile);
      }
    });		
  },
  downloadFiles: function (baseDir, response) {
    //wstream = fs.createWriteStream(outputFile);
    var linkages = response.linkages;
    _.each(linkages, function (linkage) {

      // Write FTP files to local outputs folder
      if (linkage.indexOf("ftp") === 0) {
        var fileName = linkage.replace(/[^a-zA-Z0-9_.-]/gim, "_");
        ftp.get(linkage, "outputs/" + fileName, function (err, res) {
          if (err) return console.log(err, res);
          else return console.log("File saved: " + "./outputs/" + fileName);
        })
      } else if (linkage.indexOf("http") === 0) {
        var fileName = linkage.split("/").pop();
        var outputFile = "outputs/" + fileName;
        
        var download = function (url, destination, cb) {
          var file = fs.createWriteStream(outputFile);
          var request = http.get(url, function (response) {
            response.pipe(file);
            file.on("finish", function () {
              console.log("File saved: " + outputFile);
              file.close(cb);
            })
          })
        }
        download(linkage, outputFile);
      }     
    })
  },
  pingUrl: function (response, outputFile, callback) {
    var linkages = response.linkages;
    //var wstream = fs.createWriteStream(outputFile);

    _.each(linkages, function (linkage) {
      // Ping FTP links
      if (linkage.indexOf("ftp") === 0) {
        ftp.head(linkage, function (error, size) {
          if (error) {
            //console.error(error);
            console.log("BAD " + linkage);
          } else {
            //console.log('The remote file size is: ' + size); // the file size if everything is OK
            console.log("GOOD " + linkage);
          }
        });
      }
      // Ping HTTP links
      else if (linkage.indexOf("http") === 0) {
        request(linkage, function (error, response) {
          if (!error && response.statusCode == 200) {
            console.log("GOOD " + linkage);
          } else {
            console.log("BAD " + linkage);
            //wstream.write(link);
          }
        })
      }
      else
        console.error ("Invalid link: " + linkage);
    })
  },
  buildDirectory: function (path, callback) {
    fs.exists(path, function (exists) {
      if (exists) {
        callback(path + " already exists");
      } else {
        fs.mkdir(path, function () {
          callback(path)
        })
      }
    })
  },
  compressDirectory: function (path, callback) {

  }
};














