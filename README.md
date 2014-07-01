NGDS Data Archiver
==================
Node.js command line utility for:
- Scraping XML metadata from CSW and WFS
- Downloading linkage data from CSW and WFS
- Pinging hosts and returning status codes
- Pinging data linkages and returning status codes
- Writing ping status to CSV files
- Uploading data to Amazon S3

####Dependencies
* Node.js >= v0.10.28 64-bit
* NPM >= v1.4.9

####Installation
```
git clone https://github.com/ngds/data-archiver.git
cd data-archiver
npm install
```

####Usage
```
# Commands for flow control and building requests
[-u, --url] CSW URL endpoint to scrape data from
[-m, --max] Upper limit of metadata records to scrape
[-f, --first] Metadata record to start scraping from
[-i, --increment] Number of metadata records to return per request
[-b, --bucket] Amazon S3 bucket to upload data to

# Commands for executing utilities
[-c, --csw] Scrape a CSW and download all data linkages
[-w, --wfs] Only scrape WFS and download all data linkages
[-a, --all] Scrape and download everything
[-h, --pingHosts] Ping every host and write status to CSV
[-l, --pingLinkages] Ping every linkage and write status to CSV
[-s --S3] Upload data to Amazon S3
```

#####Scrape an entire CSW and download linkages
```
node index.js -c -u http://geothermaldata.org/csw?
```

#####Scrape the first 5000 metadata records in a CSW
```
node index.js -c -u http://geothermaldata.org/csw? -m 5000
```

#####Scrape the second 5000 metadata records in a CSW
```
node index.js -c -u http://geothermaldata.org/csw? -f 5000 -m 5000
```

#####Only scrape WFS
```
node index.js -w -u http://geothermaldata.org/csw?
```

#####Ping every host
```
node index.js -h -u http://geothermaldata.org/csw?
```

#####Ping every data linkage
```
node index.js -l -u http://geothermaldata.org/csw?
```

#####Upload downloaded data to Amazon S3
```
node index.js -s -b ngds-bucket
```