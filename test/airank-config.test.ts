import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { cacheTtlMs, sourceIntervalMs } from "../shared/consts"
import { genSources } from "../shared/pre-sources"

describe("airank realtime settings", () => {
  it("defaults cache ttl to five minutes", () => {
    expect(cacheTtlMs({})).toBe(300_000)
  })

  it("applies a source-specific interval override", () => {
    const env = {
      NEWSNOW_SOURCE_INTERVAL_OVERRIDES: "cls-telegraph=300000,zaobao=1800000",
    }

    expect(sourceIntervalMs("cls-telegraph", 1_800_000, env)).toBe(300_000)
    expect(sourceIntervalMs("zaobao", 600_000, env)).toBe(1_800_000)
  })

  it("rejects malformed cache and source interval overrides", () => {
    expect(() => cacheTtlMs({ NEWSNOW_CACHE_TTL_MS: "119999" })).toThrow()
    expect(() => genSources({ NEWSNOW_SOURCE_INTERVAL_OVERRIDES: "cls-telegraph=300000,cls-telegraph=600000" })).toThrow()
    expect(() => genSources({ NEWSNOW_SOURCE_INTERVAL_OVERRIDES: "unknown=300000" })).toThrow()
    expect(() => genSources({ NEWSNOW_SOURCE_INTERVAL_OVERRIDES: "cls-telegraph=-1" })).toThrow()
    expect(() => genSources({ NEWSNOW_SOURCE_INTERVAL_OVERRIDES: "cls-telegraph=300000.5" })).toThrow()
  })

  it("applies overrides after sub-sources are expanded", () => {
    const sources = genSources({
      NEWSNOW_SOURCE_INTERVAL_OVERRIDES: "cls-telegraph=300000",
    })

    expect(sources["cls-telegraph"].interval).toBe(300_000)
  })

  it("provides five-minute self-hosted defaults without removing persistent storage", () => {
    const exampleEnv = readFileSync("example.env.server", "utf8")
    const compose = readFileSync("docker-compose.yml", "utf8")
    const overrides = "cls-telegraph=300000,wallstreetcn-quick=300000,jin10=300000,xueqiu-hotstock=300000,gelonghui=300000,fastbull-express=300000,ithome=600000,zaobao=1800000"

    expect(exampleEnv).toContain("ENABLE_CACHE=true")
    expect(exampleEnv).toContain("NEWSNOW_CACHE_TTL_MS=300000")
    expect(exampleEnv).toContain(`NEWSNOW_SOURCE_INTERVAL_OVERRIDES=${overrides}`)
    expect(compose).toContain("- ENABLE_CACHE=true")
    expect(compose).toContain("- NEWSNOW_CACHE_TTL_MS=300000")
    expect(compose).toContain(`- NEWSNOW_SOURCE_INTERVAL_OVERRIDES=${overrides}`)
    expect(compose).toContain("- newsnow_data:/usr/app/.data")
  })
})
