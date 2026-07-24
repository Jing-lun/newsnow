import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import type { H3Event } from "h3"
import { readinessResponse, readinessStatus } from "../server/api/ready"

const temporaryDirectories: string[] = []

async function temporaryAppShellPath() {
  const directory = await mkdtemp(join(tmpdir(), "newsnow-readiness-"))
  temporaryDirectories.push(directory)
  return join(directory, "public", "index.html")
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { force: true, recursive: true })))
})

describe("readiness endpoint", () => {
  it("is not ready when the packaged app shell is missing", async () => {
    const appShellPath = await temporaryAppShellPath()

    await expect(readinessStatus(appShellPath)).resolves.toEqual({
      status: "not_ready",
      checks: {
        appShell: "missing",
      },
    })
  })

  it("returns HTTP 503 when the packaged app shell is missing", async () => {
    const appShellPath = await temporaryAppShellPath()
    const event = {
      node: {
        res: {
          statusCode: 200,
        },
      },
    } as H3Event

    await expect(readinessResponse(event, appShellPath)).resolves.toMatchObject({
      status: "not_ready",
    })
    expect(event.node.res.statusCode).toBe(503)
  })

  it("is not ready when the packaged app shell is the wrong artifact", async () => {
    const appShellPath = await temporaryAppShellPath()
    await mkdir(join(appShellPath, ".."), { recursive: true })
    await writeFile(appShellPath, "<html><body>not the NewsNow app</body></html>")

    await expect(readinessStatus(appShellPath)).resolves.toEqual({
      status: "not_ready",
      checks: {
        appShell: "invalid",
      },
    })
  })

  it("is ready when the packaged NewsNow app shell is present", async () => {
    const appShellPath = await temporaryAppShellPath()
    await mkdir(join(appShellPath, ".."), { recursive: true })
    await writeFile(appShellPath, "<html><title>NewsNow</title><body><div id=\"app\"></div></body></html>")

    await expect(readinessStatus(appShellPath)).resolves.toEqual({
      status: "ready",
      checks: {
        appShell: "ok",
      },
    })
  })
})
