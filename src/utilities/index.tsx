import { PostMsgPromiseArgs } from "../types"

/**
 * Post a message to an iframe with a promise
 * @param params The params to send to the iframe
 * @param win The window object of the iframe
 * @param target The target window object
 */

let __seq = 0 // global sequence to track messages responses

const postMessagePromise = ({ params, win, target }: PostMsgPromiseArgs) => {
  return new Promise((resolve) => {
    const seq = ++__seq
    const handleListener = function (resp: {
      data: { __seq: number; value: unknown }
    }) {
      // Check if the message has the same sequence number
      if (resp?.data?.__seq === seq) {
        // Remove the listener
        win.removeEventListener("message", handleListener)
        // And resolve the promise with the value
        resolve(resp.data.value)
      }
    }
    // Add a listener to the window to listen for the response
    win.addEventListener("message", handleListener)
    // Send the message to the iframe
    target.postMessage({ action: "iframeMsgPromise", params, __seq: seq })
  })
}

/**
 * Function to start listening for messages on the iframe
 * @param win The window object of the iframe
 * @param callback  The callback function to execute when the message is received
 */
const startListening = (win: Window, callback: Function) => {
  // listen for messages from other frames
  win.addEventListener(
    "message",
    function (resp) {
      // Check if the message is from the iframe
      if (resp?.data?.action === "iframeMsgPromise") {
        // Get the params from the message
        let { params, __seq } = resp.data
        if (__seq) {
          callback(params).then((value: any) => {
            // Send the response to the iframe with the same sequence number
            resp?.source?.postMessage({ __seq, value })
          })
        }
      }
    },
    false
  )
}

export { postMessagePromise, startListening }
