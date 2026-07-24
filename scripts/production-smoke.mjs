import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { access, unlink, writeFile } from "node:fs/promises"
import { createServer } from "node:net"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { verifyDeployAssets } from "./production-smoke-assets.mjs"

const projectDirectory = dirname(dirname(fileURLToPath(import.meta.url)))
const envFile = join(projectDirectory, ".env.server")
const startupTimeoutMs = 30_000
let createdEnvFile = false
let server
let serverOutput = ""

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

async function availablePort() {
  const listener = createServer()
  await new Promise((resolve, reject) => {
    listener.once("error", reject)
    listener.listen(0, "127.0.0.1", resolve)
  })
  const address = listener.address()
  assert(address && typeof address === "object")
  await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()))
  return address.port
}

async function ensureEnvFile() {
  try {
    await access(envFile)
  } catch {
    await writeFile(envFile, "")
    createdEnvFile = true
  }
}

function startPackagedApp(port) {
  const packageManager = process.env.npm_execpath
  const command = packageManager ? process.execPath : "pnpm"
  const args = packageManager ? [packageManager, "run", "start"] : ["run", "start"]
  const child = spawn(command, args, {
    cwd: projectDirectory,
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      NODE_ENV: "production",
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  })

  child.stdout.on("data", (chunk) => {
    serverOutput += chunk
  })
  child.stderr.on("data", (chunk) => {
    serverOutput += chunk
  })
  return child
}

async function waitForLiveness(origin) {
  const deadline = Date.now() + startupTimeoutMs
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`packaged app exited before becoming live\n${serverOutput}`)
    }
    try {
      const response = await fetch(`${origin}/api/health`)
      if (response.status === 200) return
    } catch {
      // The listener is not accepting requests yet.
    }
    await delay(100)
  }
  throw new Error(`packaged app did not become live within ${startupTimeoutMs}ms\n${serverOutput}`)
}

async function responseBody(origin, pathname, expectedStatus) {
  let response
  let body
  try {
    response = await fetch(`${origin}${pathname}`)
    body = await response.text()
  } catch (error) {
    throw new Error(`${pathname} request failed\n${serverOutput}`, { cause: error })
  }
  assert.equal(
    response.status,
    expectedStatus,
    `${pathname} returned ${response.status}, expected ${expectedStatus}\n${body}\n${serverOutput}`,
  )
  return { body, headers: response.headers }
}

async function stopServer() {
  if (!server || server.exitCode !== null) return
  const exit = new Promise(resolve => server.once("exit", resolve))
  if (process.platform === "win32") server.kill("SIGTERM")
  else process.kill(-server.pid, "SIGTERM")
  if (await Promise.race([exit.then(() => true), delay(2_000).then(() => false)])) return
  if (process.platform === "win32") server.kill("SIGKILL")
  else process.kill(-server.pid, "SIGKILL")
  await exit
}

try {
  process.chdir(projectDirectory)
  await ensureEnvFile()
  const port = await availablePort()
  const origin = `http://127.0.0.1:${port}`
  server = startPackagedApp(port)
  await waitForLiveness(origin)

  const root = await responseBody(origin, "/", 200)
  assert.match(root.headers.get("content-type") || "", /^text\/html\b/)
  assert.match(root.body, /<title>NewsNow<\/title>/)
  assert.match(root.body, /<div id="app"><\/div>/)
  const deployAssets = await verifyDeployAssets(origin, root.body)

  const health = await responseBody(origin, "/api/health", 200)
  assert.equal(JSON.parse(health.body).status, "ok")

  const readiness = await responseBody(origin, "/api/ready", 200)
  assert.equal(JSON.parse(readiness.body).status, "ready")

  const staticAsset = await responseBody(origin, "/robots.txt", 200)
  assert.match(staticAsset.body, /User-agent: \*/)
  assert.match(staticAsset.body, /Allow: \//)

  console.log(`Production smoke passed: /, ${deployAssets.length} deploy assets, /api/health, /api/ready, and /robots.txt`)
} finally {
  await stopServer()
  if (createdEnvFile) await unlink(envFile)
}
