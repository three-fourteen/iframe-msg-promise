import "./App.css"
import { Frame, GetBtn } from "./components"
import { useState } from "react"

type User = {
  id: number
  name: string
  username: string
  email: string
}

function App() {
  const [data, setData] = useState<User | null>(null)
  return (
    <div className="App">
      <h1>Iframe postMessage with promise example:</h1>
      <p>The idea is to simulate a cross-domain call between iframes.</p>
      <div className="card">
        <GetBtn setData={setData} />
      </div>

      <Frame />

      {data && (
        <div className="card">
          <dl>
            <dt>id</dt>
            <dd>{data.id}</dd>
            <dt>name</dt>
            <dd>{data.name}</dd>
            <dt>username</dt>
            <dd>{data.username}</dd>
            <dt>email</dt>
            <dd>{data.email}</dd>
          </dl>
        </div>
      )}
    </div>
  )
}

export default App
