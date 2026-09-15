import { afterEach, describe, expect, it, vi } from "vitest"
import { startListening } from "../index.js"
import { REQUEST_ACTION } from "../protocol.js"

const APP_ORIGIN = "https://app.example.com"

/** A stand-in for the requesting frame, recording what it is answered with. */
const createFakeSource = () => {
  const replies: Array<{ data: any; targetOrigin: string }> = []
  const source = {
    postMessage: (data: any, targetOrigin: string) => {
      replies.push({ data, targetOrigin })
    },
  } as unknown as Window
  return { source, replies }
}

const request = (params: unknown, source: Window, origin = APP_ORIGIN, id = "req-1") =>
  window.dispatchEvent(
    new MessageEvent("message", {
      data: { action: REQUEST_ACTION, id, params },
      origin,
      source,
    })
  )

/** Let the handler's promise chain settle. */
const flush = () => new Promise((r) => setTimeout(r, 0))

const unsubscribers: Array<() => void> = []
const listen = (options: Parameters<typeof startListening>[0]) => {
  const off = startListening(options)
  unsubscribers.push(off)
  return off
}

afterEach(() => {
  while (unsubscribers.length) unsubscribers.pop()!()
})

describe("startListening", () => {
  it("answers an allowed origin with the handler's value", async () => {
    const { source, replies } = createFakeSource()
    listen({ allowedOrigins: [APP_ORIGIN], handler: async (p: any) => p.n * 2 })

    request({ n: 21 }, source)
    await flush()

    expect(replies).toHaveLength(1)
    expect(replies[0].data).toMatchObject({ id: "req-1", ok: true, value: 42 })
    // The answer goes back to the caller's origin, never a wildcard.
    expect(replies[0].targetOrigin).toBe(APP_ORIGIN)
  })

  it("supports a synchronous handler", async () => {
    const { source, replies } = createFakeSource()
    listen({ allowedOrigins: [APP_ORIGIN], handler: () => "sync" })

    request(null, source)
    await flush()

    expect(replies[0].data).toMatchObject({ ok: true, value: "sync" })
  })

  it("ignores a request from an origin that is not allow-listed", async () => {
    const { source, replies } = createFakeSource()
    const onError = vi.fn()
    listen({ allowedOrigins: [APP_ORIGIN], handler: () => "secret", onError })

    request(null, source, "https://evil.example.com")
    await flush()

    expect(replies).toHaveLength(0)
    expect(onError).not.toHaveBeenCalled()
  })

  it('accepts every origin with "*"', async () => {
    const { source, replies } = createFakeSource()
    listen({ allowedOrigins: "*", handler: () => "public" })

    request(null, source, "https://anywhere.example.com")
    await flush()

    expect(replies[0].data).toMatchObject({ ok: true, value: "public" })
  })

  it("reports a rejected handler instead of leaving the caller hanging", async () => {
    const { source, replies } = createFakeSource()
    const onError = vi.fn()
    listen({
      allowedOrigins: [APP_ORIGIN],
      handler: async () => {
        throw new TypeError("nope")
      },
      onError,
    })

    request(null, source)
    await flush()

    expect(replies[0].data).toMatchObject({
      ok: false,
      error: { name: "TypeError", message: "nope" },
    })
    expect(onError).toHaveBeenCalledOnce()
  })

  it("reports a handler that throws synchronously", async () => {
    const { source, replies } = createFakeSource()
    listen({
      allowedOrigins: [APP_ORIGIN],
      handler: () => {
        throw new Error("sync boom")
      },
    })

    request(null, source)
    await flush()

    expect(replies[0].data).toMatchObject({ ok: false, error: { message: "sync boom" } })
  })

  it("stops answering once unsubscribed", async () => {
    const { source, replies } = createFakeSource()
    const off = listen({ allowedOrigins: [APP_ORIGIN], handler: () => "v" })

    off()
    request(null, source)
    await flush()

    expect(replies).toHaveLength(0)
  })

  it("does not double-answer when the effect runs twice (StrictMode)", async () => {
    const { source, replies } = createFakeSource()
    const handler = () => "v"

    // What React 18 StrictMode does: mount, unmount, mount again.
    const off1 = startListening({ allowedOrigins: [APP_ORIGIN], handler })
    off1()
    const off2 = listen({ allowedOrigins: [APP_ORIGIN], handler })

    request(null, source)
    await flush()

    expect(replies).toHaveLength(1)
    off2()
  })

  it("ignores unrelated messages on the same window", async () => {
    const { source, replies } = createFakeSource()
    const handler = vi.fn(() => "v")
    listen({ allowedOrigins: [APP_ORIGIN], handler })

    window.dispatchEvent(
      new MessageEvent("message", { data: "webpack-hmr", origin: APP_ORIGIN, source })
    )
    window.dispatchEvent(
      new MessageEvent("message", { data: { action: "other" }, origin: APP_ORIGIN, source })
    )
    await flush()

    expect(handler).not.toHaveBeenCalled()
    expect(replies).toHaveLength(0)
  })

  it("requires an explicit allowedOrigins", () => {
    expect(() =>
      // @ts-expect-error deliberately omitting the required option
      startListening({ handler: () => null })
    ).toThrow(TypeError)
    expect(() => startListening({ allowedOrigins: [], handler: () => null })).toThrow(
      TypeError
    )
  })

  it("hands the handler the caller's origin", async () => {
    const { source } = createFakeSource()
    const handler = vi.fn(() => "v")
    listen({ allowedOrigins: [APP_ORIGIN], handler })

    request({ n: 1 }, source)
    await flush()

    expect(handler).toHaveBeenCalledWith({ n: 1 }, { origin: APP_ORIGIN, source })
  })
})
