import { useEffect, useState } from "react"
import { startListening } from "../../lib"
import type { User, UserRequest } from "../../types"

/**
 * The content of the embedded frame. In a real deployment this is served from
 * another domain and knows nothing about the app embedding it beyond the
 * origins it is willing to answer.
 */

/** Origins allowed to call this frame. Hard-coded here; a real widget would
 *  read it from its own config. */
const ALLOWED_ORIGINS = [window.location.origin]

const FrameContent = () => {
  const [param, setParam] = useState<UserRequest | null>(null)

  useEffect(
    () =>
      // startListening returns its own unsubscribe, so it doubles as the effect
      // cleanup: no duplicate listeners under StrictMode's double-invoke.
      startListening<UserRequest, User>({
        allowedOrigins: ALLOWED_ORIGINS,
        handler: async (params) => {
          setParam(params)
          const response = await fetch(params.url, { method: params.method })
          if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`)
          }
          return response.json()
        },
        onError: (error) => console.error("[frame] handler failed", error),
      }),
    []
  )

  return (
    <div>
      <h2>Your Params:</h2>
      {param ? (
        <dl>
          <dt>url</dt>
          <dd>{param.url}</dd>
          <dt>method</dt>
          <dd>{param.method}</dd>
        </dl>
      ) : (
        <p>Waiting for a message from the parent page…</p>
      )}
    </div>
  )
}

export default FrameContent
