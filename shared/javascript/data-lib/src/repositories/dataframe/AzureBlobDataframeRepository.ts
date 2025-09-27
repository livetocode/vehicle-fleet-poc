import path from 'path';
import { DataFrame } from "nodejs-polars";
import { DataFrameRepository, ListOptions, DataFrameDescriptor, findCommonRoot } from "./DataFrameRepository.js";
import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";
import { detectFormat, dataframeToBuffer } from './DataFrameRepository.js';
import { bufferToDataframe } from './DataFrameRepository.js';

// Note that when using hierarchical listing with a nested layout, we have too many folders 
// because we have a distinct folder for each key/value pair and it will trigger too many 
// calls to listBlobsByHierarchy!
const canUseHierarchicalListing = false;

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
        if (options.subFolder && canUseHierarchicalListing) {
            yield* this.list_by_hierarchy(options, options.subFolder);
        } else {
            yield* this.list_flat(options);
        }
    }

    private async *list_flat(options: ListOptions): AsyncGenerator<DataFrameDescriptor> {
        const container = await this.getContainerClient(this.containerName);
        // TODO: use Azure Blob tags to better filter the files, using a tag for their timestamp for instance.
        // I'm not sure that we could filter on the geohash since we could have more than a dozen and it might not be efficient.
        // Anyway, we're just listing files and not reading them, so it's not as bad.
        const prefix = options.subFolder ?? findCommonRoot(options.fromPrefix, options.toPrefix);
        for await (const blob of container.listBlobsFlat({ prefix })) {
            if (!blob.name.includes('.')) {
                continue
            }
            const format = detectFormat(blob.name);
            const name = path.basename(blob.name);
            if (options.format === format && name >= options.fromPrefix && name < options.toPrefix) {
                // console.debug(`Found matching blob: ${blob.name}`);
                yield {
                    name: blob.name,
                    size: blob.properties.contentLength ?? 0,
                    format,
                }
            }
        }    
    }

    private async *list_by_hierarchy(options: ListOptions, currentPath: string): AsyncGenerator<DataFrameDescriptor> {
        if (!currentPath.endsWith('/')) {
            currentPath += '/';
        }
        // console.debug(`Listing blobs in hierarchy at path: ${currentPath}`);
        const container = await this.getContainerClient(this.containerName);
        for await (const blob of container.listBlobsByHierarchy("/", { prefix: currentPath })) {
            if (blob.kind === 'blob') {
                const format = detectFormat(blob.name);
                const name = path.basename(blob.name);
                if (options.format === format && name >= options.fromPrefix && name < options.toPrefix) {
                    yield {
                        name: blob.name,
                        size: blob.properties.contentLength ?? 0,
                        format,
                    }
                }
            } else if (blob.kind === 'prefix') {
                yield* this.list_by_hierarchy(options, blob.name);
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
            await result.createIfNotExists();    
        }
        return result;
    }
}
