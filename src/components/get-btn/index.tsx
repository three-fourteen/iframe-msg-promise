import { postMessagePromise } from "../../.."

const GetBtn = ({ setData }: any) => {
  const sendGetRequest = () => {
    // Get the target iframe
    const target = (
      document.getElementById("iframe-wrapper") as HTMLIFrameElement
    )?.contentWindow

    // If exists, send a message to the iframe
    if (target) {
      // Generate a random ID number between 1 and 10 just to get different data
      const ramdonID = Math.floor(Math.random() * 10) + 1
      postMessagePromise({
        params: {
          url: "https://jsonplaceholder.typicode.com/users/" + ramdonID,
          method: "GET",
        },
        win: window,
        target: target,
      }).then((resp) => {
        setData(resp)
      })
    }
  }

  return (
    <button onClick={sendGetRequest} className="btn">
      Get user data
    </button>
  )
}
export default GetBtn
