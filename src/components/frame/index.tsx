import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import FrameContent from "../frame-content"

const Frame = () => {
  const contentRef = useRef<HTMLIFrameElement>(null!)

  const [mountNode, setMountNode] = useState<HTMLElement>(null!)

  useEffect(() => {
    const body = contentRef?.current?.contentWindow?.document?.body
    if (body) {
      setMountNode(body)
    }
  }, [contentRef])

  return (
    <iframe width="50%" ref={contentRef} id="iframe-wrapper">
      {mountNode &&
        createPortal(
          <FrameContent
            win={contentRef?.current?.contentWindow ?? undefined}
          />,
          mountNode
        )}
    </iframe>
  )
}

export default Frame
