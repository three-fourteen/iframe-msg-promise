import { useRef, useState } from "react"
import { IframeMessageError, postMessagePromise } from "../../lib"
import type { User, UserRequest } from "../../types"

type Props = {
  frameRef: React.MutableRefObject<HTMLIFrameElement | null>
  disabled?: boolean
  setData: (user: User | null) => void
}

const GetBtn = ({ frameRef, disabled, setData }: Props) => {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const sendGetRequest = async () => {
    const target = frameRef.current
    if (!target) return

    // Cancel a request still in flight before starting a new one.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)

    // Generate a random ID between 1 and 10 just to get different data
    const randomID = Math.floor(Math.random() * 10) + 1

    try {
      const user = await postMessagePromise<User, UserRequest>({
        params: {
          url: `https://jsonplaceholder.typicode.com/users/${randomID}`,
          method: "GET",
        },
        target,
        // The demo frame is served from the same origin; a real widget would
        // take its own origin here, e.g. "https://widget.example.com".
        targetOrigin: window.location.origin,
        timeout: 10_000,
        signal: controller.signal,
      })
      setData(user)
    } catch (err) {
      if (err instanceof IframeMessageError && err.code === "ABORTED") return
      setData(null)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (abortRef.current === controller) setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={sendGetRequest}
        className="btn"
        disabled={disabled || loading}
      >
        {loading ? "Loading…" : "Get user data"}
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  )
}

export default GetBtn
