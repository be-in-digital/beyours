import { NextResponse } from "next/server"

export async function POST(_request: Request) {
  // TODO: Implement Stripe webhook handler
  return NextResponse.json({ received: true })
}
