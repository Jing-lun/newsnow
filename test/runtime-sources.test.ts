import process from "node:process"
import { afterEach, describe, expect, it, vi } from "vitest"

const originalEnvironment = { ...process.env }

function restoreEnvironment() {
  Object.keys(process.env).forEach((key) => {
    if (!(key in originalEnvironment)) delete process.env[key]
  })
  Object.assign(process.env, originalEnvironment)
}

afterEach(() => {
  restoreEnvironment()
  vi.doUnmock("#/database/cache")
  vi.doUnmock("#/getters")
  vi.doUnmock("h3")
  vi.resetModules()
})

describe("server runtime source registry", () => {
  it("applies process interval overrides to the production registry", async () => {
    process.env.NEWSNOW_SOURCE_INTERVAL_OVERRIDES = "cls-telegraph=120000"

    const { runtimeSourceIntervals, runtimeSources } = await import("../server/runtime-sources")

    expect(runtimeSources["cls-telegraph"].interval).toBe(120_000)
    expect(runtimeSourceIntervals).toEqual(new Map([["cls-telegraph", 120_000]]))
  })

  it("uses the runtime registry for the health hash", async () => {
    process.env.NEWSNOW_SOURCE_INTERVAL_OVERRIDES = "cls-telegraph=120000"

    const { runtimeSources, sourceRegistryHash } = await import("../server/runtime-sources")
    const { healthStatus } = await import("../server/api/health")

    expect(healthStatus().sourceRegistryHash).toBe(sourceRegistryHash(runtimeSources))
    expect(healthStatus().configuredSourceIntervals).toEqual({
      "cls-telegraph": 120_000,
    })
  })

  it("uses the runtime interval when serving a cached source request", async () => {
    process.env.NEWSNOW_SOURCE_INTERVAL_OVERRIDES = "cls-telegraph=120000"
    const getter = vi.fn(async () => [{ id: "fresh", title: "Fresh", url: "https://example.com/fresh" }])
    vi.doMock("#/database/cache", () => ({
      getCacheTable: async () => ({
        get: async () => ({
          updated: Date.now() - 180_000,
          items: [{ id: "stale", title: "Stale", url: "https://example.com/stale" }],
        }),
        set: async () => undefined,
      }),
    }))
    vi.doMock("#/getters", () => ({
      getters: { "cls-telegraph": getter },
    }))
    vi.doMock("h3", () => ({
      createError: (error: unknown) => error,
      defineEventHandler: <T>(handler: T) => handler,
      getQuery: () => ({ id: "cls-telegraph", latest: "true" }),
    }))

    const handler = (await import("../server/api/s/index")).default as unknown as (event: { context: { disabledLogin: boolean } }) => Promise<{ items: { id: string }[] }>
    const response = await handler({ context: { disabledLogin: true } })

    expect(getter).toHaveBeenCalledOnce()
    expect(response.items).toEqual([{ id: "fresh", title: "Fresh", url: "https://example.com/fresh" }])
  })

  it("uses the runtime interval when reading cached sources in bulk", async () => {
    process.env.NEWSNOW_SOURCE_INTERVAL_OVERRIDES = "cls-telegraph=120000"
    const updated = Date.now() - 180_000
    vi.doMock("#/database/cache", () => ({
      getCacheTable: async () => ({
        getEntire: async () => [{
          id: "cls-telegraph",
          updated,
          items: [{ id: "stale", title: "Stale", url: "https://example.com/stale" }],
        }],
      }),
    }))
    vi.doMock("h3", () => ({
      defineEventHandler: <T>(handler: T) => handler,
      readBody: async () => ({ sources: ["cls-telegraph"] }),
    }))

    const handler = (await import("../server/api/s/entire.post")).default as unknown as (event: Record<string, never>) => Promise<{ updatedTime: number }[]>
    const response = await handler({})

    expect(response[0].updatedTime).toBe(updated)
  })
})
