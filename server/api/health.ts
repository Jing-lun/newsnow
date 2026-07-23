import process from "node:process"
import { defineEventHandler } from "h3"
import { Version, cacheTtlMs } from "@shared/consts"
import { runtimeSourceIntervals, runtimeSources, sourceRegistryHash } from "#/runtime-sources"

function compareSourceIds(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0
}

export function healthStatus() {
  return {
    status: "ok" as const,
    version: Version,
    buildCommit: process.env.NEWSNOW_BUILD_COMMIT || "unknown",
    cacheTtlMs: cacheTtlMs(),
    sourceRegistryHash: sourceRegistryHash(runtimeSources),
    configuredSourceIntervals: Object.fromEntries(
      [...runtimeSourceIntervals.entries()].sort(([left], [right]) => compareSourceIds(left, right)),
    ),
  }
}

export default defineEventHandler(() => healthStatus())
