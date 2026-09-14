# Changelog

## 2.0.0

Breaking release. The 1.x API could not reach a cross-origin frame and had no
failure path; both are fixed here. See "Migrating from 1.x" in the README.

### Fixed

- **Cross-domain messaging actually works.** `postMessage` was called with a
  single argument, so `targetOrigin` defaulted to `"/"` (same origin only) and
  messages to a cross-origin frame were silently dropped. `targetOrigin` is now
  a required option.
- **Responses can no longer be forged.** A response is accepted only when it
  comes from the window that was written to *and* from the expected origin.
  Request ids come from `crypto.randomUUID()` instead of a predictable counter
  starting at 1.
- **Handlers can no longer be called by any origin.** `startListening` requires
  an explicit `allowedOrigins` allow-list.
- **Requests can no longer hang forever.** Added a 30s default timeout, an
  `AbortSignal` option, and propagation of handler failures back to the caller
  as a rejection. Each of these removes the listener it registered, so a failed
  request no longer leaks one.
- **Synchronous handlers work.** 1.x called `callback(params).then(...)`, which
  threw for any handler that did not return a promise.
- An un-cloneable payload now rejects with `CLONE_ERROR` instead of throwing
  inside the promise executor.

### Added

- `startListening` returns an unsubscribe function — usable directly as a React
  effect cleanup, which also fixes the duplicate listeners StrictMode produced.
- Generics: `postMessagePromise<TRes, TReq>` and `startListening<TReq, TRes>`.
  The handler type replaces the unsafe `Function`.
- `IframeMessageError` with a `code` (`TIMEOUT`, `ABORTED`, `HANDLER_ERROR`,
  `CLONE_ERROR`, `INVALID_TARGET`) and, for handler failures, the peer's error
  in `remote`.
- `target` accepts an `HTMLIFrameElement` directly, not just its `contentWindow`.
- `transfer` option for transferable objects.
- `win` defaults to `window` on both functions.
- Test suite (`yarn test`).

### Changed

- `typescript` moved from `dependencies` to `devDependencies` — installing this
  package no longer pulls in the compiler.
- Wire format: `__seq` → `id`, and responses carry
  `action: "iframeMsgPromise:response"`. Both frames must run 2.x.
- The demo serves its frame as a real document (`/frame.html`) instead of
  portalling into an `about:blank` iframe, so it runs in its own realm like a
  genuinely cross-domain widget.
