import { Logger, OutputConfig } from "core-lib";
import { FileDataframeRepository } from "./repositories/dataframe/FileDataframeRepository.js";
import { NoopDataframeRepository } from "./repositories/dataframe/NoopDataframeRepository.js";
import { AzureBlobDataframeRepository } from "./repositories/dataframe/AzureBlobDataframeRepository.js";
import { S3DataframeRepository } from "./repositories/dataframe/S3BlobDataframeRepository.js";

export function createDataFrameRepository(config: OutputConfig, logger: Logger) {
    if (config.storage.type === 'noop') {
      return new NoopDataframeRepository(logger, config.storage.writeDelayInMS ?? 0);
    }
    if (config.storage.type === 'file') {
      if (config.storage.isFake) {
        return new NoopDataframeRepository(logger, config.storage.writeDelayInMS ?? 0);
      }
      return new FileDataframeRepository(config.storage.folder);
    }
    if (config.storage.type === 's3') {
      return new S3DataframeRepository(logger, config.storage.bucketName, config.storage.deleteBucketContentOnClear);
    }
    if (config.storage.type === 'azure-blob') {
      const connectionString = process.env.VEHICLES_AZURE_STORAGE_CONNECTION_STRING || config.storage.connectionString;
      
      if (!connectionString) {
        throw Error('Azure Storage Connection string not found: VEHICLES_AZURE_STORAGE_CONNECTION_STRING');
      }
      return new AzureBlobDataframeRepository(logger, connectionString, config.storage.containerName);
    }
    throw new Error(`Unknown output type "${(config.storage as any).type}"`);
}
