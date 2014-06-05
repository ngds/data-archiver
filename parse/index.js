var http = require("http");
var request = require("request");
var sax = require("sax");
var saxpath = require("saxpath");
var _ = require("underscore");
var xpath = require("xpath.js");
var dom = require("xmldom").DOMParser;
var url = require("url");
var querystring = require("querystring");
var fs = require("fs");
var path = require("path");
var async = require("async");
var handle = require("../handle");
var domain = require("domain");

module.exports = {
  scaleRequest: function (parameters, callback) {
    var saxParser = sax.createStream(true, {lowercasetags: true, trim: true});
    var searchResults = new saxpath.SaXPath(saxParser, "//csw:SearchResults");
    var serverDomain = domain.create();

    serverDomain.on("error", function (err) {
      console.log(err);
    });

    serverDomain.run(function () {
      http.get(parameters, function (res) {
        res.pipe(saxParser);

        var totalRecords;

        searchResults.on("match", function (xml) {
          var doc = new dom().parseFromString(xml);
          var records = xpath(doc, "@numberOfRecordsMatched")[0].value
          totalRecords = records;
        });

        searchResults.on("end", function () {
          callback(totalRecords);
        });

        res.on("error", function (err) {
          throw err;
        })
      })
    })
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
    
    request.get(options)
      .on("response", function () {})
      .on("error", function () {
        console.log("ERROR")
      })
      .pipe(saxParser);

    var data = [];

    fullRecord.on("match", function (xml) {
      var idReg = new RegExp(/<gmd:fileIdentifier><gco:CharacterString>(.*?)<\/gco:CharacterString><\/gmd:fileIdentifier>/g);
      var urlReg = new RegExp(/<gmd:URL>(.*?)<\/gmd:URL>/g);
      
      var fileId = idReg.exec(xml)[1];
      var linkages = [];
      var match;

      while (match = urlReg.exec(xml)) {
        linkages.push(match[1]);
      };

      data.push({
        "fileId": fileId,
        "linkages": linkages,
        "fullRecord": xml,
      })
    });

    fullRecord.on("end", function () {
      callback(data);
    })
  },
  parseGetCapabilitiesWFS: function (linkage, callback) {
    var saxParser = sax.createStream(true, {lowercasetags: true, trim: true});
    var capabilities = new saxpath.SaXPath(saxParser, "/wfs:WFS_Capabilities");

    var options = {
      "url": linkage,
      "headers": {
      "Content-type": "text/xml;charset=utf-8",
      }      
    };

    request(linkage, function (error, response) {
      if (!error && response.statusCode == 200) {
        request(options).pipe(saxParser);
        capabilities.on("match", function (xml) {
          var doc = new dom().parseFromString(xml);
          var httpGetPath = xpath(doc, "//ows:OperationsMetadata/ows:Ope" +
                                       "ration/ows:DCP/ows:HTTP/ows:Get/" +
                                       "@xlink:href");
          var typeNamePath = xpath(doc, "//wfs:FeatureTypeList/wfs:Featu" +
                                        "reType/wfs:Name");
          var endpoint = httpGetPath[0].value;
          
          var getFeatures = _.map(typeNamePath, function (typeName) {
            return endpoint + "request=GetFeature&service=WFS&version=" +
                   "2.0.0&typeNames=" + typeName.firstChild.data;
          });
          callback(getFeatures);
        })
      }
    });
  },
  parseWellLogsWFS: function (linkage, directory, callback) {
    var saxParser = sax.createStream(true, {lowercasetags: true, trim: true});
    var feature = new saxpath.SaXPath(saxParser, "//gml:featureMember");
    
    saxParser.on("error", function (error) {
      callback({
        "link": linkage,
        "error": error,
      });
    });

    http.get(linkage, function (response) {
      response.pipe(saxParser);

      response.on("error", function (error) {
        console.log(error);
      })

      process.on("uncaughtException", function (error) {
        console.log("EXCEPTION: " + error + linkage);
      })
    })

    feature.on("match", function (xml) {
      var logInfo = {};
      logInfo["linkages"] = [];

      var fileUrl = xml.match("<aasg:ScannedFileURL>(.*?)</aasg:ScannedFileURL>");
      var boreUri = xml.match("<aasg:WellBoreURI>(.*?)</aasg:WellBoreURI>");
      var logType = xml.match("<aasg:LogTypeTerm>(.*?)</aasg:LogTypeTerm>");

      if (fileUrl) {
        fileUrl = fileUrl[1];
        var illegalChars = [",", ";", "|"];
        _.each(illegalChars, function (char) {
          if (fileUrl.indexOf(char) > -1) {
            files = fileUrl.split(char);
            _.each(files, function (file) {
              logInfo["linkages"].push(file);
            })
          } else {
            logInfo["linkages"].push(fileUrl);
          }
          var parsedUrl = url.parse(logInfo["linkages"][0]);
          logInfo["host"] = parsedUrl["hostname"].replace(/[^a-zA-Z0-9_.-]/gim, "_");            
        });
        var filePath = fileUrl.split("/").pop();
        var fileSplit = filePath.split(".")[0];
        logInfo["recordId"] = fileSplit;
        logInfo["xmlId"] = fileSplit + ".xml";
      } else if (boreUri) {
        boreUri = boreUri[1];
        logType = typeof logType[1] !== "undefined" ? logType : "";
        if (boreUri.indexOf("uri-gin") > -1) {
          var urlPath = boreUri.split("uri-gin")[1];
          logInfo["recordId"] = urlPath.replace("/", "_") + "_" + logType;
          logInfo["xmlId"] = urlPath.replace("/", "_") + "_" + logType + ".xml";
        }
      }

      if (typeof callback === "function") {
        callback({
          "wfs": linkage,
          "dir": directory,
          "linkages": _.uniq(logInfo["linkages"]),
          "xmlId": logInfo["xmlId"],
          "id": logInfo["recordId"],
          "host": logInfo["host"],
          "xml": xml,
        })
      }
    }) 
  },
  parseGetFeaturesWFS: function (linkage, directory, file, callback) {
    fs.exists(directory, function (exists) {
      var outputXML = path.join(directory, file + ".xml");
      http.get(linkage, function (response) {
        var file = fs.createWriteStream(outputXML);
        response.pipe(file);

        file.on("close", function () {
          callback(outputXML);
        })

        file.on("error", function (error) {
          callback(error);
        })

        response.on("error", function (error) {
          file.end();
        })

        process.on("uncaughtException", function (error) {
          console.log("EXCEPTION: " + error + linkage);
        })
      })
    })
  },
  parseWellLogs: function (data) {
    var topDir = path.join(data["dir"], data["host"]);
    handle.buildDirectory(topDir, function () {
      var recordDir = path.join(topDir, data["id"]);
      handle.buildDirectory(recordDir, function () {
        var outputXML = path.join(recordDir, data["xmlId"]);
        handle.writeXML(outputXML, data["xml"]);
        console.log(data["linkages"]);
        async.forEach(data["linkages"], function (linkage) {
          handle.downloadFile(recordDir, linkage, function (response) {
            console.log(response);
          })
        })
      })
    })
  }
};