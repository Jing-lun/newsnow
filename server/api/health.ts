import process from "node:process"
import { defineEventHandler } from "h3"
import { Version, cacheTtlMs } from "@shared/consts"
import { runtimeSourceIntervals, runtimeSourceProfile, runtimeSources, sourceRegistryHash } from "#/runtime-sources"

function compareSourceIds(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0
}

export function declaredRevision(value = process.env.NEWSNOW_DECLARED_REVISION) {
  return value && /^[0-9a-f]{40}$/i.test(value) ? value.toLowerCase() : null
}

export function healthStatus() {
  return {
    status: "ok" as const,
    version: Version,
    declaredRevision: declaredRevision(),
    readinessEndpoint: "/api/ready" as const,
    cacheTtlMs: cacheTtlMs(),
    sourceRegistryHash: sourceRegistryHash(runtimeSources),
    configuredSourceIntervals: Object.fromEntries(
      [...runtimeSourceIntervals.entries()].sort(([left], [right]) => compareSourceIds(left, right)),
    ),
    ...(runtimeSourceProfile && {
      sourceProfile: {
        name: runtimeSourceProfile.name,
        count: runtimeSourceProfile.sourceIds.length,
        selectorHash: runtimeSourceProfile.selectorHash,
      },
    }),
  }
}

export default defineEventHandler(() => healthStatus())
