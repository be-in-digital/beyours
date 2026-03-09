import { NextResponse } from "next/server"
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"

const CACHE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

let s3Client: S3Client | null = null

function getClient() {
  if (s3Client) return s3Client
  s3Client = new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })
  return s3Client
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key: keyParts } = await params
  const key = keyParts.join("/")

  if (!key || !process.env.AWS_S3_BUCKET_NAME) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const client = getClient()
    const response = await client.send(
      new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: key,
      })
    )

    if (!response.Body) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const bytes = await response.Body.transformToByteArray()
    const buffer = Buffer.from(bytes)

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": response.ContentType ?? "application/octet-stream",
        "Cache-Control": `public, max-age=${CACHE_MAX_AGE}, immutable`,
        "Content-Length": String(response.ContentLength ?? bytes.length),
      },
    })
  } catch (error: unknown) {
    console.error("S3 proxy error:", error)
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
}
