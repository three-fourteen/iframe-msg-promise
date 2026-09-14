import { act, render, screen } from "@testing-library/react"
import { useRef } from "react"
import { describe, expect, it, vi } from "vitest"
import { useIframeMessage } from "../index.js"
import { IframeMessageError } from "../../lib/index.js"
import { RESPONSE_ACTION } from "../../lib/protocol.js"

const ORIGIN = "https://widget.example.com"

/** A stand-in for an iframe's contentWindow that records what it was sent. */
const createFakeTarget = () => {
  const sent: any[] = []
  const target = {
    postMessage: (data: any) => sent.push(data),
  } as unknown as Window
  return { target, sent }
}

const respond = (id: string, value: unknown, source: Window) =>
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { action: RESPONSE_ACTION, id, ok: true, value },
        origin: ORIGIN,
        source,
      })
    )
  })

const respondWithError = (id: string, message: string, source: Window) =>
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          action: RESPONSE_ACTION,
          id,
          ok: false,
          error: { name: "Error", message },
        },
        origin: ORIGIN,
        source,
      })
    )
  })

/**
 * Attach a no-op catch immediately: these promises reject before the matching
 * assertion runs, which would otherwise surface as an unhandled rejection.
 */
const track = <T,>(promise: Promise<T>): Promise<T> => {
  promise.catch(() => {})
  return promise
}

/** Renders the hook's state and exposes `send` to the test. */
const setup = (target: Window | null, timeout?: number) => {
  const api: { send?: (p: any) => Promise<any>; reset?: () => void } = {}

  const Component = () => {
    const { send, reset, data, error, loading } = useIframeMessage<string, any>({
      target,
      targetOrigin: ORIGIN,
      timeout,
    })
    api.send = send
    api.reset = reset
    return (
      <div>
        <span data-testid="data">{String(data)}</span>
        <span data-testid="error">{error ? error.code : "none"}</span>
        <span data-testid="loading">{String(loading)}</span>
      </div>
    )
  }

  const utils = render(<Component />)
  const read = (id: string) => screen.getByTestId(id).textContent
  return { ...utils, api, read }
}

describe("useIframeMessage", () => {
  it("tracks loading and exposes the answer", async () => {
    const { target, sent } = createFakeTarget()
    const { api, read } = setup(target)

    expect(read("loading")).toBe("false")

    let pending!: Promise<string>
    act(() => {
      pending = api.send!({ q: 1 })
    })
    expect(read("loading")).toBe("true")

    await respond(sent[0].id, "hello", target)
    await act(async () => {
      await expect(pending).resolves.toBe("hello")
    })

    expect(read("data")).toBe("hello")
    expect(read("loading")).toBe("false")
    expect(read("error")).toBe("none")
  })

  it("records a handler failure and rejects the returned promise", async () => {
    const { target, sent } = createFakeTarget()
    const { api, read } = setup(target)

    let pending!: Promise<string>
    act(() => {
      pending = track(api.send!(null))
    })
    await respondWithError(sent[0].id, "boom", target)

    await act(async () => {
      await expect(pending).rejects.toBeInstanceOf(IframeMessageError)
    })
    expect(read("error")).toBe("HANDLER_ERROR")
    expect(read("loading")).toBe("false")
  })

  it("ignores a late answer from a superseded request", async () => {
    const { target, sent } = createFakeTarget()
    const { api, read } = setup(target)

    let first!: Promise<string>
    let second!: Promise<string>
    act(() => {
      first = track(api.send!({ n: 1 }))
    })
    act(() => {
      second = api.send!({ n: 2 })
    })

    // The first request is aborted by the second; its promise rejects.
    await act(async () => {
      await expect(first).rejects.toMatchObject({ code: "ABORTED" })
    })

    // A late answer to the first must not land in state.
    await respond(sent[0].id, "stale", target)
    expect(read("data")).toBe("undefined")

    await respond(sent[1].id, "fresh", target)
    await act(async () => {
      await expect(second).resolves.toBe("fresh")
    })
    expect(read("data")).toBe("fresh")
  })

  it("an aborted request leaves no error in state", async () => {
    const { target } = createFakeTarget()
    const { api, read } = setup(target)

    let first!: Promise<string>
    act(() => {
      first = track(api.send!(null))
    })
    act(() => {
      void track(api.send!(null))
    })

    await act(async () => {
      await expect(first).rejects.toMatchObject({ code: "ABORTED" })
    })
    expect(read("error")).toBe("none")
    expect(read("loading")).toBe("true")
  })

  it("aborts an in-flight request on unmount without a state update", async () => {
    const { target, sent } = createFakeTarget()
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const { api, unmount } = setup(target)

    let pending!: Promise<string>
    act(() => {
      pending = track(api.send!(null))
    })
    unmount()

    await act(async () => {
      await expect(pending).rejects.toMatchObject({ code: "ABORTED" })
    })

    // A late answer after unmount must not try to set state.
    await respond(sent[0].id, "late", target)
    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it("rejects with INVALID_TARGET when the ref is still empty", async () => {
    const { api, read } = setup(null)

    let pending!: Promise<string>
    act(() => {
      pending = track(api.send!(null))
    })
    await act(async () => {
      await expect(pending).rejects.toMatchObject({ code: "INVALID_TARGET" })
    })
    expect(read("error")).toBe("INVALID_TARGET")
  })

  it("times out", async () => {
    vi.useFakeTimers()
    const { target } = createFakeTarget()
    const { api, read } = setup(target, 1000)

    let pending!: Promise<string>
    act(() => {
      pending = track(api.send!(null))
    })
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })

    await act(async () => {
      await expect(pending).rejects.toMatchObject({ code: "TIMEOUT" })
    })
    expect(read("error")).toBe("TIMEOUT")
    vi.useRealTimers()
  })

  it("reset clears the state", async () => {
    const { target, sent } = createFakeTarget()
    const { api, read } = setup(target)

    let pending!: Promise<string>
    act(() => {
      pending = api.send!(null)
    })
    await respond(sent[0].id, "value", target)
    await act(async () => {
      await pending
    })
    expect(read("data")).toBe("value")

    act(() => api.reset!())
    expect(read("data")).toBe("undefined")
    expect(read("error")).toBe("none")
    expect(read("loading")).toBe("false")
  })

  it("accepts a ref that is filled in after the first render", async () => {
    const { target, sent } = createFakeTarget()
    const api: { send?: (p: any) => Promise<any> } = {}

    const Component = () => {
      const ref = useRef<HTMLIFrameElement | null>(null)
      // Stand in for the element React attaches after the first render.
      if (!ref.current) ref.current = target as unknown as HTMLIFrameElement
      const { send } = useIframeMessage<string, any>({ target: ref, targetOrigin: ORIGIN })
      api.send = send
      return null
    }
    render(<Component />)

    let pending!: Promise<string>
    act(() => {
      pending = api.send!(null)
    })
    await respond(sent[0].id, "via ref", target)
    await act(async () => {
      await expect(pending).resolves.toBe("via ref")
    })
  })
})
