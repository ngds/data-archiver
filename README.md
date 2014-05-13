## NGDS Data Archiver

Tool to archive data in the NGDS.

### Setup

- Clone this repository
- `npm install`
- Configure your S3 authorization credentials in a file called awsConfig.json
```
{
  "accessKeyId": "XXXX",
  "secretAccessKey": "XXXX",
  "region": "us-east-1"
}
```
- Edit archive.js changing `var BUCKET_NAME=` to your own bucket name

### Running
From the command line:
```
node archive.js upload /path/to/the/data/folder
```