import { NextResponse } from "next/server"

export async function POST(request: Request) {
  // TODO: Implement Uber Eats webhook handler
  return NextResponse.json({ received: true })
}
