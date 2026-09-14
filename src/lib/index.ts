import { IframeMessageError, toRemoteErrorInfo } from "./errors"
import {
  createMessageId,
  isOpaqueOrigin,
  isOriginAllowed,
  isRequestEnvelope,
  isResponseEnvelope,
  originMatchesTarget,
  REQUEST_ACTION,
  RESPONSE_ACTION,
} from "./protocol"
import type { RequestEnvelope, ResponseEnvelope } from "./protocol"

export { IframeMessageError } from "./errors"
export type { IframeMessageErrorCode, RemoteErrorInfo } from "./errors"
export { REQUEST_ACTION, RESPONSE_ACTION }

/** Default time to wait for a response before rejecting with `TIMEOUT`. */
export const DEFAULT_TIMEOUT_MS = 30_000

export type PostMessagePromiseOptions<TReq = unknown> = {
  /** Payload handed to the peer's handler. Must be structured-cloneable. */
  params: TReq
  /** The iframe element, or its `contentWindow`, to send the request to. */
  target: Window | HTMLIFrameElement
  /**
   * Origin the target is expected to be on, e.g. `"https://widget.example.com"`.
   * Responses from any other origin are ignored. `"*"` disables the check and
   * should only ever be used when the payload and the answer are both public.
   */
  targetOrigin: string
  /** Window whose `message` events we listen on. Defaults to `window`. */
  win?: Window
  /** Milliseconds before rejecting with `TIMEOUT`. `0` disables the timeout. */
  timeout?: number
  /** Abort the request early; rejects with `ABORTED`. */
  signal?: AbortSignal
  /** Objects to transfer (rather than clone) to the target. */
  transfer?: Transferable[]
}

const resolveTargetWindow = (target: Window | HTMLIFrameElement): Window => {
  const win =
    target && "contentWindow" in target
      ? (target as HTMLIFrameElement).contentWindow
      : (target as Window)

  if (!win) {
    throw new IframeMessageError(
      "INVALID_TARGET",
      "The target iframe has no contentWindow. Is it mounted and loaded yet?"
    )
  }
  return win
}

const resolveWindow = (win?: Window): Window => {
  const resolved = win ?? (typeof window !== "undefined" ? window : undefined)
  if (!resolved) {
    throw new IframeMessageError(
      "INVALID_TARGET",
      "No window available. Pass `win` explicitly outside of a browser."
    )
  }
  return resolved
}

/**
 * Send a request to another frame and await its answer.
 *
 * @example
 * ```ts
 * const user = await postMessagePromise<User>({
 *   params: { url: "/api/users/1", method: "GET" },
 *   target: iframeRef.current,
 *   targetOrigin: "https://widget.example.com",
 * })
 * ```
 *
 * Rejects with an {@link IframeMessageError} on timeout, abort, a handler
 * failure on the other side, or an un-cloneable payload.
 */
export const postMessagePromise = <TRes = unknown, TReq = unknown>({
  params,
  target,
  targetOrigin,
  win,
  timeout = DEFAULT_TIMEOUT_MS,
  signal,
  transfer,
}: PostMessagePromiseOptions<TReq>): Promise<TRes> =>
  new Promise<TRes>((resolve, reject) => {
    if (!targetOrigin) {
      throw new TypeError(
        "`targetOrigin` is required. Pass the origin of the target frame, or \"*\" to opt out of the check."
      )
    }

    const listenerWindow = resolveWindow(win)
    const targetWindow = resolveTargetWindow(target)

    if (signal?.aborted) {
      reject(new IframeMessageError("ABORTED", "Request aborted before it was sent."))
      return
    }

    const id = createMessageId()
    let timer: ReturnType<typeof setTimeout> | undefined

    const cleanup = () => {
      listenerWindow.removeEventListener("message", handleMessage)
      signal?.removeEventListener("abort", handleAbort)
      if (timer !== undefined) clearTimeout(timer)
    }

    function handleMessage(event: MessageEvent) {
      // Only trust an answer that came from the window we wrote to, on the
      // origin we expect. Without both checks any frame on the page could
      // forge a response.
      if (event.source !== targetWindow) return
      if (!originMatchesTarget(event.origin, targetOrigin, listenerWindow)) return
      if (!isResponseEnvelope(event.data) || event.data.id !== id) return

      const envelope = event.data as ResponseEnvelope<TRes>
      cleanup()

      if (envelope.ok) {
        resolve(envelope.value)
      } else {
        reject(
          new IframeMessageError(
            "HANDLER_ERROR",
            `The message handler failed: ${envelope.error.message}`,
            envelope.error
          )
        )
      }
    }

    function handleAbort() {
      cleanup()
      reject(new IframeMessageError("ABORTED", "Request aborted."))
    }

    listenerWindow.addEventListener("message", handleMessage)
    signal?.addEventListener("abort", handleAbort)

    if (timeout > 0) {
      timer = setTimeout(() => {
        cleanup()
        reject(
          new IframeMessageError(
            "TIMEOUT",
            `No response from ${targetOrigin} after ${timeout}ms.`
          )
        )
      }, timeout)
    }

    const envelope: RequestEnvelope<TReq> = { action: REQUEST_ACTION, id, params }

    try {
      targetWindow.postMessage(envelope, targetOrigin, transfer)
    } catch (error) {
      cleanup()
      reject(
        new IframeMessageError(
          "CLONE_ERROR",
          `Could not post the message: ${toRemoteErrorInfo(error).message}`,
          toRemoteErrorInfo(error)
        )
      )
    }
  })

/** Extra information about the frame a request came from. */
export type MessageContext = {
  /** Origin of the frame that sent the request — already allow-listed. */
  origin: string
  /** The frame that sent the request; the answer is posted back to it. */
  source: Window
}

export type MessageHandler<TReq = unknown, TRes = unknown> = (
  params: TReq,
  context: MessageContext
) => TRes | Promise<TRes>

export type StartListeningOptions<TReq = unknown, TRes = unknown> = {
  /** Called for every allowed request; its result is sent back to the caller. */
  handler: MessageHandler<TReq, TRes>
  /**
   * Origins allowed to call this handler, e.g. `["https://app.example.com"]`.
   * `"*"` accepts every origin — only safe when the handler exposes nothing
   * the caller could not already do itself.
   */
  allowedOrigins: string[] | "*"
  /** Window to listen on. Defaults to `window`. */
  win?: Window
  /** Notified about rejected handlers and messages we could not answer. */
  onError?: (error: unknown, context: MessageContext) => void
}

/**
 * Answer requests sent by {@link postMessagePromise}.
 *
 * @returns an unsubscribe function — call it on unmount.
 *
 * @example
 * ```ts
 * useEffect(
 *   () =>
 *     startListening({
 *       allowedOrigins: ["https://app.example.com"],
 *       handler: async (params) => (await fetch(params.url)).json(),
 *     }),
 *   []
 * )
 * ```
 */
export const startListening = <TReq = unknown, TRes = unknown>({
  handler,
  allowedOrigins,
  win,
  onError,
}: StartListeningOptions<TReq, TRes>): (() => void) => {
  if (typeof handler !== "function") {
    throw new TypeError("`handler` must be a function.")
  }
  if (allowedOrigins !== "*" && (!Array.isArray(allowedOrigins) || allowedOrigins.length === 0)) {
    throw new TypeError(
      "`allowedOrigins` is required: pass the origins you trust, or \"*\" to accept every origin."
    )
  }

  const listenerWindow = resolveWindow(win)

  const handleMessage = (event: MessageEvent) => {
    if (!isRequestEnvelope(event.data)) return
    if (!isOriginAllowed(event.origin, allowedOrigins)) return

    const source = event.source as Window | null
    if (!source) return

    const context: MessageContext = { origin: event.origin, source }
    const { id, params } = event.data as RequestEnvelope<TReq>

    // An opaque origin ("null": sandboxed iframes, data: documents) cannot be
    // used as a targetOrigin, so the reply has to go out as "*". The request
    // already passed the allow-list, so this is a deliberate opt-in.
    const replyOrigin = isOpaqueOrigin(event.origin) ? "*" : event.origin

    const reply = (envelope: ResponseEnvelope<TRes>) => {
      try {
        source.postMessage(envelope, replyOrigin)
      } catch (error) {
        onError?.(error, context)
        // The value itself may be what failed to clone; tell the caller
        // something so their promise rejects instead of hanging.
        if (envelope.ok) {
          reply({
            action: RESPONSE_ACTION,
            id,
            ok: false,
            error: toRemoteErrorInfo(error),
          })
        }
      }
    }

    // `Promise.resolve` so synchronous handlers work too.
    Promise.resolve()
      .then(() => handler(params, context))
      .then(
        (value) => reply({ action: RESPONSE_ACTION, id, ok: true, value }),
        (error) => {
          onError?.(error, context)
          reply({
            action: RESPONSE_ACTION,
            id,
            ok: false,
            error: toRemoteErrorInfo(error),
          })
        }
      )
  }

  listenerWindow.addEventListener("message", handleMessage)
  return () => listenerWindow.removeEventListener("message", handleMessage)
}
