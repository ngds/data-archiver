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
[-v, --vault]

# Commands for executing utilities
[-c, --csw]
[-w, --wfs]
[-a, --all]
[-h, --pingHosts]
[-l, --pingLinkages]
[-s --S3]
```