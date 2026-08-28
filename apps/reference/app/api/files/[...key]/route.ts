import { NextResponse } from "next/server"
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"
import { isPublicS3Key, S3_FOLDERS } from "@/lib/aws"
import { isAuthenticated } from "@/lib/convex"

function getS3Client() {
  return new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })
}

/**
 * GET /api/files/:folder/:filename
 *
 * Reads an S3 object with server credentials. Access follows the prefix
 * allowlist in `apps/docs/deployment/s3-bucket-policy.md`:
 *
 * - Public prefixes are marketing assets. They are readable anonymously here
 *   as well as through the CDN, so this route adds no exposure. Prefer the CDN
 *   URL; this path exists for links already stored in the database.
 * - Private prefixes hold what a customer uploads about themselves. They are
 *   excluded from the bucket policy, so this route is their only read path and
 *   it requires an authenticated session.
 * - An unrecognised prefix is refused. Adding a folder without classifying it
 *   cannot silently expose it.
 *
 * Responses are cached for 1 year (immutable assets with UUID names); private
 * objects are marked private so no shared cache retains them.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key: segments } = await params
  const key = segments.join("/")

  if (!key || key.includes("..") || key.startsWith("/")) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 })
  }

  const folder = segments[0] ?? ""
  if (!(S3_FOLDERS as readonly string[]).includes(folder)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }

  const isPublic = isPublicS3Key(key)

  if (!isPublic) {
    let authenticated = false
    try {
      authenticated = await isAuthenticated()
    } catch (error) {
      // A misconfigured or unreachable auth backend must deny the read, not
      // surface the object. Fail closed.
      console.error("S3 proxy auth check failed:", error)
      return NextResponse.json(
        { error: "Authentification indisponible" },
        { status: 503 }
      )
    }
    if (!authenticated) {
      return NextResponse.json(
        { error: "Authentification requise" },
        { status: 401 }
      )
    }
  }

  const bucketName = process.env.AWS_S3_BUCKET_NAME
  if (!bucketName) {
    return NextResponse.json({ error: "S3 not configured" }, { status: 500 })
  }

  try {
    const client = getS3Client()
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    )

    if (!response.Body) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    const bytes = await response.Body.transformToByteArray()

    return new NextResponse(Buffer.from(bytes) as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": response.ContentType ?? "application/octet-stream",
        "Cache-Control": isPublic
          ? "public, max-age=31536000, immutable"
          : "private, max-age=31536000, immutable",
        "Content-Length": String(bytes.length),
      },
    })
  } catch (error: unknown) {
    const code = (error as { name?: string })?.name
    if (code === "NoSuchKey") {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }
    console.error("S3 proxy error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
