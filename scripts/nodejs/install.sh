set -e
(cd shared/javascript/core-lib && npm i)
(cd shared/javascript/messaging-lib && npm i)
(cd event-collector/nodejs && npm i) &
(cd event-generator/nodejs && npm i)
(cd event-querier/nodejs && npm i)
(cd event-viewer/web/nuxt && npm i)
