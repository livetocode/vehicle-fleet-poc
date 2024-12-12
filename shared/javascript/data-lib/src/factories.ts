import { OutputConfig } from "core-lib";
import { FileDataframeRepository } from "./repositories/dataframe/FileDataframeRepository.js";
import { AzureBlobDataframeRepository } from "./repositories/dataframe/AzureBlobDataframeRepository.js";

export function createDataFrameRepository(config: OutputConfig) {
    if (config.storage.type === 'file') {
        return new FileDataframeRepository(config.storage.folder);
    }
    if (config.storage.type === 's3') {
        return new AzureBlobDataframeRepository();
    }
    throw new Error(`Unknown output type "${config.storage.type}"`);
}
