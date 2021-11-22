/* eslint-env browser */
import React, { useState, useEffect, useMemo } from 'react';
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
// import { IndexeddbPersistence } from 'y-indexeddb'
// @ts-ignore
import { DraftBinding, getRawSharedByData, toRawSharedData } from 'y-draft-js'
import { rawContent } from './data/content';
import TeXEditorExample from './components/TeXEditorExample';

const id = 'draf-tex'
const contenField = 'raw'
export default function Editor () {
  const editorRef = React.useRef(null)
  const [isOnline, setOnlineState] = useState(false);
  const [value, setValue] = useState(rawContent);
  const [ymap, provider] = useMemo(() => {
    const ydoc = new Y.Doc();
    const ymap = ydoc.getMap(id)
    // const yRaw = ymap.get(contenField)
    // console.log(yRaw);
    // if(!yRaw) {
    //   ymap.set(contenField, toRawSharedData(value, ymap))
    // }
    console.log(ymap, 'ymap');
    const provider = new WebsocketProvider('ws://192.168.101.127:1234', id, ydoc, {
      connect: false,
    })
    return [ymap, provider];
  }, [id])

  useEffect(() => {
    const draftBind = new DraftBinding(ymap, contenField, editorRef.current, provider)
    provider.on("status", ({ status }) => {
      setOnlineState(status === "connected");
    });

    // provider.awareness.setLocalState({
    //   alphaColor: color.slice(0, -2) + "0.2)",
    //   color,
    //   name,
    // });
    provider.on("sync", (isSynced) => {
      console.log('sync', isSynced);
      if (!isSynced) return
      console.log(ymap.get(contenField));
      if(ymap.get(contenField)) {
        const raw = getRawSharedByData(ymap, contenField)
        // console.log(ymap.get(contenField).toJSON());
        console.log(raw);
        setValue(raw);
      } else {
        ymap.set(contenField, toRawSharedData(value, ymap))
      }
    });

    provider.connect();

    return () => {
      // draftBind.destroy()
      provider.disconnect();
    };
  }, []);

  const onChange = () => {
  }
  return <TeXEditorExample ref={editorRef} onChange={onChange} defaultValue={value}/>
}
