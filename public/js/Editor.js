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
const contenFieldA = 'rawa';
const contenFieldB = 'rawb';
const color = '#f00';
const HOST = window.location.host.split(':')[0];
const parmas = {
  user: Math.random().toString(36).substring(7),
};
export default function Editor() {
  const editorRefA = React.useRef(null);
  const editorRefB = React.useRef(null);
  const [isOnline, setOnlineState] = useState(false);
  const [valueA, setValueA] = useState(null);
  const [valueB, setValueB] = useState(null);
  const [draftBindA, setDraftBindA] = useState(null);
  const [draftBindB, setDraftBindB] = useState(null);
  const [ydoc, provider] = useMemo(() => {
    const ydoc = new Y.Doc();
    // const yRaw = ymap.get(contenField)
    // console.log(yRaw);
    // if(!yRaw) {
    //   ymap.set(contenField, toRawSharedData(value))
    // }
    console.log(ydoc, 'ydoc');
    const provider = new WebsocketProvider(`ws://${HOST}:1234`, id, ydoc, {
      connect: false,
    });
    return [ydoc, provider];
  }, [id]);

  useEffect(() => {
    const draftBindA = new DraftBinding({
      ydoc,
      rawPath: contenFieldA,
      editor: editorRefA.current,
      provider,
      parmas,
      debug: true,
    });
    const draftBindB = new DraftBinding({
      ydoc,
      rawPath: contenFieldB,
      editor: editorRefB.current,
      provider,
      parmas,
      debug: true,
    });
    setDraftBindA(draftBindA);
    setDraftBindB(draftBindB);
    window.ydoc = ydoc;
    window.draftBindA = draftBindA;
    window.draftBindB = draftBindB;
    provider.on('status', ({ status }) => {
      setOnlineState(status === 'connected');
    });
    provider.awareness.setLocalState({
      alphaColor: color.slice(0, -2) + '0.2)',
      color,
      name,
    });
    provider.on('sync', isSynced => {
      console.log('sync', isSynced);
      if (!isSynced) return;
      // const ymap = ydoc.get(contenField)
      const rawA = getRawBySharedData(contenFieldA, ydoc);
      const rawB = getRawBySharedData(contenFieldB, ydoc);
      if (rawA) {
        setValueA(rawA);
      } else {
        const initRaw = valueA || rawContent;
        setRawToSharedData(contenFieldA, ydoc, initRaw);
      }
      if (rawB) {
        setValueB(rawB);
      } else {
        const initRaw = valueB || rawContent;
        setRawToSharedData(contenFieldB, ydoc, initRaw);
      }
    });
    provider.connect();
    return () => {
      draftBindA.destroy();
      draftBindB.destroy();
      provider.disconnect();
    };
  }, []);

  return (
    <>
      <TeXEditorExample
        ref={editorRefA}
        draftBind={draftBindA}
        isOnline={isOnline}
        defaultValue={valueA}
      />
      <TeXEditorExample
        ref={editorRefB}
        draftBind={draftBindB}
        isOnline={isOnline}
        defaultValue={valueB}
      />
    </>
  );
}
