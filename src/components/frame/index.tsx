type Props = {
  /** Filled in with the iframe element so the app can post messages to it. */
  iframeRef: React.MutableRefObject<HTMLIFrameElement | null>
  onReady: () => void
}

/**
 * Loads the embedded document. Because it is a real `src` navigation the frame
 * gets its own window and its own script — which is what makes `event.source`
 * checks in the library meaningful.
 */
const Frame = ({ iframeRef, onReady }: Props) => (
  <iframe
    ref={iframeRef}
    id="iframe-wrapper"
    src="/frame.html"
    width="50%"
    height="180"
    title="Simulated cross-domain frame"
    onLoad={onReady}
  />
)

export default Frame
