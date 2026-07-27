import { createHash } from "node:crypto"
import process from "node:process"
import { type Environment, sourceIntervalOverrides } from "@shared/consts"
import { sources as generatedSources } from "@shared/sources"
import type { Source, SourceID } from "@shared/types"

export type RuntimeSources = Record<SourceID, Source>

export function createRuntimeSources(
  env: Environment = process.env,
  sourceRegistry: RuntimeSources = generatedSources,
) {
  const overrides = sourceIntervalOverrides(env, Object.keys(sourceRegistry))
  return Object.fromEntries(Object.entries(sourceRegistry).map(([sourceId, source]) => [
    sourceId,
    {
      ...source,
      interval: overrides.get(sourceId) ?? source.interval,
    },
  ])) as RuntimeSources
}

export const runtimeSourceIntervals = sourceIntervalOverrides(process.env, Object.keys(generatedSources))
export const runtimeSources = createRuntimeSources(process.env)

export function sourceRegistryHash(sourceRegistry: RuntimeSources = runtimeSources) {
  const canonicalRegistry = Object.entries(sourceRegistry)
    .map(([id, source]): [string, number] => [id, source.interval])
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)

  return createHash("sha256")
    .update(JSON.stringify(canonicalRegistry))
    .digest("hex")
}
