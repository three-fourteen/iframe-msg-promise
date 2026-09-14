import { useEffect, useRef } from "react"
import { startListening } from "../lib/index.js"
import type { MessageContext, MessageHandler } from "../lib/index.js"

export type UseIframeListenerOptions<TReq = unknown, TRes = unknown> = {
  /** Called for every allowed request; its result is sent back to the caller. */
  handler: MessageHandler<TReq, TRes>
  /** Origins allowed to call this handler, or `"*"` to accept every origin. */
  allowedOrigins: string[] | "*"
  /** Window to listen on. Defaults to `window`. */
  win?: Window
  /** Notified about rejected handlers and messages we could not answer. */
  onError?: (error: unknown, context: MessageContext) => void
  /** Set to `false` to stop listening without unmounting. Defaults to `true`. */
  enabled?: boolean
}

/**
 * Answer requests from another frame for as long as the component is mounted.
 *
 * `handler` and `onError` are read through a ref, so they do not need to be
 * memoised — changing them never re-subscribes, and the listener always sees
 * the latest render's closure.
 *
 * @example
 * ```tsx
 * useIframeListener({
 *   allowedOrigins: ["https://app.example.com"],
 *   handler: (params) => lookUp(params, latestStateFromThisRender),
 * })
 * ```
 */
export const useIframeListener = <TReq = unknown, TRes = unknown>({
  handler,
  allowedOrigins,
  win,
  onError,
  enabled = true,
}: UseIframeListenerOptions<TReq, TRes>): void => {
  const handlerRef = useRef(handler)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    handlerRef.current = handler
    onErrorRef.current = onError
  })

  // An inline array literal is a new object on every render, so compare the
  // origins by value instead of by identity.
  const originsKey =
    allowedOrigins === "*" ? "*" : [...allowedOrigins].sort().join(",")

  useEffect(() => {
    if (!enabled) return

    return startListening<TReq, TRes>({
      win,
      allowedOrigins: originsKey === "*" ? "*" : originsKey.split(","),
      handler: (params, context) => handlerRef.current(params, context),
      onError: (error, context) => onErrorRef.current?.(error, context),
    })
  }, [originsKey, win, enabled])
}
