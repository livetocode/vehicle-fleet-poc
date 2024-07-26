set -e
echo "Compile shared libraries"
(cd shared/javascript/core-lib && npm run compile)
(cd shared/javascript/messaging-lib && npm run compile)
echo
echo "Cleanup data"
rm -rf event-collector/nodejs/output
echo
echo "Start collector"
(cd event-collector/nodejs && npm run start) &
echo
echo "Wait for collector to be ready..."
sleep 2
echo
echo "Start generator"
(cd event-generator/nodejs && npm run start)
sleep 2
echo
echo "[DONE] Execution complete"
