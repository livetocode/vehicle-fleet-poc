set -e
(cd shared/javascript/core-lib && npm run clean)
(cd shared/javascript/messaging-lib && npm run clean)
(cd event-collector/nodejs && npm run clean) &
(cd event-generator/nodejs && npm run clean)
(cd event-querier/nodejs && npm run clean)
