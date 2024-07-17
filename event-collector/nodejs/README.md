# Description

Client that will receive single geospatial events, aggregate them and store them as aggregates.

# Stats

- 5000 vehicles
- one GPS event every 5 seconds, or 12 events per minute
- area is 52km x 18 km

# Hypothesis

5000 * 12 = 60000 / minute
60k * 10 = 600k / 10 minutes
         = 600k * 6 = 3.6M / hour
         = 3.6M * 24 = 86.4M / day
         = 86.4M * 365 = 31.5B / year
5 collectors, so 600k / 5 = 120k per collector for 10 minutes
event size = 
    timestamp: 25b
    vehicleId: 20b;
    gps.lat: 12b;
    gps.lon: 12b;
    gps.alt: 10b;
    geoHash: 7b;
    speed: 10b;
    direction: 10b;
    ==> Total = 106b
    ==> 13Mb / collector / 10 min
    ==> 31.5B * 106b = 3.03 TB / year

Geohash of precision 5 is 4.9km x 4.9km
Geohash of precision 6 is 1.2km * 609.4m
==> 52000/1200 * 18000/609 = 43.33 * 29.55 = 1280 files per 10 minutes = 67 276 800 / year

## First assessment

for 5k vehicles, reporting their position every 5 secs, with a GeoHash of 5:
- 900k events in 130 files.
- 6,923 events per file on average.

|format |size in MB|bytes per event|ratio to JSON|ratio to CSV|
|-------+----------|---------------|-------------|------------|
|json   |       205|          239.0|          1.0|        +2.6|
|csv    |        79|           92.0|         -2.6|         1.0|
|arrow  |        30|           35.0|             |            |
|parquet|        15|           17.5|        -13.6|        -5.2|

for 1k vehicles, reporting their position every 5 secs, with a GeoHash of 5:
- 19960000 events processed
- 357MB of data
- 10808 files

- 720k events per hour
- 17.3M events per day
- 6.3B events per year
- 390 files per hour
- 9360 files per day
- 3.4M files per year
- 13MB per hour
- 312MB per day
- 111GB per year
- 34KB per file
- 1846 events per file

for 15k vehicles:
- 6.3 B * 15 = 94B events per year
- 111 GB * 15 = 1.6TB per year
- 3.4 M files per year
- 34 KB * 15 = 510KB per file
- 1846 * 15 = 27.7k events per file

for 15k vehicles over 7 years:
- 94 B * 7 = 658B events
- 1.6 TB * 7 = 11.2TB
- 3.4 M * 7 = 23.8M files

# Format

filename pattern: yyyy-mm-dd-HH-MM-geohash
