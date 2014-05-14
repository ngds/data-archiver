
var BUCKET_NAME = 'ngds-archive';

var fs = require('fs');

var aws = require('aws-sdk');
aws.config.loadFromPath('./awsConfig.json');

var s3 = new aws.S3();

if (process.argv.length < 3) noParamsGiven();
else runWithParams();

function noParamsGiven() {
  showUsage();
  process.exit(-1);
}

function runWithParams() {
  console.log('NGDS Data Archiver ... running option is [' + process.argv[2] + ']');

  if (process.argv[2] === 'upload' && process.argv[3]) uploadPackages(process.argv[3]);
  else console.log('... that option isn\'t recognized');
}

// Upload all the files in the given folder 
function uploadPackages(path) {
  var fileList = getFileList(path + '/');

  fileList.forEach(function(entry) {
    console.log(path + '/' + entry + ' >>> ' + path + '/' + entry);
    uploadFile(path + '/' + entry, path + '/' + entry);
  });
}

// Get a list of files in the given folder
function getFileList(path) {
  var i, fileInfo, filesFound;
  var fileList = [];

  filesFound = fs.readdirSync(path);
  for (i = 0; i < filesFound.length; i++) {
    fileInfo = fs.lstatSync(path + filesFound[i]);
    if (fileInfo.isFile()) fileList.push(filesFound[i]);
  }

  return fileList;
}

// Upload the file
function uploadFile(remoteFilename, fileName) {
  var fileBuffer = fs.readFileSync(fileName);
  var metaData = getContentTypeByFile(fileName);

  s3.putObject({
    ACL: 'public-read',
    Bucket: BUCKET_NAME,
    Key: remoteFilename,
    Body: fileBuffer,
    ContentType: metaData
  }, function(error, response) {
    console.log('uploaded file[' + fileName + '] to [' + remoteFilename + '] as [' + metaData + ']');
    console.log(arguments);
  });
}

// Get the MIME type
function getContentTypeByFile(fileName) {
  var rc = 'application/octet-stream';
  var fileNameLowerCase = fileName.toLowerCase();

  if (fileNameLowerCase.indexOf('.zip') >= 0) rc = 'application/zip';

  return rc;
}

// Show available CLI parameters
function showUsage() {
  console.log('Use choosing one of these command line parameters:');
  console.log('  upload <path>');
}