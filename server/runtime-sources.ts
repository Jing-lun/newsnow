import { createHash } from "node:crypto"
import process from "node:process"
import { type Environment, sourceIntervalOverrides } from "@shared/consts"
import { sources as generatedSources } from "@shared/sources"
import type { Source, SourceID } from "@shared/types"

export type RuntimeSources = Record<SourceID, Source>

const production30SourceIds = [
  "cls-telegraph",
  "wallstreetcn-quick",
  "jin10",
  "gelonghui",
  "fastbull-express",
  "mktnews-flash",
  "wallstreetcn-news",
  "wallstreetcn-hot",
  "cls-depth",
  "cls-hot",
  "fastbull-news",
  "zaobao",
  "thepaper",
  "cankaoxiaoxi",
  "sputniknewscn",
  "tencent-hot",
  "toutiao",
  "ithome",
  "36kr-quick",
  "36kr-renqi",
  "github-trending-today",
  "hackernews",
  "producthunt",
  "xueqiu-hotstock",
  "zhihu",
  "weibo",
  "baidu",
  "douyin",
  "bilibili-hot-search",
  "steam",
] as const satisfies readonly SourceID[]

const production30FiveMinuteSourceIds = new Set<SourceID>([
  "cls-telegraph",
  "wallstreetcn-quick",
  "jin10",
  "xueqiu-hotstock",
  "gelonghui",
  "fastbull-express",
  "mktnews-flash",
  "weibo",
])

const production30ThirtyMinuteSourceIds = new Set<SourceID>([
  "zaobao",
  "wallstreetcn-news",
  "wallstreetcn-hot",
  "fastbull-news",
  "thepaper",
  "cankaoxiaoxi",
  "tencent-hot",
])

export interface SourceProfile {
  name: "production-30"
  sourceIds: readonly SourceID[]
  selectorHash: string
  intervals: ReadonlyMap<SourceID, number>
}

function production30Interval(sourceId: SourceID) {
  if (production30FiveMinuteSourceIds.has(sourceId)) return 5 * 60 * 1000
  if (production30ThirtyMinuteSourceIds.has(sourceId)) return 30 * 60 * 1000
  return 10 * 60 * 1000
}

export function sourceProfile(
  env: Environment = process.env,
  sourceRegistry: RuntimeSources = generatedSources,
): SourceProfile | undefined {
  const profileName = env.NEWSNOW_SOURCE_PROFILE
  if (profileName === undefined || profileName === "") return
  if (profileName !== "production-30") throw new Error(`NEWSNOW_SOURCE_PROFILE contains unknown source profile: ${profileName}`)

  const sourceIds = production30SourceIds
  if (new Set(sourceIds).size !== sourceIds.length || new Set<string>(sourceIds).has("aihot")) {
    throw new Error("production-30 source selectors must be unique canonical leaves")
  }
  sourceIds.forEach((sourceId) => {
    if (!sourceRegistry[sourceId] || sourceRegistry[sourceId].redirect) {
      throw new Error(`production-30 source selector is not a canonical leaf: ${sourceId}`)
    }
  })

  return {
    name: "production-30",
    sourceIds,
    selectorHash: createHash("sha256").update(JSON.stringify(sourceIds)).digest("hex"),
    intervals: new Map(sourceIds.map(sourceId => [sourceId, production30Interval(sourceId)])),
  }
}

export function createRuntimeSources(
  env: Environment = process.env,
  sourceRegistry: RuntimeSources = generatedSources,
) {
  const overrides = sourceIntervalOverrides(env, Object.keys(sourceRegistry))
  const profile = sourceProfile(env, sourceRegistry)
  return Object.fromEntries(Object.entries(sourceRegistry).map(([sourceId, source]) => [
    sourceId,
    {
      ...source,
      interval: overrides.get(sourceId) ?? profile?.intervals.get(sourceId as SourceID) ?? source.interval,
    },
  ])) as RuntimeSources
}

export const runtimeSourceIntervals = sourceIntervalOverrides(process.env, Object.keys(generatedSources))
export const runtimeSourceProfile = sourceProfile(process.env)
export const runtimeSources = createRuntimeSources(process.env)

export function sourceRegistryHash(sourceRegistry: RuntimeSources = runtimeSources) {
  const canonicalRegistry = Object.entries(sourceRegistry)
    .map(([id, source]): [string, number] => [id, source.interval])
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)

  return createHash("sha256")
    .update(JSON.stringify(canonicalRegistry))
    .digest("hex")
}
