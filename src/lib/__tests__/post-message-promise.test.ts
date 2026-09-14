import { afterEach, describe, expect, it, vi } from "vitest"
import { IframeMessageError, postMessagePromise } from ".."
import { RESPONSE_ACTION } from "../protocol"

const ORIGIN = "https://widget.example.com"

/** A stand-in for an iframe's contentWindow that records what it was sent. */
const createFakeTarget = () => {
  const sent: Array<{ data: any; targetOrigin: string }> = []
  const target = {
    postMessage: (data: any, targetOrigin: string) => {
      sent.push({ data, targetOrigin })
    },
  } as unknown as Window
  return { target, sent }
}

/** Deliver a response as if it came from `source` on `origin`. */
const deliver = (data: unknown, source: Window, origin = ORIGIN) => {
  window.dispatchEvent(new MessageEvent("message", { data, origin, source }))
}

const respondTo = (id: string, value: unknown) => ({
  action: RESPONSE_ACTION,
  id,
  ok: true,
  value,
})

afterEach(() => {
  vi.useRealTimers()
})

describe("postMessagePromise", () => {
  it("sends the caller's targetOrigin instead of defaulting to same-origin", async () => {
    const { target, sent } = createFakeTarget()
    const promise = postMessagePromise({ params: { a: 1 }, target, targetOrigin: ORIGIN })

    expect(sent).toHaveLength(1)
    expect(sent[0].targetOrigin).toBe(ORIGIN)
    expect(sent[0].data).toMatchObject({ action: "iframeMsgPromise", params: { a: 1 } })

    deliver(respondTo(sent[0].data.id, "ok"), target)
    await expect(promise).resolves.toBe("ok")
  })

  it("resolves with the value the peer returned", async () => {
    const { target, sent } = createFakeTarget()
    const promise = postMessagePromise<{ id: number }>({
      params: null,
      target,
      targetOrigin: ORIGIN,
    })
    deliver(respondTo(sent[0].data.id, { id: 7 }), target)
    await expect(promise).resolves.toEqual({ id: 7 })
  })

  it("ignores a response from a different origin", async () => {
    vi.useFakeTimers()
    const { target, sent } = createFakeTarget()
    const promise = postMessagePromise({
      params: null,
      target,
      targetOrigin: ORIGIN,
      timeout: 1000,
    })

    deliver(respondTo(sent[0].data.id, "spoofed"), target, "https://evil.example.com")
    vi.advanceTimersByTime(1000)

    await expect(promise).rejects.toMatchObject({ code: "TIMEOUT" })
  })

  it("ignores a response from a different window on the right origin", async () => {
    vi.useFakeTimers()
    const { target, sent } = createFakeTarget()
    const other = createFakeTarget().target
    const promise = postMessagePromise({
      params: null,
      target,
      targetOrigin: ORIGIN,
      timeout: 1000,
    })

    deliver(respondTo(sent[0].data.id, "spoofed"), other)
    vi.advanceTimersByTime(1000)

    await expect(promise).rejects.toMatchObject({ code: "TIMEOUT" })
  })

  it("uses an unguessable id for every request", () => {
    const { target, sent } = createFakeTarget()
    const ids = new Set<string>()
    for (let i = 0; i < 50; i++) {
      postMessagePromise({ params: null, target, targetOrigin: ORIGIN, timeout: 0 })
      ids.add(sent[i].data.id)
    }
    expect(ids.size).toBe(50)
    // Never the predictable 1, 2, 3… of the previous implementation.
    expect([...ids].some((id) => /^\d{1,3}$/.test(id))).toBe(false)
  })

  it("rejects with TIMEOUT and removes its listener", async () => {
    vi.useFakeTimers()
    const removeSpy = vi.spyOn(window, "removeEventListener")
    const { target } = createFakeTarget()
    const promise = postMessagePromise({
      params: null,
      target,
      targetOrigin: ORIGIN,
      timeout: 5000,
    })

    vi.advanceTimersByTime(5000)

    await expect(promise).rejects.toBeInstanceOf(IframeMessageError)
    await expect(promise).rejects.toMatchObject({ code: "TIMEOUT" })
    expect(removeSpy).toHaveBeenCalledWith("message", expect.any(Function))
    removeSpy.mockRestore()
  })

  it("rejects with ABORTED when the signal fires", async () => {
    const controller = new AbortController()
    const { target } = createFakeTarget()
    const promise = postMessagePromise({
      params: null,
      target,
      targetOrigin: ORIGIN,
      signal: controller.signal,
    })

    controller.abort()
    await expect(promise).rejects.toMatchObject({ code: "ABORTED" })
  })

  it("rejects with HANDLER_ERROR when the peer's handler threw", async () => {
    const { target, sent } = createFakeTarget()
    const promise = postMessagePromise({ params: null, target, targetOrigin: ORIGIN })

    deliver(
      {
        action: RESPONSE_ACTION,
        id: sent[0].data.id,
        ok: false,
        error: { name: "TypeError", message: "boom" },
      },
      target
    )

    await expect(promise).rejects.toMatchObject({
      code: "HANDLER_ERROR",
      remote: { name: "TypeError", message: "boom" },
    })
  })

  it("rejects with INVALID_TARGET for an iframe that is not loaded", async () => {
    const iframe = document.createElement("iframe") // not in the document
    await expect(
      postMessagePromise({ params: null, target: iframe, targetOrigin: ORIGIN })
    ).rejects.toMatchObject({ code: "INVALID_TARGET" })
  })

  it("rejects with CLONE_ERROR when the payload cannot be cloned", async () => {
    const target = {
      postMessage: () => {
        throw new DOMException("could not be cloned", "DataCloneError")
      },
    } as unknown as Window

    await expect(
      postMessagePromise({ params: () => {}, target, targetOrigin: ORIGIN })
    ).rejects.toMatchObject({ code: "CLONE_ERROR" })
  })

  it("requires a targetOrigin", async () => {
    const { target } = createFakeTarget()
    await expect(
      postMessagePromise({ params: null, target, targetOrigin: "" })
    ).rejects.toBeInstanceOf(TypeError)
  })

  it("accepts an iframe element directly", async () => {
    const iframe = document.createElement("iframe")
    document.body.appendChild(iframe)
    const sent: any[] = []
    Object.defineProperty(iframe.contentWindow, "postMessage", {
      value: (data: any) => sent.push(data),
    })

    postMessagePromise({ params: { hi: true }, target: iframe, targetOrigin: "*", timeout: 0 })
    expect(sent[0]).toMatchObject({ params: { hi: true } })
    iframe.remove()
  })
})
