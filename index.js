#!/usr/bin/env node

var async = require("async");
var parse = require("./parse");
var handle = require("./handle");
var utility = require("./utility");
var path = require("path");
var url = require("url");
var fs = require("fs");
var _ = require("underscore");
//var archive = require("./archive");

var argv = require("yargs")
  .usage("Command line utility for archiving NGDS data on Amazon S3")

  .alias("p", "parse")
  .describe("Parse a CSW")

  .alias("u", "urls")
  .describe("Parse and ping all of the CSW linkages")

  .alias("o", "out")
  .describe("Specify a base directory for process outputs")
  .argv;

var cmdQueue = [];
if (argv.parse) cmdQueue.push(parseCsw);
if (argv.urls) cmdQueue.push(doEverything);

async.series(cmdQueue);

// Build directories for output files and start streaming XML into text files
function taskOne (dirs, xml, callback) {
  var directory = path.join(dirs["record"], xml.fileId);
  handle.buildDirectory(directory, function () {
    var outXML = path.join(directory, xml.fileId + ".xml");
    handle.writeXML(outXML, xml.fullRecord);
  })
  callback(null);
};

// 'Glob' is a global object generated to keep track of URL status, in-memory.
// Ping each unique base URL and return a status to the 'glob'.
function taskTwo (glob, dirs, xml, callback) {
  async.each(xml.linkages, function (linkage) {
    var parsedUrl = url.parse(linkage);
    var host = parsedUrl["protocol"] + "//" + parsedUrl["host"];
    if (_.indexOf(glob["unique"], host) === -1) {
      glob["unique"].push(host);  

      handle.pingUrl(host, function (error, response) {
        if (error) {
          error["ping"] = "DEAD";
          glob["dead"].push(error);
          glob["status"].push(error);
        };

        if (response) {
          response["ping"] = "ALIVE";
          glob["status"].push(response);
        };
      })
    }
  });
  callback(null);
}

// This function is kind of a mess right now, I'll probably work on it tonight.
// Here we download the various kinds of data from each linkage.  The tricky 
// part that I'm wrestling with is how to return when ALL of the links have been
// downloaded, so that we can zip that sucka and send it to S3.
function taskThree (glob, dirs, xml, callback) {
  var directory = path.join(dirs["record"], xml.fileId);
  var dead = _.map(glob["dead"], function (record) {
    return record["linkage"];
  });

  async.each(xml.linkages, handle.downloadLinkage, function (error) {
    if (!error) {
      console.log("DOWNLOAD COMPLETE");
    } else {
      callback(error);
    }
  });
  callback(null, dirs, xml.fileId);
}

// Pretty simply, just zip up a file
function taskFour (dirs, directory, callback) {
  var uncompressed = path.join(dirs["record"], directory);
  var compressed = path.join(dirs["archive"], directory + ".zip");
  handle.compressDirectory(uncompressed, compressed, function (response) {
  
  })
}

// Write out the information we've logged about URL status in the 'glob' to 
// permanent text files.
function taskFive (glob, dirs, xml, callback) {
  var pingLog = path.join(dirs["logs"], "linkage-status.csv");
  var deadLog = path.join(dirs["logs"], "dead-linkages.csv");
  var uniqueLog = path.join(dirs["logs"], "unique-linkages.csv");
  
  async.parallel([
    function (callback) {
      handle.linkageLogger(glob["status"], pingLog, function () {
        callback();
      })
    },
    function (callback) {
      handle.linkageLogger(glob["dead"], deadLog, function () {
        callback();
      })
    },
    function (callback) {
      handle.linkageLogger(glob["unique"], uniqueLog, function () {
        callback();
      })
    }
  ])
}

// Execute all of the code.  This part is tricky, because we need to throttle 
// the flow of data so that our PCs don't crash.  I've been accomplishing this
// with the 'async' library (look at the waterfall function which executes all
// of those numbered functions), but the load changes everytime a new process 
// is added.
function doEverything () {
  // Build the 'glob'
  var DataStore = function () {
    var linkages = {};
    linkages.unique = [];
    linkages.status = [];
    linkages.dead = [];
    return linkages;
  };
  var ds = new DataStore();
  
  // Establish a base working directory
  var base = argv.out ? argv.out : path.dirname(require.main.filename);

  // Now build our output directories in the base working directory
  var dirs = utility.buildDirs(base);

  // Now build our request URLs and execute the waterfall of processing 
  // functions.  Async is proving to be invaluable for organizing all of this
  // asynchronous processing, but right now it's only controlling the flow of
  // functions local to this file.  I'm starting to think that we're going to
  // need to do flow control with async throughout the entire project.
  utility.doRequest(/*33875*/1000, 100, function (data) {
    var base = "http://geothermaldata.org/csw?";
    utility.buildUrl(base, data.counter, data.increment, function (getRecords) {
      parse.parseCsw(getRecords, function (xml) {

        async.waterfall([
          function (callback) {
            taskOne(dirs, xml, callback);
          },
          function (callback) {
            taskTwo(ds, dirs, xml, callback);
          },
          function (callback) {
            taskThree(ds, dirs, xml, callback)
          },
/*
          function (dirs, directory, callback) {
            taskFour(dirs, directory, callback)
          }
*/
        ], function (error, result) {
          if (error) console.log(error);
        })
      })
    })
  })
}








