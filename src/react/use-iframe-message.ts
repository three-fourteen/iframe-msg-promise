import { useCallback, useEffect, useRef, useState } from "react"
import { IframeMessageError, postMessagePromise } from "../lib/index.js"
import type { RefObject } from "react"

/** Anything you can point the hook at, including a ref you pass to `<iframe>`. */
export type IframeTarget =
  | Window
  | HTMLIFrameElement
  | RefObject<HTMLIFrameElement | null>
  | null

export type UseIframeMessageOptions = {
  /** The frame to talk to. A ref is read at send time, so it may be empty now. */
  target: IframeTarget
  /** Origin the frame is expected to be on. `"*"` opts out of the check. */
  targetOrigin: string
  /** Milliseconds before rejecting with `TIMEOUT`. `0` disables. */
  timeout?: number
  /** Window whose `message` events are observed. Defaults to `window`. */
  win?: Window
}

export type UseIframeMessageResult<TRes, TReq> = {
  /**
   * Send a request. Resolves with the answer and rejects with an
   * {@link IframeMessageError} — the rejection is also recorded in `error`, so
   * a fire-and-forget call still needs a `.catch()` to avoid an unhandled
   * rejection.
   */
  send: (params: TReq) => Promise<TRes>
  /** The most recent successful answer. */
  data: TRes | undefined
  /** The most recent failure, cleared when a new request starts. */
  error: IframeMessageError | undefined
  /** True while a request is in flight. */
  loading: boolean
  /** Abort anything in flight and clear `data`, `error` and `loading`. */
  reset: () => void
}

const resolveTarget = (target: IframeTarget): Window | HTMLIFrameElement | null => {
  if (!target) return null
  return "current" in target ? target.current : target
}

/**
 * Request/response messaging to another frame, with the request state React
 * components usually need around it.
 *
 * A request still in flight is aborted when a new one starts and when the
 * component unmounts, and a late answer from a superseded request is dropped —
 * so the state always reflects the newest `send`.
 *
 * @example
 * ```tsx
 * const iframeRef = useRef<HTMLIFrameElement>(null)
 * const { send, data, error, loading } = useIframeMessage<User, Query>({
 *   target: iframeRef,
 *   targetOrigin: "https://widget.example.com",
 * })
 *
 * return (
 *   <>
 *     <iframe ref={iframeRef} src="https://widget.example.com" />
 *     <button onClick={() => send({ id: 1 }).catch(() => {})} disabled={loading}>
 *       Load
 *     </button>
 *     {error && <p role="alert">{error.message}</p>}
 *   </>
 * )
 * ```
 */
export const useIframeMessage = <TRes = unknown, TReq = unknown>({
  target,
  targetOrigin,
  timeout,
  win,
}: UseIframeMessageOptions): UseIframeMessageResult<TRes, TReq> => {
  const [data, setData] = useState<TRes | undefined>(undefined)
  const [error, setError] = useState<IframeMessageError | undefined>(undefined)
  const [loading, setLoading] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  // Identifies the newest request, so a slow earlier one cannot overwrite it.
  const requestRef = useRef(0)
  const mountedRef = useRef(true)
  const targetRef = useRef(target)

  useEffect(() => {
    targetRef.current = target
  })

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  const send = useCallback(
    async (params: TReq): Promise<TRes> => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      const requestId = ++requestRef.current

      const isCurrent = () => mountedRef.current && requestRef.current === requestId

      setLoading(true)
      setError(undefined)

      try {
        const resolved = resolveTarget(targetRef.current)
        if (!resolved) {
          throw new IframeMessageError(
            "INVALID_TARGET",
            "No target frame. Is the iframe rendered and the ref attached?"
          )
        }

        const value = await postMessagePromise<TRes, TReq>({
          params,
          target: resolved,
          targetOrigin,
          timeout,
          win,
          signal: controller.signal,
        })
        if (isCurrent()) {
          setData(value)
          setLoading(false)
        }
        return value
      } catch (caught) {
        // Anything that is not an IframeMessageError is a programming error
        // (e.g. a missing targetOrigin); let it surface untouched.
        if (!(caught instanceof IframeMessageError)) throw caught
        // An aborted request was replaced or unmounted: leave the state to
        // whoever superseded it.
        if (isCurrent() && caught.code !== "ABORTED") {
          setError(caught)
          setLoading(false)
        }
        throw caught
      }
    },
    [targetOrigin, timeout, win]
  )

  const reset = useCallback(() => {
    abortRef.current?.abort()
    requestRef.current++
    setData(undefined)
    setError(undefined)
    setLoading(false)
  }, [])

  return { send, data, error, loading, reset }
}
