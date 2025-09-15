#!/bin/bash
set -e

bash scripts/nodejs/kill-all.sh

.venv/bin/python3 scripts/nodejs/build-and-start.py

