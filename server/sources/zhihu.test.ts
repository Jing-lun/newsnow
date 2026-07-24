import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
  vi.doUnmock("#/utils/fetch")
  vi.resetModules()
})

describe("zhihu source", () => {
  it("uses the v3 hot-list endpoint and maps the standard item schema", async () => {
    const fetch = vi.fn(async () => ({
      data: [
        {
          type: "hot_list_feed",
          style_type: "1",
          feed_specific: { answer_count: 411 },
          target: {
            title_area: { text: "半导体产业链热度上升" },
            excerpt_area: { text: "行业讨论摘要" },
            image_area: { url: "https://example.test/image.jpg" },
            metrics_area: {
              text: "1234 万热度",
              font_color: "",
              background: "",
              weight: "",
            },
            label_area: {
              type: "trend",
              trend: 1,
              night_color: "",
              normal_color: "",
            },
            link: { url: "https://www.zhihu.com/question/123456789" },
          },
        },
      ],
    }))
    vi.doMock("#/utils/fetch", () => ({ myFetch: fetch }))

    const source = (await import("./zhihu")).default
    const items = await source.zhihu()

    expect(fetch).toHaveBeenCalledWith(
      "https://www.zhihu.com/api/v3/feed/topstory/hot-list-web?limit=20&desktop=true",
    )
    expect(items).toEqual([
      {
        id: "123456789",
        title: "半导体产业链热度上升",
        extra: {
          info: "1234 万热度",
          hover: "行业讨论摘要",
        },
        url: "https://www.zhihu.com/question/123456789",
      },
    ])
  })
})
