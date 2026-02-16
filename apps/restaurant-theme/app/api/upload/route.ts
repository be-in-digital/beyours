import { NextResponse } from "next/server"

export async function POST(_request: Request) {
  // TODO: Implement file upload handler (S3)
  return NextResponse.json({ error: "Not implemented" }, { status: 501 })
}
