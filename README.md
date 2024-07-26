# Purpose

This is a sample project for exploring different ways of persisting Geospatial events for long term storage.

This is also an excuse to test various technologies to handle a massive amount of data.
This includes different programming languages, as well as cloud services.

# Functional requirements

- An organization would manage a fleet of vehicles that would report their current GPS position every 5 seconds.
- The vehicles would remain in the area of a specific city and would typically be assigned to a district of the city.
- The data should be archived for 7 years
- The data should be queryable in order to find which cars where moving in a specific period, within a specific area of the city.

# Architecture

## Local dev

### Diagram


```
                                           +-----> Event Viewer
                                           |         + NuxtJS
Event Generator ==> Event Hub -------------+ 
                     + NATS                |                     
                                           +----> Event Collector ---> Event Aggregate Store <----- Event query
                                                     |                     + File system               + Custom
                                    Event Store <----+     
                                      + In memory                        
                                      + DuckDB                           
```

### Technologies:

- Event Hub: [NATS](https://nats.io/)
- Event Generator: Typescript NodeJS
- Event Viewer: Nuxt server, Typescript, PixiJS
- Event Collector: Typescript NodeJS
- Event Store: In memory, DuckDB
- Event Query: Typescript NodeJS

## Cloud

### Azure

#### Diagram

```
                                           +-----> Event Viewer
                                           |         + NuxtJS
Event Generator ==> Event Hub -------------+         + PowerBI
                     + Azure Event Hubs    |
                                           +----> Event Collector -------> Event Aggregate Store <------ Event query
                                                    + Azure Synapse            + Azure Blob                 + Azure Stream Analytics
```


#### Technologies:

- Event Hub: [Azure Event Hubs](https://azure.microsoft.com/fr-fr/products/event-hubs/)
- Event Generator: Typescript NodeJS
- Event Viewer: Nuxt server, Typescript, PixiJS
- Event Collector: [Azure Synapse Analytics](https://azure.microsoft.com/fr-fr/products/synapse-analytics/)
- Event Store: Azure Event Hub
- Event Query: [Azure Stream Analytics](https://azure.microsoft.com/fr-fr/products/stream-analytics/)

### AWS

#### Diagram

```
                                           +-----> Event Viewer
                                           |         + NuxtJS
Event Generator ==> Event Hub -------------+         
                     + AWS Eventbridge     |
                                           +----> Event Collector -------> Event Aggregate Store <------ Event query
                                                  + Amazon Data Firehose       + AWS S3                     + Amazon Athena
```


#### Technologies:

- Event Hub: [Amazon Eventbridge](https://aws.amazon.com/eventbridge/)
- Event Generator: Typescript NodeJS
- Event Viewer: Nuxt server, Typescript, PixiJS
- Event Collector: [Amazon Data firehose](https://aws.amazon.com/firehose/)
- Event Store: Azure Event Hub
- Event Query: [Azure Stream Analytics](https://azure.microsoft.com/fr-fr/products/stream-analytics/)

## File formats

- JSON
- CSV
- Arrow
- Parquet

# Roadmap

## Misc

create a script that would do the cost projections for the data that will be aggregated, stored and queried.

## Development

### NodeJS

#### Events

- use https://github.com/cloudevents/spec
- support auto reconnect when the server is not available
- Support multiple messaging systems such as RabbitMQ, AWS SQS or Azure Event Hubs
- Support event persistence
- Support retry in message handling

#### Generator

- Support partitioning (by zone) to have multiple separate processes that can generate data at the same time and increase throughput

#### Collector

- use long term storage to persist events until they can be aggregated (instead of just using memory)
- rewrite in Rust for speedup

#### Viewer

##### Web

- display the stats
- display the geohash zones at various levels
- use a mapping widget to display the vehicles?
- try other Web frameworks?

##### Terminal

TODO: add a CLI that would listen to stats events and display aggregated stats.

### Python

TODO

### Rust

TODO

### Deployment

- Deploy to Kubernetes

# Local development

## NodeJS

### Requirements

NodeJS LTS should be installed.

NATS server should be running. See [README](./event-hub/README.md) for the instructions.

### install

`bash scripts/nodejs/cleaup.sh`

`bash scripts/nodejs/install.sh`

### run the web viewer (optional)

```shell
cd ./event/viewer/web/nuxt
open http://localhost:3000/
npm run dev
```

### generate events

`bash scripts/nodejs/start.sh`

# References

https://medium.com/@igorvgorbenko/geospatial-data-analysis-in-clickhouse-polygons-geohashes-and-h3-indexing-2f55ff100fbe#:~:text=H3%20Indexing,-H3%20indexing&text=Similar%20to%20geohashes%2C%20a%20longer,occupy%20a%20fixed%208%20bytes.

https://medium.com/data-engineering-chariot/aggregating-files-in-your-data-lake-part-1-ed115b95425c
https://docs.aws.amazon.com/firehose/latest/dev/dynamic-partitioning.html
https://deepak6446.medium.com/why-did-we-move-from-mongodb-to-athena-with-parquet-297b61ddf299

https://learn.microsoft.com/en-us/azure/stream-analytics/stream-analytics-real-time-fraud-detection
https://www.red-gate.com/simple-talk/cloud/azure/query-blob-storage-sql-using-azure-synapse/

https://hivekit.io/blog/how-weve-saved-98-percent-in-cloud-costs-by-writing-our-own-database/
