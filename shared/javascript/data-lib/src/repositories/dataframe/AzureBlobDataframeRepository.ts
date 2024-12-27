import path from 'path';
import { DataFrame } from "nodejs-polars";
import { DataFrameRepository, ListOptions, DataFrameDescriptor, findCommonRoot } from "./DataFrameRepository.js";
import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";
import { detectFormat, dataframeToBuffer } from './DataFrameRepository.js';
import { bufferToDataframe } from './DataFrameRepository.js';

export class AzureBlobDataframeRepository implements DataFrameRepository {
    private blobServiceClient: BlobServiceClient;
    private containerClients = new Map<string, ContainerClient>();

    constructor(connectionString: string, private containerName: string) {      
      this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);        
    }

    async init(): Promise<void> {
        await this.getContainerClient(this.containerName);
    }

    async clear(): Promise<void> {
        // const events = this.blobServiceClient.getContainerClient('events');
        // await events.deleteIfExists();
        // this.containerClients.clear();
        // await this.getContainerClient('events');
    }

    async *list(options: ListOptions): AsyncGenerator<DataFrameDescriptor> {
        const container = await this.getContainerClient(this.containerName);
        const prefix = findCommonRoot(options.fromPrefix, options.toPrefix);
        for await (const blob of container.listBlobsFlat({ prefix })) {
            const format = detectFormat(blob.name);
            if (options.format === format && blob.name >= options.fromPrefix && blob.name < options.toPrefix) {
                yield {
                    name: blob.name,
                    size: blob.properties.contentLength ?? 0,
                    format,
                }
            }
        }
    }

    async exists(name: string): Promise<boolean> {
        const container = await this.getContainerClient(this.containerName);
        const blobName = path.basename(name).toLowerCase();
        const blockBlobClient = container.getBlockBlobClient(blobName);
        return await blockBlobClient.exists();
    }

    async read(name: string): Promise<DataFrame> {
        const format = detectFormat(name);
        const container = await this.getContainerClient(this.containerName);
        const blockBlobClient = container.getBlockBlobClient(name);
        const data = await blockBlobClient.downloadToBuffer();
        return bufferToDataframe(data, format);
    }

    async write(df: DataFrame, name: string): Promise<DataFrameDescriptor> {
        const format = detectFormat(name);
        const container = await this.getContainerClient(this.containerName);
        const blobName = name.toLowerCase();
        const blockBlobClient = container.getBlockBlobClient(blobName);
        const data = dataframeToBuffer(df, format);
        await blockBlobClient.upload(data, data.length);
        return {
            name: blobName,
            format,
            size: data.length,
        }
    }

    private async getContainerClient(name: string) {
        let result = this.containerClients.get(name);
        if (!result) {
            result = this.blobServiceClient.getContainerClient(name);
            this.containerClients.set(name, result);
            const createContainerResponse = await result.createIfNotExists();    
        }
        return result;
    }
}
