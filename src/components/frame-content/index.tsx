import { useEffect, useState } from "react"
import { startListening } from "../../lib"

/**
 * This component simulates the content of an iframe
 * that could be on any domain
 */

type Props = {
  win?: Window
}

const FrameContent = ({ win }: Props) => {
  const [param, setParam] = useState<any>(null)

  useEffect(() => {
    if (win) startListening(win, doSomenthing)
  }, [win])

  const doSomenthing = async (params: any) => {
    setParam(params)
    const data = await fetch(params.url, {
      method: params.method,
    })
    return data.json()
  }

  return (
    <div>
      <h2>Your Params:</h2>
      {param && (
        <dl>
          <dt>url</dt>
          <dd>{param.url}</dd>
          <dt>method</dt>
          <dd>{param.method}</dd>
        </dl>
      )}
    </div>
  )
}

export default FrameContent
