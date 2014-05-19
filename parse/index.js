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
    
    request(options).pipe(saxParser);

    fullRecord.on("match", function (xml) {
      var doc = new dom().parseFromString(xml);
      var fileIdPath = xpath(doc, "//gmd:fileIdentifier/gco:CharacterString");
      var linkagePath = xpath(doc, "//gmd:distributionInfo/gmd:MD_Distributi" + 
                                   "on/gmd:transferOptions/gmd:MD_DigitalTra" +
                                   "nsferOptions/gmd:onLine/gmd:CI_OnlineRes" + 
                                   "ource/gmd:linkage/gmd:URL");

      var fileId = fileIdPath[0].firstChild.data;
      
      fileId.replace(/\n$/, "");

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
  // Given an array of linkage URLs, pull out the WFS getCapabilities URLs and 
  // ping them.  If URL returns 200, then pull out the getFeatures service 
  // endpoint and the typeNames.  If the typeName matches 'aasg:WellLog', then 
  // construct a getFeatures URL and pass it to the callback.
  parseGetCapabilitiesWFS: function (data, callback) {
    _.each(data.linkages, function (linkage) {
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
              var typeName = typeNamePath[0].firstChild.data;

              if (typeName === "aasg:WellLog") {
                var getFeatures = endpoint + "request=GetFeature&service" +
                                  "=WFS&version=2.0.0&typeNames=" + typeName;

                callback(getFeatures);
              }
            })
          }
        });
      }
    })
  },
  // Given a WFS getFeatures URL, stream stream out all of the data associated 
  // with the parent tag specified in the 'feature' variable.  On each match,
  // hit the xml with some regular expressions for pulling out URIs and URLs and
  // pass that data to the callback.
  parseGetFeaturesWFS: function (url, callback) {
    var saxParser = sax.createStream(true, {lowercasetags: true, trim: true});
    var feature = new saxpath.SaXPath(saxParser, "//gml:featureMember");
    var options = {
      "url": url,
      "headers": {
      "Content-type": "text/xml;charset=utf-8",
      }      
    };

    request(options).pipe(saxParser);

    feature.on("match", function (xml) {
      var logUri = xml.match("<aasg:LogURI>(.*?)</aasg:LogURI>")[1];
      var wellUri = xml.match("<aasg:WellBoreURI>(.*?)</aasg:WellBoreURI>")[1];
      var fileUrl = xml.match("<aasg:ScannedFileURL>(.*?)</aasg:ScannedFileURL>")[1];
      var lasUrl = xml.match("<aasg:LASFileURL>(.*?)</aasg:LASFileURL>")[1];

      if (typeof callback === "function") {
        callback({
          "logURI": logUri,
          "wellBoreURI": wellUri,
          "scannedFileURL": fileUrl,
          "lasFileURL": lasUrl,
          "xml": xml,
        });
      } 
    })
  }
};
















