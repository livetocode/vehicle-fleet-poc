import path, { basename } from 'path';
import { DataFrame } from "nodejs-polars";
import { DataFrameRepository, ListOptions, DataFrameDescriptor, findCommonRoot } from "./DataFrameRepository.js";
import { detectFormat, dataframeToBuffer } from './DataFrameRepository.js';
import { bufferToDataframe } from './DataFrameRepository.js';
import { Logger } from 'core-lib';
import { CreateBucketCommand, DeleteObjectsCommand, GetObjectCommand, HeadBucketCommand, HeadObjectCommand, ListObjectsV2Command, ListObjectsV2CommandInput, ListObjectsV2CommandOutput, ListObjectVersionsCommand, ObjectIdentifier, PutObjectCommand, PutObjectCommandInput, S3Client, S3ServiceException } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

export class S3DataframeRepository implements DataFrameRepository {
    private client: S3Client;

    constructor(private logger: Logger, private bucketName: string, private deleteBucketContentOnClear: boolean = false) {
        this.client = new S3Client({
            region: process.env.S3_REGION ?? 'foobar',
            credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY_ID!,
                secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
            },
            forcePathStyle: true, // required for minio and other S3-compatible services
            endpoint: process.env.S3_ENDPOINT_URL!,
        });
    }

    async init(): Promise<void> {
        await this.ensureBucketExists(this.bucketName);
    }

    async clear(): Promise<void> {
        if (this.deleteBucketContentOnClear) {
            this.logger.debug('Delete all events in container...');
            await this.emptyBucket(this.bucketName);
        }
    }

    async *list(options: ListOptions): AsyncGenerator<DataFrameDescriptor> {
        const defaultPrefix = options.subFolder ?? findCommonRoot(options.fromPrefix, options.toPrefix);
        const prefixes = options.prefixes ?? [defaultPrefix];
        for (const prefix of prefixes) {

            let continuationToken: string | undefined = undefined;

            try {
                do {
                    const params: ListObjectsV2CommandInput = {
                        Bucket: this.bucketName,
                        ContinuationToken: continuationToken,
                        StartAfter: prefix,
                        Prefix: prefix,
                    };

                    const command = new ListObjectsV2Command(params);
                    const data: ListObjectsV2CommandOutput = await this.client.send(command);

                    if (data.Contents) {
                        for (const content of data.Contents) {
                            const format = detectFormat(content.Key!);
                            const name = path.basename(content.Key!);
                            if (options.format === format && name >= options.fromPrefix && name < options.toPrefix) {
                                // console.debug(`Found matching object:`, content);
                                yield {
                                    name: content.Key!,
                                    size: content.Size ?? 0,
                                    format,
                                }
                            }
                        }
                    }

                    // If IsTruncated is true, there are more objects to fetch.
                    // The NextContinuationToken is used in the next request.
                    continuationToken = data.NextContinuationToken;

                } while (continuationToken); // Continue looping if a continuation token is present

            } catch (err) {
                console.error("Error listing objects in bucket:", err);
                throw err;
            }
        }
    }

    async exists(name: string): Promise<boolean> {
        const blobName = path.basename(name).toLowerCase();
        const command = new HeadObjectCommand({
            Bucket: this.bucketName,
            Key: blobName,
        });        
        try {
            await this.client.send(command);
            return true;
        } catch (error: any) {            
            if (error.name === "NotFound") {
                return false;
            }
            if (error instanceof S3ServiceException) {
                console.error(`S3 Service Error: ${error.name} - ${error.message}`);
            } else {
                console.error("An unexpected error occurred:", error);
            }
            throw error; // Re-throw other errors for proper handling upstream.
        }
    }

    async read(name: string): Promise<DataFrame> {
        const format = detectFormat(name);
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: name,
        });

        try {
            const response = await this.client.send(command);
            const body = response.Body;

            if (body instanceof Readable) {
                const chunks = await body.toArray();
                const buffer = Buffer.concat(chunks);
                return bufferToDataframe(buffer, format);
            } else {
                // Handle cases where Body might be null or not a stream (e.g., in other runtimes)
                throw new Error("S3 object body is not a readable stream.");
            }
        } catch (err) {
            console.error("Error reading object from S3:", err);
            throw err;
        }        
    }

    async write(df: DataFrame, name: string): Promise<DataFrameDescriptor> {
        const format = detectFormat(name);
        const blobName = name.toLowerCase();
        const data = dataframeToBuffer(df, format);
        const params: PutObjectCommandInput = {
            Bucket: this.bucketName,
            Key: blobName,
            Body: data, 
            ContentType: format,
        };
        try {
            const command = new PutObjectCommand(params);
            await this.client.send(command);
            // console.log(`Successfully uploaded object: ${blobName} to bucket: ${this.bucketName}`);
            return {
                name: blobName,
                format,
                size: data.length,
            }
        } catch (err) {
            console.error("Error uploading file to S3:", err);
            throw err;
        }
    }
    
    private async bucketExists(bucketName: string): Promise<boolean> {
        try {
            await this.client.send(new HeadBucketCommand({ Bucket: bucketName }));
            return true;
        } catch (error: any) {
            if (error.name === "NotFound") {
                return false;
            }
            throw error;
        }
    }

    private async ensureBucketExists(bucketName: string): Promise<void> {
        if (await this.bucketExists(bucketName)) {
            this.logger.debug(`Bucket "${bucketName}" already exists.`);
            return;
        }
        // If HeadBucketCommand throws an error, the bucket likely doesn't exist or is inaccessible.
        // Check the error type
        console.log(`Bucket "${bucketName}" not found. Creating...`);
        try {
            await this.client.send(new CreateBucketCommand({ Bucket: bucketName }));
            this.logger.info(`Bucket "${bucketName}" created successfully.`);
        } catch (createError: any) {
            // Handle potential race conditions or permission issues during creation
            if (createError.name === "BucketAlreadyOwnedByYou") {
                this.logger.warn(`Bucket "${bucketName}" already owned by you (race condition). Continuing.`);
            } else {
                this.logger.error(`Error creating bucket "${bucketName}":`, createError);
                throw createError; // Re-throw if it's another type of error
            }
        }
    }

    private async emptyBucket(bucketName: string): Promise<void> {
        let continuationToken: string | undefined = undefined;
        let objectsToDelete: ObjectIdentifier[] = [];
        let pages = 0;

        try {
            do {
                const params: ListObjectsV2CommandInput = {
                    Bucket: this.bucketName,
                    ContinuationToken: continuationToken,
                };

                this.logger.debug(`Listing objects in bucket "${bucketName}" for deletion (Page ${pages + 1})...`);
                const command = new ListObjectsV2Command(params);
                const data: ListObjectsV2CommandOutput = await this.client.send(command);
                pages++;

                if (data.Contents) {
                    for (const content of data.Contents) {
                        objectsToDelete.push({ Key: content.Key });
                    }
                }
                if (objectsToDelete.length > 0) {
                    // Delete objects in a single request (up to 1000 keys)
                    const deleteCommand = new DeleteObjectsCommand({
                    Bucket: bucketName,
                    Delete: {
                        Objects: objectsToDelete,
                        Quiet: true, // Set to false for a detailed response
                    },
                    });

                    await this.client.send(deleteCommand);
                    this.logger.debug(`Deleted ${objectsToDelete.length} objects.`);
                    objectsToDelete = []; 
                }

                // If IsTruncated is true, there are more objects to fetch.
                // The NextContinuationToken is used in the next request.
                continuationToken = data.NextContinuationToken;

            } while (continuationToken); // Continue looping if a continuation token is present

        } catch (err) {
            console.error("Error deleting objects in bucket:", err);
            throw err;
        }
    }
}
