import assert from "node:assert/strict"
import { load } from "cheerio"

const contentTypes = {
  script: {
    description: "JavaScript",
    pattern: /^(?:application|text)\/(?:x-)?(?:java|ecma)script\b/i,
  },
  stylesheet: {
    description: "text/css",
    pattern: /^text\/css\b/i,
  },
}

function referencedDeployAssets(origin, html) {
  const $ = load(html)
  const baseUrl = new URL("/", origin)
  const assets = []

  $("script[src], link[href]").each((_, element) => {
    const tagName = element.tagName.toLowerCase()
    const isScript = tagName === "script"
    const isStylesheet = tagName === "link"
      && ($(element).attr("rel") || "").toLowerCase().split(/\s+/).includes("stylesheet")
    if (!isScript && !isStylesheet) return

    const reference = $(element).attr(isScript ? "src" : "href")
    if (!reference) return
    const url = new URL(reference, baseUrl)
    if (url.origin !== baseUrl.origin) return
    url.hash = ""
    assets.push({
      kind: isScript ? "script" : "stylesheet",
      pathname: `${url.pathname}${url.search}`,
      url: url.href,
    })
  })

  assert(assets.some(asset => asset.kind === "script"), "root HTML did not reference a same-origin script")
  assert(assets.some(asset => asset.kind === "stylesheet"), "root HTML did not reference a same-origin stylesheet")
  return assets
}

export async function verifyDeployAssets(origin, html, request = fetch) {
  const assets = referencedDeployAssets(origin, html)

  for (const asset of assets) {
    let response
    try {
      response = await request(asset.url)
    } catch (error) {
      throw new Error(`${asset.pathname} request failed`, { cause: error })
    }

    assert.equal(
      response.status,
      200,
      `${asset.pathname} returned ${response.status}, expected 200`,
    )
    const contentType = response.headers.get("content-type") || ""
    const expected = contentTypes[asset.kind]
    assert(
      expected.pattern.test(contentType),
      `${asset.pathname} returned content-type ${contentType || "<missing>"}, expected ${expected.description}`,
    )
    const body = await response.arrayBuffer()
    assert(body.byteLength > 0, `${asset.pathname} returned an empty response`)
  }

  return assets.map(asset => asset.pathname)
}
