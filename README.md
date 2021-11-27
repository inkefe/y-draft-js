# y-draft-js

Draft-js editor bindings for [Yjs](https://github.com/yjs/yjs), a modern, fast, and powerful JavaScript library for collaborative editing.

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
onTargetSync(path, ymap, callback); // The callback is triggered when the listening target has a value (This is useful when you are not sure if the data under the destination path exists)
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
