/* eslint-env browser */

import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
// @ts-ignore
import { MonacoBinding } from 'y-monaco'
import * as monaco from 'monaco-editor'

window.addEventListener('load', () => {
  const ydoc = new Y.Doc()
  const provider = new WebsocketProvider('ws://localhost:1234', '565', ydoc)
  const type = ydoc.getText('')
  const type2 = ydoc.getText('2')

  const editor = monaco.editor.create(/** @type {HTMLElement} */ (document.getElementById('monaco-editor')), {
    value: '',
    // language: 'javascript',
    // theme: 'vs-dark'
  })
  const editor2 = monaco.editor.create(/** @type {HTMLElement} */ (document.getElementById('monaco-editor2')), {
    value: '',
    language: 'javascript',
    theme: 'vs-dark'
  })
  console.log(type, editor.getModel(),  provider.awareness)
  
  new MonacoBinding(type, /** @type {monaco.editor.ITextModel} */ (editor.getModel()), editor, provider.awareness)
  new MonacoBinding(type2, /** @type {monaco.editor.ITextModel} */ (editor2.getModel()), editor2, provider.awareness)

  // const connectBtn = /** @type {HTMLElement} */ (document.getElementById('y-connect-btn'))
  // connectBtn.addEventListener('click', () => {
  //   if (provider.shouldConnect) {
  //     provider.disconnect()
  //     connectBtn.textContent = 'Connect'
  //   } else {
  //     provider.connect()
  //     connectBtn.textContent = 'Disconnect'
  //   }
  // })

  // @ts-ignore
  // window.example = { provider, ydoc, type, monacoBinding }
})
