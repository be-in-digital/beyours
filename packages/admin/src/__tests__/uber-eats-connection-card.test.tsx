/**
 * The screen that says whether Uber Eats is actually connected (#274).
 *
 * WHAT THIS FIXES. `uberEatsConnections.getStatus` was written for the admin —
 * its docblock says so — and had no Convex wrapper and no caller; `disconnect`
 * was in the same state. An owner who completed the OAuth consent could not tell
 * whether it had taken, and could not end it.
 *
 * The rule worth pinning is the one an owner cannot work out by looking: a row
 * keeps saying `connected` after its access token has expired, because `status`
 * is written at the exchange and never revised. Whether that matters depends on
 * a refresh token existing — silently renewed, or dead and needing consent
 * again.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from "vitest"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"

const NOW = 1_700_000_000_000
const HOUR = 60 * 60 * 1000

const state: { connection: Record<string, unknown> | null | undefined } = {
  connection: undefined,
}

const calls: Array<{ name: string; args: unknown }> = []

vi.mock("convex/react", () => ({
  useQuery: (ref: unknown, args: unknown) => {
    if (args === "skip") return undefined
    if (ref === "uberEatsConnections:getStatus") return state.connection
    return undefined
  },
  useMutation: (ref: unknown) => async (args: unknown) => {
    calls.push({ name: String(ref), args })
    return null
  },
  useAction: (ref: unknown) => async (args: unknown) => {
    calls.push({ name: String(ref), args })
    return { url: "https://auth.uber.com/oauth/v2/authorize" }
  },
}))

vi.mock("sonner", () => ({ toast: { success: () => {}, error: () => {} } }))

import {
  UberEatsConnectionCard,
  describeConnection,
} from "../pages/stores/uber-eats-connection-card"
import { useAdminApiStore } from "../stores/admin-api-store"

describe("what the owner is told about the connection", () => {
  it("says nothing is connected when no consent was ever given", () => {
    expect(describeConnection(null, NOW).label).toBe("Non connecté")
    expect(describeConnection(null, NOW).tone).toBe("off")
  })

  it("calls a live connection connected, and adds no noise to it", () => {
    const described = describeConnection(
      { status: "connected", hasRefreshToken: true, tokenExpiresAt: NOW + HOUR },
      NOW
    )

    expect(described.label).toBe("Connecté")
    expect(described.tone).toBe("live")
    expect(described.detail).toBeNull()
  })

  it("asks for a reconnection when the token died with nothing to renew it", () => {
    // The row still says `connected` — `status` is written once, at the
    // exchange. Believing it is how an owner waits for a sync that cannot run.
    const described = describeConnection(
      { status: "connected", hasRefreshToken: false, tokenExpiresAt: NOW - HOUR },
      NOW
    )

    expect(described.label).toBe("À reconnecter")
    expect(described.tone).toBe("attention")
  })

  it("does not alarm anybody over an expiry a refresh token will absorb", () => {
    const described = describeConnection(
      { status: "connected", hasRefreshToken: true, tokenExpiresAt: NOW - HOUR },
      NOW
    )

    expect(described.label).toBe("Connecté")
    expect(described.tone).toBe("live")
    expect(described.detail).toContain("renouvelée automatiquement")
  })

  it("surfaces a refusal from Uber rather than showing a green badge over it", () => {
    expect(describeConnection({ status: "error", hasRefreshToken: true }, NOW).tone).toBe(
      "attention"
    )
  })

  it("says a disconnected account is disconnected", () => {
    expect(
      describeConnection({ status: "disconnected", hasRefreshToken: false }, NOW).label
    ).toBe("Déconnecté")
  })
})

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
})

let mounted: { root: Root; container: HTMLElement } | null = null

afterEach(() => {
  if (mounted) {
    const { root, container } = mounted
    act(() => root.unmount())
    container.remove()
    mounted = null
  }
  calls.length = 0
  state.connection = undefined
})

async function mountCard(hasUberEatsGlobal: boolean | undefined) {
  useAdminApiStore.setState({
    api: {
      uberEatsConnections: {
        getStatus: "uberEatsConnections:getStatus",
        disconnect: "uberEatsConnections:disconnect",
      },
      uberEatsOAuth: { generateAuthorizeUrl: "uberEatsOAuth:generateAuthorizeUrl" },
    },
  })
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted = { root, container }
  await act(async () => {
    root.render(<UberEatsConnectionCard hasUberEatsGlobal={hasUberEatsGlobal} />)
  })
  return container
}

function button(container: HTMLElement, label: string) {
  return [...container.querySelectorAll("button")].find((element) =>
    (element.textContent ?? "").includes(label)
  )
}

describe("the connection card", () => {
  it("offers a way in when nothing is connected, and nothing to disconnect", async () => {
    state.connection = null

    const container = await mountCard(true)

    expect(container.textContent).toContain("Non connecté")
    expect(button(container, "Connecter le compte")).toBeDefined()
    expect(button(container, "Déconnecter")).toBeUndefined()
  })

  it("ends the connection when asked", async () => {
    state.connection = {
      status: "connected",
      hasRefreshToken: true,
      connectedAt: NOW,
      tokenExpiresAt: NOW + HOUR,
      merchantUserId: "merchant-42",
    }

    const container = await mountCard(true)
    expect(container.textContent).toContain("merchant-42")

    await act(async () => {
      button(container, "Déconnecter")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      )
    })

    expect(calls).toEqual([{ name: "uberEatsConnections:disconnect", args: {} }])
  })

  it("stays silent on a deployment that carries no Uber Eats credentials", async () => {
    // The card below already says the credentials are missing; repeating it
    // here would offer a consent flow that throws before it redirects.
    state.connection = null

    expect((await mountCard(false)).textContent).toBe("")
  })

  it("says nothing while the answer is still loading", async () => {
    state.connection = undefined

    expect((await mountCard(true)).textContent).toBe("")
  })
})
