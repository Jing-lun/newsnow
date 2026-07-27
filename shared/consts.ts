/**
 * 缓存过期时间
 */
import packageJSON from "../package.json"

export type Environment = Record<string, string | undefined>

export const MinimumIntervalMs = 2 * 60 * 1000
export const DefaultCacheTtlMs = 5 * 60 * 1000

function runtimeEnvironment(): Environment {
  return (Reflect.get(globalThis, "process") as { env?: Environment } | undefined)?.env ?? {}
}

function parseIntervalMs(value: string, name: string) {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} must be an integer number of milliseconds`)
  }

  const interval = Number(value)
  if (!Number.isSafeInteger(interval) || interval < MinimumIntervalMs) {
    throw new Error(`${name} must be at least ${MinimumIntervalMs} milliseconds`)
  }

  return interval
}

export function cacheTtlMs(env: Environment = runtimeEnvironment()) {
  const value = env.NEWSNOW_CACHE_TTL_MS
  return value === undefined ? DefaultCacheTtlMs : parseIntervalMs(value, "NEWSNOW_CACHE_TTL_MS")
}

export function sourceIntervalOverrides(env: Environment = runtimeEnvironment(), sourceIds?: Iterable<string>) {
  const overrides = new Map<string, number>()
  const value = env.NEWSNOW_SOURCE_INTERVAL_OVERRIDES
  if (!value) return overrides

  value.split(",").forEach((entry) => {
    const [sourceId, interval, ...extra] = entry.split("=")
    if (!sourceId || !interval || extra.length) {
      throw new Error("NEWSNOW_SOURCE_INTERVAL_OVERRIDES must use source=milliseconds entries")
    }
    if (overrides.has(sourceId)) {
      throw new Error(`NEWSNOW_SOURCE_INTERVAL_OVERRIDES contains duplicate source: ${sourceId}`)
    }
    overrides.set(sourceId, parseIntervalMs(interval, `interval for ${sourceId}`))
  })

  if (sourceIds) {
    const knownSourceIds = new Set(sourceIds)
    overrides.forEach((_, sourceId) => {
      if (!knownSourceIds.has(sourceId)) {
        throw new Error(`NEWSNOW_SOURCE_INTERVAL_OVERRIDES contains unknown source: ${sourceId}`)
      }
    })
  }

  return overrides
}

export function sourceIntervalMs(
  sourceId: string,
  defaultInterval: number,
  env: Environment = runtimeEnvironment(),
  overrides = sourceIntervalOverrides(env),
) {
  return overrides.get(sourceId) ?? defaultInterval
}

export const TTL = cacheTtlMs()
/**
 * 默认刷新间隔, 10 min
 */
export const Interval = 10 * 60 * 1000

export const Homepage = packageJSON.homepage

export const Version = packageJSON.version
export const Author = packageJSON.author
