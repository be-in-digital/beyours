/**
 * Setup S3 bucket for public read access on image folders.
 *
 * This script:
 * 1. Disables "Block Public Access" on the bucket
 * 2. Sets a bucket policy allowing public GetObject on image folders
 *
 * Usage: node scripts/setup-s3-public-access.mjs
 *
 * Requires env vars: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET_NAME
 */

import {
  S3Client,
  PutBucketPolicyCommand,
  PutPublicAccessBlockCommand,
} from "@aws-sdk/client-s3"
import { config } from "dotenv"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env.local from restaurant-theme
config({ path: resolve(__dirname, "../apps/restaurant-theme/.env.local") })

const region = process.env.AWS_REGION
const accessKeyId = process.env.AWS_ACCESS_KEY_ID
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
const bucketName = process.env.AWS_S3_BUCKET_NAME

if (!region || !accessKeyId || !secretAccessKey || !bucketName) {
  console.error("Missing required env vars: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET_NAME")
  process.exit(1)
}

const client = new S3Client({
  region,
  credentials: { accessKeyId, secretAccessKey },
})

const PUBLIC_FOLDERS = ["products/*", "branding/*", "stores/*", "cms/*", "games/*"]

async function main() {
  console.log(`Configuring bucket: ${bucketName}`)

  // Step 1: Disable Block Public Access
  console.log("1. Disabling Block Public Access...")
  await client.send(
    new PutPublicAccessBlockCommand({
      Bucket: bucketName,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: false,
        IgnorePublicAcls: false,
        BlockPublicPolicy: false,
        RestrictPublicBuckets: false,
      },
    })
  )
  console.log("   Done.")

  // Step 2: Set bucket policy for public read on image folders
  console.log("2. Setting bucket policy for public read access...")
  const policy = {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "PublicReadImages",
        Effect: "Allow",
        Principal: "*",
        Action: "s3:GetObject",
        Resource: PUBLIC_FOLDERS.map((folder) => `arn:aws:s3:::${bucketName}/${folder}`),
      },
    ],
  }

  await client.send(
    new PutBucketPolicyCommand({
      Bucket: bucketName,
      Policy: JSON.stringify(policy),
    })
  )
  console.log("   Done.")

  console.log("\nBucket configured successfully!")
  console.log(`Public URL pattern: https://${bucketName}.s3.${region}.amazonaws.com/<folder>/<file>`)
}

main().catch((err) => {
  console.error("Failed:", err.message)
  process.exit(1)
})
