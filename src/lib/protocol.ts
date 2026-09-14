import type { RemoteErrorInfo } from "./errors.js"

/** Discriminator carried by every request sent by this library. */
export const REQUEST_ACTION = "iframeMsgPromise" as const
/** Discriminator carried by every response sent by this library. */
export const RESPONSE_ACTION = "iframeMsgPromise:response" as const

export type RequestEnvelope<TReq> = {
  action: typeof REQUEST_ACTION
  id: string
  params: TReq
}

export type ResponseEnvelope<TRes> =
  | { action: typeof RESPONSE_ACTION; id: string; ok: true; value: TRes }
  | { action: typeof RESPONSE_ACTION; id: string; ok: false; error: RemoteErrorInfo }

export const isRequestEnvelope = (
  data: unknown
): data is RequestEnvelope<unknown> =>
  typeof data === "object" &&
  data !== null &&
  (data as RequestEnvelope<unknown>).action === REQUEST_ACTION &&
  typeof (data as RequestEnvelope<unknown>).id === "string"

export const isResponseEnvelope = (
  data: unknown
): data is ResponseEnvelope<unknown> =>
  typeof data === "object" &&
  data !== null &&
  (data as ResponseEnvelope<unknown>).action === RESPONSE_ACTION &&
  typeof (data as ResponseEnvelope<unknown>).id === "string"

/**
 * Unguessable request id. A predictable counter would let any frame on the
 * page forge a response, so prefer the crypto APIs and only fall back to
 * `Math.random` where neither is available (e.g. an insecure-context browser
 * without `getRandomValues`).
 */
export const createMessageId = (): string => {
  const c: Crypto | undefined =
    typeof globalThis !== "undefined" ? globalThis.crypto : undefined

  if (c && typeof c.randomUUID === "function") return c.randomUUID()

  if (c && typeof c.getRandomValues === "function") {
    const bytes = c.getRandomValues(new Uint8Array(16))
    let out = ""
    for (let i = 0; i < bytes.length; i++) {
      out += bytes[i].toString(16).padStart(2, "0")
    }
    return out
  }

  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`
}

/**
 * An opaque origin (sandboxed iframe, `data:` document, some `about:blank`
 * cases) is reported as the literal string `"null"` and cannot be used as a
 * `targetOrigin`.
 */
export const isOpaqueOrigin = (origin: string): boolean =>
  origin === "null" || origin === ""

/** Does `origin` satisfy the `targetOrigin` the caller asked us to talk to? */
export const originMatchesTarget = (
  origin: string,
  targetOrigin: string,
  win: Window
): boolean => {
  if (targetOrigin === "*") return true
  if (targetOrigin === "/") return origin === win.location.origin
  return origin === targetOrigin
}

/** Is `origin` in the allow-list the listener was configured with? */
export const isOriginAllowed = (
  origin: string,
  allowedOrigins: string[] | "*"
): boolean =>
  allowedOrigins === "*" ? true : allowedOrigins.indexOf(origin) !== -1
