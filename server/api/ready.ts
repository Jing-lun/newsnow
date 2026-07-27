import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { H3Event } from "h3"
import { defineEventHandler, setResponseStatus } from "h3"

type RuntimeImportMeta = {
  url?: string
}

function packagedAppShellPath() {
  const runtimeImportMeta = Reflect.get(globalThis, "_importMeta_") as RuntimeImportMeta | undefined
  if (!runtimeImportMeta?.url) return ""
  return resolve(dirname(fileURLToPath(runtimeImportMeta.url)), "../public/index.html")
}

export async function readinessStatus(appShellPath = packagedAppShellPath()) {
  let appShell: string
  try {
    appShell = await readFile(appShellPath, "utf8")
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    return {
      status: "not_ready" as const,
      checks: {
        appShell: code === "ENOENT" || code === "ENOTDIR" ? "missing" as const : "invalid" as const,
      },
    }
  }

  const valid = appShell.includes("<title>NewsNow</title>") && appShell.includes("<div id=\"app\"></div>")
  return {
    status: valid ? "ready" as const : "not_ready" as const,
    checks: {
      appShell: valid ? "ok" as const : "invalid" as const,
    },
  }
}

export async function readinessResponse(event: H3Event, appShellPath?: string) {
  const status = await readinessStatus(appShellPath)
  if (status.status !== "ready") setResponseStatus(event, 503)
  return status
}

export default defineEventHandler(event => readinessResponse(event))
