import { act, render } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { useIframeListener } from "../index.js"
import { REQUEST_ACTION } from "../../lib/protocol.js"

const APP_ORIGIN = "https://app.example.com"

const createFakeSource = () => {
  const replies: any[] = []
  const source = {
    postMessage: (data: any) => replies.push(data),
  } as unknown as Window
  return { source, replies }
}

const request = (params: unknown, source: Window, origin = APP_ORIGIN, id = "r1") =>
  window.dispatchEvent(
    new MessageEvent("message", {
      data: { action: REQUEST_ACTION, id, params },
      origin,
      source,
    })
  )

const flush = () => act(() => new Promise<void>((r) => setTimeout(r, 0)))

describe("useIframeListener", () => {
  it("answers requests while mounted and stops after unmount", async () => {
    const { source, replies } = createFakeSource()
    const Component = () => {
      useIframeListener({ allowedOrigins: [APP_ORIGIN], handler: () => "answer" })
      return null
    }

    const { unmount } = render(<Component />)
    request(null, source)
    await flush()
    expect(replies).toHaveLength(1)
    expect(replies[0]).toMatchObject({ ok: true, value: "answer" })

    unmount()
    request(null, source, APP_ORIGIN, "r2")
    await flush()
    expect(replies).toHaveLength(1)
  })

  it("answers exactly once when the handler is a new closure every render", async () => {
    const { source, replies } = createFakeSource()
    let rerender: () => void = () => {}

    const Component = () => {
      const [n, setN] = useState(0)
      rerender = () => setN((v) => v + 1)
      // A brand-new function identity on every render, deliberately unmemoised.
      useIframeListener({ allowedOrigins: [APP_ORIGIN], handler: () => `v${n}` })
      return null
    }

    render(<Component />)
    act(() => rerender())
    act(() => rerender())

    request(null, source)
    await flush()

    // One listener, not three.
    expect(replies).toHaveLength(1)
    // …and it sees the latest render's closure.
    expect(replies[0]).toMatchObject({ value: "v2" })
  })

  it("does not resubscribe when allowedOrigins is a new array with the same values", async () => {
    const { source, replies } = createFakeSource()
    const addSpy = vi.spyOn(window, "addEventListener")
    let rerender: () => void = () => {}

    const Component = () => {
      const [n, setN] = useState(0)
      rerender = () => setN((v) => v + 1)
      useIframeListener({ allowedOrigins: [APP_ORIGIN], handler: () => n })
      return null
    }

    render(<Component />)
    const afterMount = addSpy.mock.calls.filter(([e]) => e === "message").length
    act(() => rerender())
    expect(
      addSpy.mock.calls.filter(([e]) => e === "message").length
    ).toBe(afterMount)

    request(null, source)
    await flush()
    expect(replies).toHaveLength(1)
    addSpy.mockRestore()
  })

  it("stops answering when disabled", async () => {
    const { source, replies } = createFakeSource()
    const Component = ({ enabled }: { enabled: boolean }) => {
      useIframeListener({ allowedOrigins: [APP_ORIGIN], handler: () => "v", enabled })
      return null
    }

    const { rerender } = render(<Component enabled />)
    rerender(<Component enabled={false} />)

    request(null, source)
    await flush()
    expect(replies).toHaveLength(0)
  })

  it("ignores an origin that is not allow-listed", async () => {
    const { source, replies } = createFakeSource()
    const Component = () => {
      useIframeListener({ allowedOrigins: [APP_ORIGIN], handler: () => "secret" })
      return null
    }

    render(<Component />)
    request(null, source, "https://evil.example.com")
    await flush()
    expect(replies).toHaveLength(0)
  })
})
