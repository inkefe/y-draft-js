/* eslint-env browser */
import React, { useState, useEffect, useMemo } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
// import { IndexeddbPersistence } from 'y-indexeddb'
// @ts-ignore
import { DraftBinding, getRawBySharedData, toRawSharedData } from 'y-draft-js';
import { rawContent } from './data/content';
import TeXEditorExample from './components/TeXEditorExample';

const id = 'draf-tex';
const contenField = 'raw';
const HOST = window.location.host.split(':')[0];
const parmas = {
  user: Math.random().toString(36).substring(7),
};
export default function Editor() {
  const editorRef = React.useRef(null);
  const [isOnline, setOnlineState] = useState(false);
  const [value, setValue] = useState(null);
  const [draftBind, setDraftBind] = useState(null);
  const [ymap, provider] = useMemo(() => {
    const ydoc = new Y.Doc();
    const ymap = ydoc.getMap(id);
    // const yRaw = ymap.get(contenField)
    // console.log(yRaw);
    // if(!yRaw) {
    //   ymap.set(contenField, toRawSharedData(value))
    // }
    console.log(ymap, 'ymap');
    const provider = new WebsocketProvider(`ws://${HOST}:1234`, id, ydoc, {
      connect: false,
    });
    return [ymap, provider];
  }, [id]);

  useEffect(() => {
    const draftBind = new DraftBinding({
      ymap,
      rawPath: contenField,
      editor: editorRef.current,
      provider,
      parmas,
      debug: true,
    });
    setDraftBind(draftBind);
    window.ymap = ymap;
    window.draftBind = draftBind;
    provider.on('status', ({ status }) => {
      setOnlineState(status === 'connected');
    });

    // provider.awareness.setLocalState({
    //   alphaColor: color.slice(0, -2) + "0.2)",
    //   color,
    //   name,
    // });
    provider.on('sync', isSynced => {
      console.log('sync', isSynced);
      if (!isSynced) return;
      console.log(ymap.get(contenField));
      if (ymap.get(contenField)) {
        const raw = getRawBySharedData(contenField, ymap);
        // console.log(ymap.get(contenField).toJSON());
        console.log(raw);
        setValue(raw);
      } else {
        console.log('initialize');
        ymap.set(contenField, toRawSharedData(value || rawContent));
        setValue(value || rawContent);
      }
    });

    provider.connect();

    return () => {
      draftBind.destroy();
      provider.disconnect();
    };
  }, []);

  const onChange = () => {
    // console.log('TeXEditorExample onChange');
  };
  return (
    <TeXEditorExample
      ref={editorRef}
      draftBind={draftBind}
      isOnline={isOnline}
      onChange={onChange}
      defaultValue={value}
    />
  );
}
