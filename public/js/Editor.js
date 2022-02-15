/* eslint-env browser */
import React, { useState, useEffect, useMemo } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
// import { IndexeddbPersistence } from 'y-indexeddb'
// @ts-ignore
import {
  DraftBinding,
  getRawBySharedData,
  toRawSharedData,
  setRawToSharedData,
} from 'y-draft-js';
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
  // const [ydoc, provider] = useMemo(() => {
  //   const ydoc = new Y.Doc();
  //   // const yRaw = ymap.get(contenField)
  //   // console.log(yRaw);
  //   // if(!yRaw) {
  //   //   ymap.set(contenField, toRawSharedData(value))
  //   // }
  //   console.log(ydoc, 'ydoc');
  //   const provider = new WebsocketProvider(`ws://${HOST}:1234`, id, ydoc, {
  //     connect: false,
  //   });
  //   return [ydoc, provider];
  // }, [id]);

  useEffect(() => {
    // const draftBind = new DraftBinding({
    //   ydoc,
    //   rawPath: contenField,
    //   editor: editorRef.current,
    //   provider,
    //   parmas,
    //   debug: true,
    // });
    // setDraftBind(draftBind);
    // window.ydoc = ydoc;
    // window.draftBind = draftBind;
    // provider.on('status', ({ status }) => {
    //   setOnlineState(status === 'connected');
    // });
    // provider.awareness.setLocalState({
    //   alphaColor: color.slice(0, -2) + "0.2)",
    //   color,
    //   name,
    // });
    // provider.on('sync', isSynced => {
    //   console.log('sync', isSynced);
    //   if (!isSynced) return;
    //   // const ymap = ydoc.get(contenField)
    //   const raw = getRawBySharedData(contenField, ydoc);
    //   if (raw) {
    //     setValue(raw);
    //   } else {
    //     console.log('initialize');
    //     const initRaw = value || rawContent;
    //     setRawToSharedData(contenField, ydoc, initRaw);
    //   }
    // });
    // provider.connect();
    // return () => {
    //   draftBind.destroy();
    //   provider.disconnect();
    // };
  }, []);

  const onChange = () => {
    // console.log('TeXEditorExample onChange');
  };
  return 'test';
  // <TeXEditorExample
  //   ref={editorRef}
  //   draftBind={draftBind}
  //   isOnline={isOnline}
  //   onChange={onChange}
  //   defaultValue={value}
  // />
}
