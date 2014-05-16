var	ftp = require('ftp-get');
var fs = require("fs");
var http = require("http");
var request = require("request");
var sax = require("sax");
var saxpath = require("saxpath");
var _ = require("underscore");
var xpath = require("xpath.js");
var dom = require("xmldom").DOMParser;

module.exports = {
  scaleRequest: function (increment, parameters, callback) {
    var counter = 0,
      total;

    http.get(parameters).on("response", function (response) {
      var xml = new xmlStream(response, "utf-8");
      xml.on("endElement: csw:SearchResults", function (results) {
        total = results.$.numberOfRecordsMatched
        while (counter < total) {
          counter += increment;
        }
    
        var placeHolder = (counter-increment),
        lastRecord = ((increment-(counter-total))+placeHolder);

        if (typeof callback === "function") {
        callback({
            "increment": increment,
            "placeHolder": placeHolder,
            "lastRecord": lastRecord,
          })
        }
      })
    }).end();
  },
  parseCsw: function (parameters, callback) {
    var saxParser = sax.createStream(true, {lowercasetags: true, trim: true});
    var fullRecord = new saxpath.SaXPath(saxParser, "//gmd:MD_Metadata");
    var url = "http://" + parameters.host + parameters.path;

    var options = {
      "url": url,
      "headers": {
        "Content-type": "text/xml;charset=utf-8",
      }      
    };
    
    request(options).pipe(saxParser);

    fullRecord.on("match", function (xml) {
      var doc = new dom().parseFromString(xml);
      var fileIdPath = xpath(doc, "//gmd:fileIdentifier/gco:CharacterString");
      var linkagePath = xpath(doc, "//gmd:distributionInfo/gmd:MD_Distributi" + 
                                   "on/gmd:transferOptions/gmd:MD_DigitalTra" +
                                   "nsferOptions/gmd:onLine/gmd:CI_OnlineRes" + 
                                   "ource/gmd:linkage/gmd:URL");

      var fileId = fileIdPath[0].firstChild.data;

      var linkages = _.map(linkagePath, function (linkage) {
        return linkage.firstChild.data;
      });

      if (typeof callback === "function") {
        callback({
          "fileId": fileId,
          "linkages": linkages,
          "fullRecord": xml,
        })
      }
    });
  },
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
  downloadFiles: function (response) {
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
        var outputFile = ".\\outputs\\" + fileName + "\\";
        var download = function (url, destination, cb) {
          var file = fs.createWriteStream(outputFile);
          var request = http.get(url, function (response) {
            response.pipe(file);
            file.on("finish", function () {
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
  buildDirectory: function () {
  }
};