#!/bin/bash

PROCESS_NAME="dist/main.js" 

# Find PIDs of processes matching the name and kill them
ps aux | grep "$PROCESS_NAME" | grep -v grep | awk '{print $2}' | xargs kill -9
