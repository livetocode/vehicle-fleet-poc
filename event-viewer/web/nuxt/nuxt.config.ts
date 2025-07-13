// https://nuxt.com/docs/api/configuration/nuxt-config
import fs from 'fs';
import YAML from 'yaml';
import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

const file = fs.readFileSync('../../../config.yaml', 'utf8');
const config = YAML.parse(file);

export default defineNuxtConfig({
  devtools: { enabled: true },
  ssr: false,
  appConfig: config,
  runtimeConfig: {
    public: {
      appName: 'Vehicles tracker',
      natsServers: [] as string[],
    },
  },
  compatibilityDate: '2024-07-21',
  build: {
    transpile: ['vuetify'],
  },
  modules: [
    (_options, nuxt) => {
      nuxt.hooks.hook('vite:extendConfig', (config) => {
        // @ts-expect-error
        config.plugins.push(vuetify({ autoImport: true }))
        // @ts-expect-error
        config.plugins.push(nodePolyfills())
      })
    },
    //...
  ],
  vite: {
    vue: {
      template: {
        transformAssetUrls,
      },
    },
  },  
})