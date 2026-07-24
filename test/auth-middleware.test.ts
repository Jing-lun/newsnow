import process from "node:process"
import { afterEach, describe, expect, it, vi } from "vitest"

const originalEnvironment = { ...process.env }

function restoreEnvironment() {
  Object.keys(process.env).forEach((key) => {
    if (!(key in originalEnvironment)) delete process.env[key]
  })
  Object.assign(process.env, originalEnvironment)
}

async function loadMiddleware(pathname: string) {
  vi.doMock("h3", () => ({
    createError: (error: { statusCode: number, message: string }) =>
      Object.assign(new Error(error.message), error),
    defineEventHandler: <T>(handler: T) => handler,
    getRequestURL: () => new URL(`http://localhost${pathname}`),
  }))
  return (await import("../server/middleware/auth")).default as unknown as (
    event: { context: Record<string, unknown> },
  ) => Promise<void>
}

afterEach(() => {
  restoreEnvironment()
  vi.doUnmock("h3")
  vi.resetModules()
})

describe("authentication middleware", () => {
  it("allows exactly the health endpoint with an empty auth configuration", async () => {
    delete process.env.JWT_SECRET
    delete process.env.G_CLIENT_ID
    delete process.env.G_CLIENT_SECRET
    const handler = await loadMiddleware("/api/health")
    const event = { context: {} }

    await expect(handler(event)).resolves.toBeUndefined()
    expect(event.context.disabledLogin).toBe(true)
  })

  it.each(["/api/health/extra", "/api/admin"])(
    "keeps %s protected with an empty auth configuration",
    async (pathname) => {
      delete process.env.JWT_SECRET
      delete process.env.G_CLIENT_ID
      delete process.env.G_CLIENT_SECRET
      const handler = await loadMiddleware(pathname)

      await expect(handler({ context: {} })).rejects.toMatchObject({
        statusCode: 506,
        message: "Server not configured, disable login",
      })
    },
  )
})
