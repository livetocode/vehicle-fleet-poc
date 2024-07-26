// https://nuxt.com/docs/api/configuration/nuxt-config
import fs from 'fs';
import YAML from 'yaml';

const file = fs.readFileSync('../../../config.yaml', 'utf8');
const config = YAML.parse(file);

export default defineNuxtConfig({
  devtools: { enabled: true },
  ssr: false,
  appConfig: config,
  compatibilityDate: '2024-07-21',
})