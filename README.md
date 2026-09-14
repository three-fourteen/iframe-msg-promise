# Simple cross domain iframe messaging with promise

[![NPM](https://img.shields.io/npm/v/iframe-msg-promise)](https://www.npmjs.com/package/iframe-msg-promise)

Request/response messaging between windows over `postMessage`, with a promise on
one side and a handler on the other. No dependencies, TypeScript-first.

```sh
npm install iframe-msg-promise
```

## Usage

### The app (parent page)

```ts
import { postMessagePromise } from "iframe-msg-promise"

const user = await postMessagePromise<User>({
  params: { url: "/api/users/1", method: "GET" },
  target: document.getElementById("my-iframe") as HTMLIFrameElement,
  targetOrigin: "https://widget.example.com",
})
```

### The iframe

```ts
import { startListening } from "iframe-msg-promise"

const stop = startListening<Request, User>({
  allowedOrigins: ["https://app.example.com"],
  handler: async (params) => {
    const response = await fetch(params.url, { method: params.method })
    return response.json()
  },
})
```

### With React

`startListening` returns its unsubscribe function, so it *is* the effect cleanup —
which also makes it safe under StrictMode's double-invoke:

```tsx
useEffect(
  () =>
    startListening({
      allowedOrigins: ["https://app.example.com"],
      handler: (params) => doSomething(params),
    }),
  []
)
```

On the sending side, pass an `AbortSignal` to cancel a request on unmount:

```tsx
useEffect(() => {
  const controller = new AbortController()
  postMessagePromise({ params, target, targetOrigin, signal: controller.signal })
    .then(setData)
    .catch((error) => {
      if (error.code !== "ABORTED") setError(error)
    })
  return () => controller.abort()
}, [])
```

## API

### `postMessagePromise<TRes, TReq>(options): Promise<TRes>`

| option | type | default | |
| --- | --- | --- | --- |
| `params` | `TReq` | — | Payload for the handler. Must be [structured-cloneable](https://developer.mozilla.org/docs/Web/API/Web_Workers_API/Structured_clone_algorithm). |
| `target` | `Window \| HTMLIFrameElement` | — | The frame to ask. An iframe element is resolved to its `contentWindow`. |
| `targetOrigin` | `string` | — | **Required.** Origin the frame is expected to be on. Responses from anywhere else are ignored. `"*"` opts out of the check. |
| `win` | `Window` | `window` | Window whose `message` events are observed. |
| `timeout` | `number` | `30000` | Milliseconds before rejecting with `TIMEOUT`. `0` disables. |
| `signal` | `AbortSignal` | — | Cancels the request; rejects with `ABORTED`. |
| `transfer` | `Transferable[]` | — | Objects to transfer rather than clone. |

### `startListening<TReq, TRes>(options): () => void`

| option | type | default | |
| --- | --- | --- | --- |
| `handler` | `(params, context) => TRes \| Promise<TRes>` | — | May be sync or async. Its return value is sent back; if it throws, the caller's promise rejects. |
| `allowedOrigins` | `string[] \| "*"` | — | **Required.** Origins permitted to call the handler. |
| `win` | `Window` | `window` | Window to listen on. |
| `onError` | `(error, context) => void` | — | Notified when a handler rejects or a reply cannot be sent. |

`context` is `{ origin, source }` — the already-allow-listed origin of the caller
and the window the answer goes back to.

### `IframeMessageError`

Every rejection from this library is an `IframeMessageError` with a `code`:

| code | when |
| --- | --- |
| `TIMEOUT` | no answer within `timeout` |
| `ABORTED` | the `AbortSignal` fired |
| `HANDLER_ERROR` | the peer's handler threw — see `error.remote` for `{ name, message, stack }` |
| `CLONE_ERROR` | the payload could not be structured-cloned |
| `INVALID_TARGET` | the target iframe had no `contentWindow` (not mounted or not loaded yet) |

## Security notes

- **`targetOrigin` is required, and it matters.** `postMessage(msg)` without one
  defaults to `"/"` — same-origin only — which silently breaks the cross-domain
  case this library exists for. Pass the real origin; reserve `"*"` for payloads
  that are safe to hand to any document that might occupy that frame.
- **`allowedOrigins` is required too.** A handler that answers every origin is
  callable by any page that embeds you. `"*"` is only safe if the handler
  exposes nothing the caller could not already do itself.
- Responses are accepted only from the exact window that was written to *and*
  from the expected origin, and request ids come from `crypto.randomUUID()`, so
  another frame on the page cannot forge or guess its way into a response.
- Where the caller's origin is opaque (a sandboxed iframe, a `data:` document),
  it is reported as `"null"` and cannot be used as a `targetOrigin`; the reply
  is then sent with `"*"`. Allow-listing `"null"` is an explicit opt-in to that.

## Migrating from 1.x

The 1.x API could not actually reach a cross-origin frame, and it had no way to
fail. 2.0 fixes both, which is breaking on every call site.

```diff
-postMessagePromise({ params, win: window, target: iframe.contentWindow })
-  .then((resp) => setData(resp))
+postMessagePromise<User>({ params, target: iframe, targetOrigin: "https://widget.example.com" })
+  .then((resp) => setData(resp))
+  .catch((error) => setError(error))

-startListening(window, handler)
+const stop = startListening({ handler, allowedOrigins: ["https://app.example.com"] })
```

- `targetOrigin` and `allowedOrigins` are new and required.
- `win` is now optional on both functions and defaults to `window`.
- `startListening` takes a single options object and returns an unsubscribe
  function.
- Both functions are generic; `postMessagePromise` resolves to `TRes` instead of
  `unknown`.
- Requests now time out after 30s instead of hanging forever, and handler
  failures reject the caller's promise. Add a `.catch()` — 1.x code never
  needed one.
- The wire format changed (`__seq` → `id`, responses carry
  `action: "iframeMsgPromise:response"`), so **both frames must be on 2.x**.

## Install the project & run demo

The demo serves the embedded frame as its own document (`/frame.html`) so it
runs in its own realm, the way a genuinely cross-domain widget does. It sends a
message with parameters to that frame and gets an API response back.

```sh
$ yarn
$ yarn dev
$ yarn test
```

### License

GNU General Public License v3.0 or later
