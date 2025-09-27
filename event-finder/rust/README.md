# Description

Client that will receive queries and publish the results.

A query can filter the data on:
- a time range
- a polygon
- a vehicle type

The queried data will come from files (parquet, csv, json, arrow) stored in the local filesystem or
any supported object store (Azure blob storage, AWS S3...).

# Run locally

## For debugging

```shell
cargo run
```

## For production

Note that compiling this project for release makes it 5 times faster!

```shell
cargo run --release
```
