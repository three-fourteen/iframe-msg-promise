import { useIframeMessage } from "../../react"
import type { User, UserRequest } from "../../types"

type Props = {
  frameRef: React.MutableRefObject<HTMLIFrameElement | null>
  disabled?: boolean
  setData: (user: User | null) => void
}

const GetBtn = ({ frameRef, disabled, setData }: Props) => {
  const { send, error, loading } = useIframeMessage<User, UserRequest>({
    target: frameRef,
    // The demo frame is served from the same origin; a real widget would take
    // its own origin here, e.g. "https://widget.example.com".
    targetOrigin: window.location.origin,
    timeout: 10_000,
  })

  const sendGetRequest = async () => {
    // Generate a random ID between 1 and 10 just to get different data
    const randomID = Math.floor(Math.random() * 10) + 1
    try {
      setData(
        await send({
          url: `https://jsonplaceholder.typicode.com/users/${randomID}`,
          method: "GET",
        })
      )
    } catch {
      // The hook already put the failure in `error`; just drop the stale row.
      setData(null)
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
      {error && <p role="alert">{error.message}</p>}
    </>
  )
}

export default GetBtn
