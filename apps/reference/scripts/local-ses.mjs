/**
 * A stand-in for Amazon SES v2, on 3282.
 *
 * The send loop is the one path in this codebase that nothing tests end to end:
 * it calls SES from a `"use node"` module that convex-test cannot execute, so
 * every test so far covers the loop's DECISIONS and not the loop making them.
 *
 * The AWS SDK honours `AWS_ENDPOINT_URL`, so pointing it here makes the real
 * action, in the real Convex runtime, send real requests we can read.
 */
import { createServer } from "node:http"
import { writeFileSync } from "node:fs"

const PORT = 3292
const OUT = process.argv[2] ?? "/tmp/sent-mail.json"

/** Every message the backend tried to send, in order. */
const sent = []

createServer((req, res) => {
  // A drain endpoint, so the probe can read what arrived without a file race.
  if (req.method === "GET" && req.url.startsWith("/__sent")) {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify(sent))
    return
  }

  let body = ""
  req.on("data", (chunk) => (body += chunk))
  req.on("end", () => {
    if (req.method !== "POST") {
      res.writeHead(404).end()
      return
    }

    try {
      const payload = JSON.parse(body)
      const headers = payload.Content?.Simple?.Headers ?? []
      const html = payload.Content?.Simple?.Body?.Html?.Data ?? ""
      sent.push({
        to: payload.Destination?.ToAddresses ?? [],
        from: payload.FromEmailAddress,
        subject: payload.Content?.Simple?.Subject?.Data,
        headers: Object.fromEntries(headers.map((h) => [h.Name, h.Value])),
        configurationSet: payload.ConfigurationSetName,
        // Kept so a probe can follow what the recipient would click. The
        // verification and unsubscribe journeys are only checkable this way.
        links: [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]),
        at: sent.length,
      })
      writeFileSync(OUT, JSON.stringify(sent, null, 2))
    } catch (error) {
      console.error("[mailcatcher] unparseable body:", error.message, body.slice(0, 200))
    }

    // What SESv2 SendEmail answers.
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ MessageId: `probe-${sent.length}` }))
  })
}).listen(PORT, "127.0.0.1", () => {
  console.log(`[mailcatcher] SES stand-in on ${PORT}, writing ${OUT}`)
})
