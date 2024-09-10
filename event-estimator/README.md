# Estimator utility

The purpose of this script is to estimate the number of events, the number of files and the size of those files
according to various parameters, such as the number of vehicles, the event frequency, the aggregation period
or the data partitioning strategy.

## Requirements

You need Python3 and you should create a virtual environment:

Make sure that you are in the "event-estimator" folder and run:

```shell
python3 -m venv .venv
```

Then you must install the required packages:
```shell
.venv/bin/pip3 install -r requirements.txt
```

## Execute

```shell
.venv/bin/python3 estimate.py
```
