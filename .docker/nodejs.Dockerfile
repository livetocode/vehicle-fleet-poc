# select the app to build:
# - collector
# - generator
# - finder
# - viewer
ARG APP=collector

#-----------------------------------------------------------------------------------
FROM node:lts-alpine AS base
#-----------------------------------------------------------------------------------

WORKDIR /apps
ENV NODE_ENV=production

RUN apk add --update curl && \
    rm -rf /var/cache/apk/*

# Core lib
WORKDIR /apps/shared/javascript/core-lib
COPY --chown=node:node shared/javascript/core-lib/package.json shared/javascript/core-lib/package-lock.json ./

RUN npm ci --include dev && rm -rf ~/.npm

COPY --chown=node:node shared/javascript/core-lib ./

RUN npm run compile

# Messaging lib
WORKDIR /apps/shared/javascript/messaging-lib
COPY --chown=node:node shared/javascript/messaging-lib/package.json shared/javascript/messaging-lib/package-lock.json* ./

RUN npm ci --include dev && rm -rf ~/.npm

COPY --chown=node:node shared/javascript/messaging-lib ./

RUN npm run compile

# Data lib
WORKDIR /apps/shared/javascript/data-lib
COPY --chown=node:node shared/javascript/data-lib/package.json shared/javascript/data-lib/package-lock.json* ./

RUN npm ci --include dev && rm -rf ~/.npm

COPY --chown=node:node shared/javascript/data-lib ./

RUN npm run compile

#-----------------------------------------------------------------------------------
FROM base AS app-generator
#-----------------------------------------------------------------------------------
EXPOSE 7710
WORKDIR /apps/event-generator/nodejs

COPY --chown=node:node event-generator/nodejs/package.json event-generator/nodejs/package-lock.json* ./

RUN npm ci --include dev && rm -rf ~/.npm

COPY --chown=node:node event-generator/nodejs ./

RUN npm run compile

CMD ["node", "dist/main.js"] 
    
#-----------------------------------------------------------------------------------
FROM base AS app-collector
#-----------------------------------------------------------------------------------
EXPOSE 7720
WORKDIR /apps/event-collector/nodejs

COPY --chown=node:node event-collector/nodejs/package.json event-collector/nodejs/package-lock.json* ./

RUN npm ci --include dev && rm -rf ~/.npm

COPY --chown=node:node event-collector/nodejs ./

RUN npm run compile

CMD ["node", "dist/main.js"] 

#-----------------------------------------------------------------------------------
FROM base AS app-finder
#-----------------------------------------------------------------------------------
EXPOSE 7730
WORKDIR /apps/event-finder/nodejs

COPY --chown=node:node event-finder/nodejs/package.json event-finder/nodejs/package-lock.json* ./

RUN npm ci --include dev && rm -rf ~/.npm

COPY --chown=node:node event-finder/nodejs ./

RUN npm run compile

CMD ["node", "dist/main.js"] 
    
#-----------------------------------------------------------------------------------
FROM base AS app-viewer
#-----------------------------------------------------------------------------------
EXPOSE 3000
WORKDIR /apps/event-viewer/web/nuxt

COPY --chown=node:node event-viewer/web/nuxt/package.json event-viewer/web/nuxt/package-lock.json* ./

RUN npm ci --include dev && rm -rf ~/.npm

COPY --chown=node:node event-viewer/web/nuxt ./
COPY --chown=node:node config.yaml /apps/config.yaml

RUN npm run build

CMD ["npm", "run", "preview"] 

#-----------------------------------------------------------------------------------
FROM app-${APP} AS final
#-----------------------------------------------------------------------------------
USER node
