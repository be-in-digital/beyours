import { createEmailRouteHandler } from "@beindigital-engine/core"

const { POST } = createEmailRouteHandler({
  secret: process.env.BETTER_AUTH_SECRET!,
})

export { POST }
