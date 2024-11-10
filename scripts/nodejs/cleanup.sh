set -e
rm -rf output
(cd shared/javascript/core-lib && npm run clean)
(cd shared/javascript/messaging-lib && npm run clean)
(cd event-collector/nodejs && npm run clean)
(cd event-generator/nodejs && npm run clean)
(cd event-finder/nodejs && npm run clean)
(cd event-viewer/web/nuxt && npm run clean)
