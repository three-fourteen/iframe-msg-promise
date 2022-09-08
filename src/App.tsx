import reactLogo from "./assets/react.svg"
import "./App.css"
import { Frame, GetBtn } from "./components"
import { useState } from "react"
import { User } from "./types"

function App() {
  const [data, setData] = useState<User | null>(null)
  return (
    <div className="App">
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src="/vite.svg" className="logo" alt="Vite logo" />
        </a>
        <a href="https://reactjs.org" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Iframe postMessage with promise example</h1>
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
