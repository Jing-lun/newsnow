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
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { packageManager?: string }
    const readme = readFileSync("README.md", "utf8")
    const parse = createRequire(join(process.cwd(), "node_modules/vite/package.json"))("yaml").parse as (source: string) => unknown
    const compose = parse(readFileSync("docker-compose.yml", "utf8")) as {
      services: {
        newsnow: {
          build?: { context?: string, args?: Record<string, string> }
          environment: string[]
          image: string
          volumes: string[]
        }
      }
    }
    const productionWorkflow = parse(readFileSync(".github/workflows/production.yml", "utf8")) as {
      jobs: {
        "verify-production": {
          steps: Array<{
            name?: string
            run?: string
            uses?: string
            with?: Record<string, string>
          }>
        }
      }
    }
    const overrides = "cls-telegraph=300000,wallstreetcn-quick=300000,jin10=300000,xueqiu-hotstock=300000,gelonghui=300000,fastbull-express=300000,zhihu=300000,ithome=600000,zaobao=1800000"
    const declaredRevision = "$" + "{NEWSNOW_DECLARED_REVISION:?set NEWSNOW_DECLARED_REVISION to a full git SHA}"

    expect(exampleEnv).toContain("ENABLE_CACHE=true")
    expect(exampleEnv).toContain("NEWSNOW_CACHE_TTL_MS=300000")
    expect(exampleEnv).toContain(`NEWSNOW_SOURCE_INTERVAL_OVERRIDES=${overrides}`)
    expect(exampleEnv).toContain("NEWSNOW_DECLARED_REVISION=")
    expect(exampleEnv).toContain("NEWSNOW_DECLARED_REVISION=$(git rev-parse HEAD) docker compose up -d --build")
    expect(compose.services.newsnow).toMatchObject({
      build: {
        context: ".",
        args: {
          NEWSNOW_DECLARED_REVISION: declaredRevision,
        },
      },
      image: ["jing-lun/newsnow-airank:", declaredRevision].join(""),
    })
    expect(compose.services.newsnow.environment).toEqual(expect.arrayContaining([
      "ENABLE_CACHE=true",
      "NEWSNOW_CACHE_TTL_MS=300000",
      `NEWSNOW_SOURCE_INTERVAL_OVERRIDES=${overrides}`,
      ["NEWSNOW_DECLARED_REVISION=", declaredRevision].join(""),
    ]))
    expect(compose.services.newsnow.volumes).toContain("newsnow_data:/usr/app/.data")
    expect(dockerfile).toContain("ARG NEWSNOW_DECLARED_REVISION")
    expect(dockerfile).not.toContain("NEWSNOW_BUILD_COMMIT")
    expect(dockerfile).toMatch(/ENV .*NEWSNOW_DECLARED_REVISION=\$\{NEWSNOW_DECLARED_REVISION\}/)
    expect(dockerfile).toContain("CMD [\"node\", \"output/server/index.mjs\"]")
    expect(dockerfile.match(/^FROM node:20\.19\.6-alpine(?: AS builder)?$/gm)).toHaveLength(2)
    expect(dockerfile).toContain("RUN corepack enable")
    expect(dockerfile).toContain("RUN pnpm install --frozen-lockfile")
    expect(packageJson.packageManager).toBe("pnpm@10.30.3")
    expect(productionWorkflow.jobs["verify-production"].steps).toEqual(expect.arrayContaining([
      {
        name: "Set up Node.js",
        uses: "actions/setup-node@v4",
        with: {
          "node-version": "20.19.6",
        },
      },
      {
        name: "Install dependencies",
        run: "pnpm install --frozen-lockfile",
      },
    ]))
    expect(readme).toContain("Requires Node.js >= 20.19.0")
  })
})
