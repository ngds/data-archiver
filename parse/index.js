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
};