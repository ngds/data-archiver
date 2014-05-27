#!/usr/bin/env node

var async = require("async");
var parse = require("./parse");
var handle = require("./handle");
var utility = require("./utility");
var path = require("path");
var url = require("url");
var fs = require("fs");
var _ = require("underscore");

var stream = require("stream").Stream();


var argv = require("yargs")
  .usage("Command line utility for archiving NGDS data on Amazon S3")

  .alias("p", "parse")
  .describe("Parse a CSW")
  .argv;

var cmdQueue = [];
if (argv.parse) cmdQueue.push(parseCsw);

async.series(cmdQueue);

function parseCsw () {
  var base = argv.out ? argv.out : path.dirname(require.main.filename);
  var dirs = utility.buildDirs(base);

  var queue = async.queue(function (getRecordUrl, callback) {
    parse.parseCsw(getRecordUrl, function (data) {
      async.each(data, function (item) {
        var directory = path.join(dirs["record"], item.fileId);
        handle.buildDirectory(directory, function () {
          var outXML = path.join(directory, item.fileId + ".xml");
          handle.writeXML(outXML, item.fullRecord);
          async.each(item.linkages, function (linkage) {
            handle.downloadFile(directory, linkage, function (res) {
              console.log(res);
            })
          })
        })
      })
      callback();
    })
  }, 1);

  queue.drain = function () {
    console.log("All getRecordUrls have been processed.");
  }
  
  function getRecordsList () {
    utility.doRequest(/*33875*/10000, 100, function (x) {
      var base = "http://geothermaldata.org/csw?";
      utility.buildUrl(base, x.counter, x.increment, function (getRecords) {
        queue.push(getRecords);
      });
    })
  }

  getRecordsList();
}

/*
function parseCsw () {
  var base = argv.out ? argv.out : path.dirname(require.main.filename);
  var dirs = utility.buildDirs(base);

  function throttled (getRecords, callback) {
      parse.parseCsw(getRecords, function (xml) {

        function doDownload (linkages, directory, callback) {
          
          function download (linkage, callback) {
            var parsedUrl = url.parse(linkage);
            var host = parsedUrl["protocol"] + "//" + parsedUrl["host"];
            handle.configurePaths(directory, linkage, function (res) {
              handle.downloadFile(res.directory, res.file, res.linkage, function (error, res) {
                if (error) console.log(error);
                console.log(error);
                // THIS CALLBACK IS NOT GETTING TRIGGERED!!!
              });
            })
          }

          async.each(linkages, download, function (error, result) {
            if (error) {
              callback(error);
            } else {
              console.log("HERE");
              callback();
            }
          })
        }

        var directory = path.join(dirs["record"], xml.fileId);
        handle.buildDirectory(directory, function () {
          var outXML = path.join(directory, xml.fileId + ".xml");
          handle.writeXML(outXML, xml.fullRecord);
          doDownload(xml.linkages, directory, function () {
            console.log("HERE");
          });
        })
      })
  }

  function getRecordsList () {
    var xs = [];
    utility.doRequest(33875, 10, function (x) {
      var base = "http://geothermaldata.org/csw?";
      utility.buildUrl(base, x.counter, x.increment, function (getRecords) {
        xs.push(getRecords);
      });
    })
    return xs;
  }

  var linksList = getRecordsList();

  async.eachSeries(linksList, throttled, function (error, result) {
    if (error) console.log(error);
    console.log(result);
  })
}
*/