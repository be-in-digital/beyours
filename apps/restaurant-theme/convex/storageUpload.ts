"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const ALLOWED_FOLDERS = ["products", "branding", "stores", "cms", "email"] as const;
type S3Folder = (typeof ALLOWED_FOLDERS)[number];

const ALLOWED_MIME_TYPES: Record<S3Folder, string[]> = {
  products: ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/svg+xml"],
  branding: ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/svg+xml"],
  stores: ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/svg+xml"],
  cms: ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/svg+xml", "application/pdf"],
  email: ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/svg+xml", "image/gif"],
};

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

function createS3Client() {
  return new S3Client({
    region: process.env.AWS_REGION ?? "eu-west-3",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

/**
 * Generate a presigned URL for direct browser-to-S3 upload.
 *
 * Flow:
 *  1. Client calls this action with folder + contentType
 *  2. Returns { uploadUrl, key, publicUrl }
 *  3. Client PUTs file directly to uploadUrl
 *  4. Client uses publicUrl in the block
 */
export const getPresignedUploadUrl = action({
  args: {
    folder: v.string(),
    contentType: v.string(),
    filename: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Validate folder
    const folder = args.folder as S3Folder;
    if (!ALLOWED_FOLDERS.includes(folder)) {
      throw new Error(`Dossier non autorisé: ${args.folder}`);
    }

    // Validate MIME type
    const allowedTypes = ALLOWED_MIME_TYPES[folder];
    if (!allowedTypes.includes(args.contentType)) {
      throw new Error(
        `Type MIME non autorisé pour le dossier "${folder}". Types acceptés: ${allowedTypes.join(", ")}`
      );
    }

    // Generate unique key
    const ext = MIME_TO_EXT[args.contentType] ?? "bin";
    const uuid = crypto.randomUUID();
    const name = args.filename ? `${args.filename}-${uuid}` : uuid;
    const key = `${folder}/${name}.${ext}`;

    // Create presigned URL
    const bucketName = process.env.AWS_S3_BUCKET_NAME!;
    const client = createS3Client();

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: args.contentType,
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 900 });

    // Build public URL
    const publicBaseUrl = process.env.AWS_S3_PUBLIC_BASE_URL;
    const publicUrl = publicBaseUrl
      ? `${publicBaseUrl}/${key}`
      : `https://${bucketName}.s3.${process.env.AWS_REGION ?? "eu-west-3"}.amazonaws.com/${key}`;

    return { uploadUrl, key, publicUrl };
  },
});
