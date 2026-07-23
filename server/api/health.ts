import { createHash } from "node:crypto"
import process from "node:process"
import { defineEventHandler } from "h3"
import { type Environment, Version, cacheTtlMs, sourceIntervalOverrides } from "@shared/consts"
import { genSources } from "@shared/pre-sources"

function compareSourceIds(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0
}

export function healthStatus(env: Environment = process.env) {
  const sources = genSources(env)
  const sourceRegistry = Object.entries(sources)
    .map(([id, source]): [string, number] => [id, source.interval])
    .sort(([left], [right]) => compareSourceIds(left, right))
  const sourceRegistryHash = createHash("sha256")
    .update(JSON.stringify(sourceRegistry))
    .digest("hex")
  const sourceIntervals = sourceIntervalOverrides(env, Object.keys(sources))

  return {
    status: "ok" as const,
    version: Version,
    buildCommit: env.NEWSNOW_BUILD_COMMIT || "unknown",
    cacheTtlMs: cacheTtlMs(env),
    sourceRegistryHash,
    configuredSourceIntervals: Object.fromEntries(
      [...sourceIntervals.entries()].sort(([left], [right]) => compareSourceIds(left, right)),
    ),
  }
}

export default defineEventHandler(() => healthStatus())
