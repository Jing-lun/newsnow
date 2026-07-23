import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { genSources } from "../shared/pre-sources"
import { healthStatus } from "../server/api/health"

describe("health endpoint", () => {
  it("reports safe runtime configuration and a canonical source registry hash", () => {
    const env = {
      JWT_SECRET: "must-not-be-exposed",
      NEWSNOW_BUILD_COMMIT: "abc123",
      NEWSNOW_SOURCE_INTERVAL_OVERRIDES: "cls-telegraph=300000",
    }
    const canonicalRegistry = Object.entries(genSources(env))
      .map(([id, source]): [string, number] => [id, source.interval])
      .sort(([left], [right]) => left.localeCompare(right))
    const sourceRegistryHash = createHash("sha256")
      .update(JSON.stringify(canonicalRegistry))
      .digest("hex")

    const status = healthStatus(env)

    expect(status).toEqual({
      status: "ok",
      version: "0.0.41",
      buildCommit: "abc123",
      cacheTtlMs: 300_000,
      sourceRegistryHash,
      configuredSourceIntervals: {
        "cls-telegraph": 300_000,
      },
    })
    expect(JSON.stringify(status)).not.toContain(env.JWT_SECRET)
  })

  it("uses an unknown build commit when none is configured", () => {
    expect(healthStatus({}).buildCommit).toBe("unknown")
  })
})
