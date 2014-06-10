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

### Running
From the command line:
- Run the NGDS Data Archiver: `npm index.js -p`
- Run code tests: `npm test`
