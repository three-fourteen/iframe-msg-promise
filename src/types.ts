type User = {
  id: number
  name: string
  username: string
  email: string
}

type PostMsgPromiseArgs = {
  params: any
  win: Window
  target: Window
}

export type { User, PostMsgPromiseArgs }
