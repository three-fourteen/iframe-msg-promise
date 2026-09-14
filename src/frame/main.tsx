import ReactDOM from "react-dom/client"
import FrameContent from "../components/frame-content"

/**
 * Entry point of the embedded document. It is served from /frame.html and
 * loaded through <iframe src>, so it runs in its own realm — the same way a
 * genuinely cross-domain widget would. (A portal into an about:blank iframe
 * would look identical but still execute in the parent's realm.)
 */
ReactDOM.createRoot(
  document.getElementById("frame-root") as HTMLElement
).render(<FrameContent />)
