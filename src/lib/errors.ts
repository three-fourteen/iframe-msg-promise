/**
 * Error codes attached to every {@link IframeMessageError}.
 *
 * - `TIMEOUT`        the peer never answered within the configured timeout
 * - `ABORTED`        the caller aborted the request through an `AbortSignal`
 * - `HANDLER_ERROR`  the peer received the request but its handler threw
 * - `CLONE_ERROR`    the payload could not be structured-cloned
 * - `INVALID_TARGET` the target window/iframe was not usable (e.g. not mounted)
 */
export type IframeMessageErrorCode =
  | "TIMEOUT"
  | "ABORTED"
  | "HANDLER_ERROR"
  | "CLONE_ERROR"
  | "INVALID_TARGET"

/** Plain-object snapshot of an error, safe to send through `postMessage`. */
export type RemoteErrorInfo = {
  name: string
  message: string
  stack?: string
}

/** Every rejection produced by this library is an `IframeMessageError`. */
export class IframeMessageError extends Error {
  readonly code: IframeMessageErrorCode
  /** Present when `code === "HANDLER_ERROR"`: what the peer's handler threw. */
  readonly remote?: RemoteErrorInfo

  constructor(
    code: IframeMessageErrorCode,
    message: string,
    remote?: RemoteErrorInfo
  ) {
    super(message)
    this.name = "IframeMessageError"
    this.code = code
    this.remote = remote
    // Keeps `instanceof` working when the package is down-compiled to ES5.
    Object.setPrototypeOf(this, IframeMessageError.prototype)
  }
}

/** Turn an unknown thrown value into something structured-cloneable. */
export const toRemoteErrorInfo = (error: unknown): RemoteErrorInfo => {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack }
  }
  return { name: "Error", message: String(error) }
}
