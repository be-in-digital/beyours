import { NextResponse } from "next/server"
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { createS3Service } from "@beindigital-engine/core"
import type { S3Folder, S3Operations } from "@beindigital-engine/core"

const ALLOWED_FOLDERS: S3Folder[] = ["products", "branding", "stores", "cms", "games"]

function getS3Service() {
  const region = process.env.AWS_REGION
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
  const bucketName = process.env.AWS_S3_BUCKET_NAME

  if (!region || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error(
      "Missing required AWS S3 env vars: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET_NAME"
    )
  }

  const client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  })

  const operations: S3Operations = {
    async putObject(params) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: params.key,
          Body: params.body as Buffer | Uint8Array | string,
          ContentType: params.contentType,
          Metadata: params.metadata,
        })
      )
    },
    async deleteObject(params) {
      await client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: params.key }))
    },
    async getSignedUrl(params) {
      const command =
        params.operation === "putObject"
          ? new PutObjectCommand({ Bucket: bucketName, Key: params.key })
          : new PutObjectCommand({ Bucket: bucketName, Key: params.key })
      return await getSignedUrl(client, command, { expiresIn: params.expiresIn })
    },
    async headObject(params) {
      const response = await client.send(
        new HeadObjectCommand({ Bucket: bucketName, Key: params.key })
      )
      return {
        size: response.ContentLength ?? 0,
        contentType: response.ContentType ?? "application/octet-stream",
        lastModified: response.LastModified ?? new Date(),
        metadata: response.Metadata,
      }
    },
  }

  return createS3Service(
    {
      region,
      accessKeyId,
      secretAccessKey,
      bucketName,
      publicBaseUrl: process.env.AWS_S3_PUBLIC_BASE_URL,
    },
    operations
  )
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const folder = formData.get("folder") as string | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!folder || !ALLOWED_FOLDERS.includes(folder as S3Folder)) {
      return NextResponse.json(
        { error: `Invalid folder. Allowed: ${ALLOWED_FOLDERS.join(", ")}` },
        { status: 400 }
      )
    }

    const s3 = getS3Service()
    const buffer = Buffer.from(await file.arrayBuffer())

    const result = await s3.upload(buffer, {
      folder: folder as S3Folder,
      contentType: file.type,
    })

    // Return proxy URL instead of direct S3 URL (bucket may not be public)
    return NextResponse.json({
      url: `/api/s3/${result.key}`,
      key: result.key,
      size: result.size,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Upload failed"
    console.error("Upload error:", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
