import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"
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

  it("uses the provided Cloudflare environment when expanding sources", () => {
    expect(genSources({ CF_PAGES: "1" })["36kr"]).toBeUndefined()
  })

  it("provides five-minute self-hosted defaults without removing persistent storage", () => {
    const exampleEnv = readFileSync("example.env.server", "utf8")
    const dockerfile = readFileSync("Dockerfile", "utf8")
    const parse = createRequire(join(process.cwd(), "node_modules/vite/package.json"))("yaml").parse as (source: string) => {
      services: {
        newsnow: {
          build?: { context?: string, args?: Record<string, string> }
          environment: string[]
          image: string
          volumes: string[]
        }
      }
    }
    const compose = parse(readFileSync("docker-compose.yml", "utf8"))
    const overrides = "cls-telegraph=300000,wallstreetcn-quick=300000,jin10=300000,xueqiu-hotstock=300000,gelonghui=300000,fastbull-express=300000,ithome=600000,zaobao=1800000"
    const buildCommit = "$" + "{NEWSNOW_BUILD_COMMIT:?set NEWSNOW_BUILD_COMMIT to the reviewed git SHA}"

    expect(exampleEnv).toContain("ENABLE_CACHE=true")
    expect(exampleEnv).toContain("NEWSNOW_CACHE_TTL_MS=300000")
    expect(exampleEnv).toContain(`NEWSNOW_SOURCE_INTERVAL_OVERRIDES=${overrides}`)
    expect(exampleEnv).toContain("NEWSNOW_BUILD_COMMIT=")
    expect(exampleEnv).toContain("NEWSNOW_BUILD_COMMIT=$(git rev-parse HEAD) docker compose up -d --build")
    expect(compose.services.newsnow).toMatchObject({
      build: {
        context: ".",
        args: {
          NEWSNOW_BUILD_COMMIT: buildCommit,
        },
      },
      image: ["jing-lun/newsnow-airank:", buildCommit].join(""),
    })
    expect(compose.services.newsnow.environment).toEqual(expect.arrayContaining([
      "ENABLE_CACHE=true",
      "NEWSNOW_CACHE_TTL_MS=300000",
      `NEWSNOW_SOURCE_INTERVAL_OVERRIDES=${overrides}`,
      ["NEWSNOW_BUILD_COMMIT=", buildCommit].join(""),
    ]))
    expect(compose.services.newsnow.volumes).toContain("newsnow_data:/usr/app/.data")
    expect(dockerfile).toContain("ARG NEWSNOW_BUILD_COMMIT")
    expect(dockerfile).not.toContain("ARG NEWSNOW_BUILD_COMMIT=local")
    expect(dockerfile).toMatch(/ENV .*NEWSNOW_BUILD_COMMIT=\$\{NEWSNOW_BUILD_COMMIT\}/)
  })
})
