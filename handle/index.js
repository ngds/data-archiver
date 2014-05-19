var ftp = require('ftp-get');
var fs = require("fs");
var http = require("http");
var request = require("request");
var path = require("path");
var _ = require("underscore");


module.exports = {
  writeXML: function (filePath, fileId, data) {	
		var outputPath = path.join(filePath, fileId + ".xml");

    fs.writeFile(outputPath, data, function (err) {
      if (err) {
        console.log(err);
      } else {
        console.log("File saved: " + outputPath);
      }
    });		
  },
	downloadFile: function (filePath, fileName, linkage) {
		var outputPath = path.join(filePath, fileName);
		
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
	pingUrl: function (linkage, outputFile, callback) {
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
  },
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
  compressDirectory: function (path, callback) {

  }
};