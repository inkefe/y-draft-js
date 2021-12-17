# y-draft-js

[Draft.js](https://draftjs.org/) editor bindings for [Yjs](https://github.com/yjs/yjs), a modern, fast, and powerful JavaScript library for collaborative editing.

> Awareness has saved SelectionState.

## usage

1. install

```shell
npm install y-draft-js
```

2. bindYdoc

```js
const ydoc = new Y.Doc();
const ymap = ydoc.getMap(id); // your doc id

const provider = new WebsocketProvider(
  'ws://localhost:1234', // your websockt url
  id,
  ydoc,
  {
    connect: false,
  }
);
```

3. bind Draft editor & connect to ydoc

```js
import { DraftBinding } from 'y-draft-js';
const draftBind = new DraftBinding({
  ymap,
  rawPath: 'raw', // your draft-js raw path（or [], exp: ['content', 'raw']）
  editor: editorRef.current, // draft-js editor ref , or plugin editor ref, or null(You can bind the editor asynchronously, exp: draftBind.bindEditor(editorRef.current))
  provider,
});
provider.connect();
```

4. destroy the binding on departure

```js
draftBind.destroy();
```

## awareness

All clients are stored in the `provider.awareness`.

```js
provider.awareness.getStates().forEach(state => {
  console.log(state.selection); // selection state by all clients
});
```

## undoManager

`draftBind.undo` and `draftBind.redo` can be used to undo and redo. if you want to jump to the specified step, you can set `allowUndo = false` in `editorState`

```js
const newEditorState = EditorState.push(
  editorState,
  newContentState,
  'insert-characters'
);
newEditorState.allowUndo = false; // not allow undo [y-draft-js]
this.setState({ editorState: newEditorState });
```

exp:

```js

handleKeyCommand = (command, editorState) => {
  if(command === 'y-draft-undo') {
    this.draftBind?.undo();
    return 'handled';
  }
  if(command === 'y-draft-redo') {
    this.draftBind?.redo();
    return 'handled';
  }
  const newState = RichUtils.handleKeyCommand(editorState, command);
  if (newState) {
    this._onChange(newState);
    return true;
  }
  return false;
};

myKeyBindingFn(e) {
  const cmd = getDefaultKeyBinding(e);
  if (cmd === 'undo') return 'y-draft-undo';
  if (cmd === 'redo') return 'y-draft-redo';
  if (cmd) return cmd;
}
```

```js
<Editor
  editorState={editorState}
  handleKeyCommand={this.handleKeyCommand}
  keyBindingFn={this.myKeyBindingFn}
  onChange={this._onChange}
  ref={ref => (this.editorRef = ref)}
/>
```

## API

> Because `raw` is not suitable for diff calculation save, so it did a layer of RAW conversion, conversion methods will be introduced

1. getRawBySharedData

```js
const raw = getRawBySharedData(path, ymap); // get raw data by ymap path
```

2. toRawSharedData

```js
ymap.set('content', toRawSharedData(raw)); // set raw data to ymap path
```

3. getTargetByPath

```js
const target = getTargetByPath(path, ymap); // get target by ymap path
```

4. onTargetSync

```js
const cancel = onTargetSync(path, ymap, callback); // The callback is triggered when the listening target has a value or target is replaced (This is useful when you are not sure if the data under the destination path exists)
// cancel the listener when component unmount
cancel();
```

5. toSyncElement

```js
ymap.set('content', toSyncElement(data)); // set data to ydoc (Depth conversion of this data，if the data contains raw, it will be converted to ydoc raw)
```

<!-- 性能数据:

更新频率 ≥ 1 次/70ms 光标位置更改错误率 ≤ 1%

更新频率 ≈= 1 次/36ms 光标位置更改错误率 (用户变更光标位置频率 = 1 次/700ms 时 为 2%， <= 1 次/300ms 为 5%))

更新频率 ≤ 1 次/24ms 光标位置更改错误率 (用户变更光标位置频率 = 1 次/700ms 时 为 4%， <= 1 次/300ms 为 5%) -->

## develop

1. start websoket-server

```
npm run start:server
```

2. start demo

```
npm run dev
```
