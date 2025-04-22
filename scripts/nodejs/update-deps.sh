set -e
(cd shared/javascript/core-lib && npm run update-deps)
(cd shared/javascript/data-lib && npm run update-deps)
(cd shared/javascript/messaging-lib && npm run update-deps)
(cd event-collector/nodejs && npm run update-deps) &
(cd event-generator/nodejs && npm run update-deps)
(cd event-finder/nodejs && npm run update-deps)
(cd event-viewer/web/nuxt && npm run update-deps)
