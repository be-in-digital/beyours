/**
 * AWS S3 adapter using AWS SDK v3
 * @module aws/s3/adapter
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { S3Operations, ObjectMetadata } from './types'
import type { AWSConfig, S3Config } from '../types'
import { createS3Service } from './client'
import type { S3Service } from './client'

/**
 * Creates S3 operations using AWS SDK v3
 * @param config - S3 configuration with credentials and bucket
 * @returns S3 operations implementation
 */
export function createS3Operations(config: S3Config): S3Operations {
  const client = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })

  const { bucketName } = config

  return {
    async putObject(params) {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: params.key,
        Body: params.body as Buffer | Uint8Array | string,
        ContentType: params.contentType,
        Metadata: params.metadata,
      })
      await client.send(command)
    },

    async deleteObject(params) {
      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: params.key,
      })
      await client.send(command)
    },

    async getSignedUrl(params) {
      const command =
        params.operation === 'putObject'
          ? new PutObjectCommand({ Bucket: bucketName, Key: params.key })
          : new GetObjectCommand({ Bucket: bucketName, Key: params.key })
      return await getSignedUrl(client, command, { expiresIn: params.expiresIn })
    },

    async headObject(params): Promise<ObjectMetadata> {
      const command = new HeadObjectCommand({
        Bucket: bucketName,
        Key: params.key,
      })
      const response = await client.send(command)
      return {
        size: response.ContentLength ?? 0,
        contentType: response.ContentType ?? 'application/octet-stream',
        lastModified: response.LastModified ?? new Date(),
        metadata: response.Metadata,
      }
    },
  }
}

/**
 * Reads S3 configuration from environment variables
 * @returns S3 configuration object
 * @throws {Error} If required environment variables are missing
 */
export function getS3Config(): S3Config {
  const region = process.env.AWS_REGION
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
  const bucketName = process.env.AWS_S3_BUCKET_NAME

  if (!region || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error(
      'Missing required AWS S3 environment variables: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET_NAME'
    )
  }

  return {
    region,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicBaseUrl: process.env.AWS_S3_PUBLIC_BASE_URL,
  }
}

/**
 * Creates a fully configured S3 service from environment variables
 * @returns Initialized S3 service ready to upload/manage files
 * @throws {Error} If environment variables are not properly configured
 */
export function getS3Service(): S3Service {
  const config = getS3Config()
  const operations = createS3Operations(config)
  return createS3Service(config, operations)
}
