import process from "node:process"
import { afterEach, describe, expect, it, vi } from "vitest"

const originalEnvironment = { ...process.env }

afterEach(() => {
  Object.keys(process.env).forEach((key) => {
    if (!(key in originalEnvironment)) delete process.env[key]
  })
  Object.assign(process.env, originalEnvironment)
  vi.resetModules()
})

describe("health endpoint", () => {
  it("reports safe runtime configuration from the server registry", async () => {
    process.env.JWT_SECRET = "must-not-be-exposed"
    process.env.NEWSNOW_DECLARED_REVISION = "ABCDEF0123456789ABCDEF0123456789ABCDEF01"
    process.env.NEWSNOW_SOURCE_INTERVAL_OVERRIDES = "cls-telegraph=120000"

    const { runtimeSources, sourceRegistryHash } = await import("../server/runtime-sources")
    const { healthStatus } = await import("../server/api/health")
    const status = healthStatus()

    expect(status).toMatchObject({
      status: "ok",
      version: "0.0.41",
      declaredRevision: "abcdef0123456789abcdef0123456789abcdef01",
      readinessEndpoint: "/api/ready",
      cacheTtlMs: 300_000,
      sourceRegistryHash: sourceRegistryHash(runtimeSources),
      configuredSourceIntervals: {
        "cls-telegraph": 120_000,
      },
    })
    expect(JSON.stringify(status)).not.toContain(process.env.JWT_SECRET)
  })

  it.each([
    ["missing", undefined],
    ["short", "abc123"],
    ["non-hex", "z".repeat(40)],
    ["surrounded by whitespace", ` ${"a".repeat(40)} `],
  ])("does not report a %s revision declaration", async (_, revision) => {
    if (revision === undefined) delete process.env.NEWSNOW_DECLARED_REVISION
    else process.env.NEWSNOW_DECLARED_REVISION = revision

    const { healthStatus } = await import("../server/api/health")

    expect(healthStatus().declaredRevision).toBeNull()
  })
})
