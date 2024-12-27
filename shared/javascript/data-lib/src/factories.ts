import { OutputConfig } from "core-lib";
import { FileDataframeRepository } from "./repositories/dataframe/FileDataframeRepository.js";
import { AzureBlobDataframeRepository } from "./repositories/dataframe/AzureBlobDataframeRepository.js";

export function createDataFrameRepository(config: OutputConfig) {
    if (config.storage.type === 'file') {
        return new FileDataframeRepository(config.storage.folder);
    }
    if (config.storage.type === 'azure-blob') {
        const connectionString = process.env.VEHICLES_AZURE_STORAGE_CONNECTION_STRING ?? config.storage.connectionString;
      
      if (!connectionString) {
        throw Error('Azure Storage Connection string not found: VEHICLES_AZURE_STORAGE_CONNECTION_STRING');
      }
        return new AzureBlobDataframeRepository(connectionString, config.storage.containerName);
    }
    throw new Error(`Unknown output type "${config.storage.type}"`);
}
