# Simple cross domain iframe messaging with promise

[![NPM](https://img.shields.io/npm/v/iframe-msg-promise)](https://www.npmjs.com/package/iframe-msg-promise)

### Usage Example

```js
// Frame 1
// Get the target iframe
const target = document.getElementById("iframe-target")?.contentWindow

// Send a message to the iframe
if (target) {
  postMessagePromise({
    params: {
      url: "https://jsonplaceholder.typicode.com/users/1",
      method: "GET",
    },
    win: window,
    target: target,
  }).then((resp) => {
    setData(resp)
  })
}

// Frame 2
startListening(window, doSomenthing)
```

## Install the project & run demo

The demo emulates a cross-domain iframe where a message with variables are sent and an API response is returned to the main window.

```sh
$ yarn
$ yarn dev
```

### License

GNU General Public License v3.0 or later
