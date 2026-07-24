import { describe, expect, it, vi } from "vitest"
import { verifyDeployAssets } from "../scripts/production-smoke-assets.mjs"

describe("production smoke assets", () => {
  it("validates every same-origin script and stylesheet response", async () => {
    const origin = "https://newsnow.test"
    const html = `
      <link rel="stylesheet" href="/assets/app.css">
      <link rel="stylesheet" href="https://cdn.example.test/external.css">
      <script src="/assets/app.js"></script>
      <script src="https://newsnow.test/assets/chunk.js?version=1"></script>
    `
    const assetUrls = [
      "https://newsnow.test/assets/app.css",
      "https://newsnow.test/assets/app.js",
      "https://newsnow.test/assets/chunk.js?version=1",
    ]
    const validResponse = (url: string) => new Response(
      url.endsWith(".css") ? "body {}" : "export {}",
      {
        headers: {
          "content-type": url.endsWith(".css")
            ? "text/css; charset=utf-8"
            : "text/javascript; charset=utf-8",
        },
        status: 200,
      },
    )
    const request = vi.fn(async (input: Parameters<typeof fetch>[0]) => validResponse(String(input)))

    await expect(verifyDeployAssets(origin, html, request)).resolves.toEqual([
      "/assets/app.css",
      "/assets/app.js",
      "/assets/chunk.js?version=1",
    ])
    expect(request.mock.calls.map(([url]) => url)).toEqual(assetUrls)

    await expect(verifyDeployAssets(origin, html, async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input)
      return (
        url.endsWith("/app.js")
          ? new Response("not found", { status: 404 })
          : validResponse(url)
      )
    })).rejects.toThrow("/assets/app.js returned 404, expected 200")

    await expect(verifyDeployAssets(origin, html, async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input)
      return (
        url.endsWith("/app.css")
          ? new Response("body {}", { headers: { "content-type": "text/html" }, status: 200 })
          : validResponse(url)
      )
    })).rejects.toThrow("/assets/app.css returned content-type text/html, expected text/css")

    await expect(verifyDeployAssets(origin, html, async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input)
      return (
        url.endsWith("/app.js")
          ? new Response("", { headers: { "content-type": "text/javascript" }, status: 200 })
          : validResponse(url)
      )
    })).rejects.toThrow("/assets/app.js returned an empty response")
  })
})
