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

module.exports = {
  scaleRequest: function (parameters, increment, callback) {
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
  // Given a CSW URL, stream out all of the data associated with the parent tag
  // specified in the 'fullRecord' variable.  On each match, query some xpaths
  // and return a UID and the linkage URLs.  Finally, stream the UID, linkage
  // URLs and full XML match to the callback.
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

    fullRecord.on("match", function (xml) {
      var idReg = new RegExp(/<gmd:fileIdentifier><gco:CharacterString>(.*?)<\/gco:CharacterString><\/gmd:fileIdentifier>/g);
      var urlReg = new RegExp(/<gmd:URL>(.*?)<\/gmd:URL>/g);
      
      var fileId = idReg.exec(xml)[1];
      var linkages = [];
      var match;

      while (match = urlReg.exec(xml)) {
        linkages.push(match[1]);
      };

      if (typeof callback === "function") {
        callback({
          "fileId": fileId,
          "linkages": linkages,
          "fullRecord": xml,
        })
      }
    });
  },
  // Given an array of linkage URLs, pull out the WFS getCapabilities URLs and 
  // ping them.  If URL returns 200, then pull out the getFeatures service 
  // endpoint and the typeNames.  If the typeName matches 'aasg:WellLog', then 
  // construct a getFeatures URL and pass it to the callback.
  parseGetCapabilitiesWFS: function (linkage, callback) {
    if (linkage.search("service=WFS") != -1) {
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
    }
  },
  // Given a WFS getFeatures URL, stream stream out all of the data associated 
  // with the parent tag specified in the 'feature' variable.  On each match,
  // hit the xml with some regular expressions for pulling out URIs and URLs and
  // pass that data to the callback.
  parseGetFeaturesWFS: function (directory, file, linkage) {
    function text (value) {
      if (value != null) {
        return value;
      } else {
        return "undefined";
      }
    }

    var urlQuery = url.parse(linkage)["query"];
    var typeName = querystring.parse(urlQuery)["typeNames"];
      
    var options = {
      "url": linkage,
      "headers": {
      "Content-type": "text/xml;charset=utf-8",
      }      
    };

    if (typeName === "aasg:WellLog") {
      var saxParser = sax.createStream(true, {lowercasetags: true, trim: true});
      var feature = new saxpath.SaXPath(saxParser, "//gml:featureMember");
    
      saxParser.on("error", function (error) {
        callback({
          "link": link,
          "error": error,
        });
      });

      request(options).pipe(saxParser);

      feature.on("match", function (xml) {
        var logUri = text(xml.match("<aasg:LogURI>(.*?)</aasg:LogURI>")[1]);
        var wellUri = text(xml.match("<aasg:WellBoreURI>(.*?)</aasg:WellBoreURI>")[1]);
        var fileUrl = text(xml.match("<aasg:ScannedFileURL>(.*?)</aasg:ScannedFileURL>")[1]);
        var lasUrl = text(xml.match("<aasg:LASFileURL>(.*?)</aasg:LASFileURL>")[1]);

        callback({
          "urls": [logUri, wellUri, fileUrl, lasUrl],
          "xml": xml,
        });
      })
    } 
    else {
      var outputXML = path.join(directory, file + ".xml");
      console.log(outputXML);
      request(options).pipe(fs.createWriteStream(outputXML));
    }
  }
};