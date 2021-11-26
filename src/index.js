// import * as error from 'lib0/error.js'
// import invariant from 'tiny-invariant';
import { createMutex } from 'lib0/mutex.js';
// import { Awareness } from 'y-protocols/awareness.js' // eslint-disable-line
import { convertFromRaw, convertToRaw, EditorState } from 'draft-js';
import {
  transRaw,
  getNewSelection,
  changeYmapByDelta,
  toSyncElement,
  getTargetByPath,
  onTargetSync,
  toRawSharedData,
} from './utils';
import { diffRaw, rbw2raw } from './diff';

const LOCAL_OPERATIONS = new WeakMap();
const getRawBySharedData = (rawPath, ymap) => {
  !Array.isArray(rawPath) && (rawPath = [rawPath]);
  const target = getTargetByPath(rawPath, ymap);
  if (!target) return null;
  const rbw = target.toJSON();
  const raw = rbw2raw(rbw);
  if (raw.blocks.length !== rbw.blocks.length) {
    ymap.set(rawPath, toRawSharedData(raw));
  } // 修复
  return raw;
};

export {
  toRawSharedData,
  getRawBySharedData,
  getTargetByPath,
  onTargetSync,
  toSyncElement,
  getNewSelection,
};
const CHANGE_CLIENT = 'CHANGE_CLIENT'; // 用于识别是不是自己的更新
window.getRawByState = editorState =>
  convertToRaw(editorState.getCurrentContent());
export class DraftBinding {
  constructor(opts) {
    const { ymap, rawPath: _rawPath, editor, provider, parmas } = opts;
    let rawPath = _rawPath;
    !Array.isArray(rawPath) && (rawPath = [rawPath]);
    this.doc = ymap.doc;
    this.ymap = ymap;
    this.awareness = provider.awareness;
    this.mutex = createMutex();
    this.rawPath = rawPath;
    // console.log(
    //   'DraftBinding',
    //   opts,

    //   getTargetByPath(this.rawPath, ymap),
    //   editor,
    //   provider
    // );
    // editor._onSelect = e => {
    //   editor._onSelect(e)
    //   this._onSelect(e)
    // }
    // this.value = rbw2raw(ymap.get(key)?.toJSON())
    // console.log(this.value, this.rawPath);
    // ymap.doc.on('afterTransaction', update => {
    //   console.log(update, 'afterTransaction');
    // })

    this.onObserveDeep = (event, isupate) => {
      let currentTarget = null;
      event.forEach(item => {
        const { path } = item;
        const originOrpId = item.currentTarget.get(CHANGE_CLIENT).toString();
        if (
          path.length > 0 &&
          path[0] !== CHANGE_CLIENT &&
          this.oprID !== originOrpId
        ) {
          // 自己的更改不用更新
          currentTarget = item.currentTarget;
          this.oprID = originOrpId;
        }
      });
      currentTarget && this.forceRefresh(currentTarget);
    };

    !provider.synced
      ? provider.on('sync', isSynced => {
          if (!isSynced) return;
          this.cancel = onTargetSync(this.rawPath, ymap, rawYmap => {
            this.listenTargetYmap(rawYmap);
          });
        })
      : (this.cancel = onTargetSync(this.rawPath, ymap, rawYmap => {
          this.listenTargetYmap(rawYmap);
        }));
    // editor.onDidChangeCursorSelection(() => {
    //   if (editor.getModel() === monacoModel) {
    //     const sel = editor.getSelection()
    //     if (sel === null) {
    //       return
    //     }
    //     let anchor = monacoModel.getOffsetAt(sel.getStartPosition())
    //     let head = monacoModel.getOffsetAt(sel.getEndPosition())
    //     if (sel.getDirection() === monaco.SelectionDirection.RTL) {
    //       const tmp = anchor
    //       anchor = head
    //       head = tmp
    //     }
    //     awareness.setLocalStateField('selection', {
    //       anchor: Y.createRelativePositionFromTypeIndex(ytext, anchor),
    //       head: Y.createRelativePositionFromTypeIndex(ytext, head)
    //     })
    //   }
    // })
    // this.awareness.on('change', this.rerenderDecorations)
    // this.onChange = this.onChange

    this.onChange = editorState =>
      this.mutex(
        () => {
          this.editorState = editorState;
          const raw = transRaw(convertToRaw(editorState.getCurrentContent()));
          if (!this.value) return (this.value = raw);
          if (
            this.shouldAcceptSelection &&
            !editorState.getSelection().isCollapsed()
          ) {
            this.shouldAcceptSelection = false;
          } // 释放控制
          const newJson = JSON.stringify(raw);
          const oldJson = JSON.stringify(this.value);
          if (oldJson === newJson || !this.rawYmap) return; // console.log(newJson, oldJson)
          const delta = diffRaw(this.value, raw);
          changeYmapByDelta(delta, this.rawYmap, () => {
            this.oprID = this.oprID + '0';
            this.oprYText.insert(this.oprID.length, '0');
          });
          this.value = JSON.parse(newJson);
        },
        () => {
          console.warn('onChange has been delayed');
        }
      );
    this.bindEditor(editor);
  }

  forceRefresh = () => {
    const raw = rbw2raw(this.rawYmap.toJSON());
    this.muxSetRaw(raw);
  };

  muxSetRaw = raw => {
    this._waitUpdateTarget = null;
    this.mutex(
      () => {
        this.setStateByRaw(raw);
      },
      () => {
        console.warn('setStateByRaw has been delayed');
        this._waitUpdateTarget = raw;
      }
    );
  };

  listenTargetYmap = rawYmap => {
    this.rawYmap = rawYmap;
    if (rawYmap.get(CHANGE_CLIENT)) {
      // A tag used to record local actions to prevent executing `setStateByRaw()`
      this.oprYText = rawYmap.get(CHANGE_CLIENT);
      this.oprYText.delete(0, this.oprYText.length - 1);
      this.oprID = this.oprYText.toString();
    } else {
      this.oprID = '0';
      this.oprYText = toSyncElement(this.oprID);
      rawYmap.set(CHANGE_CLIENT, toSyncElement(this.oprID));
    }
    this.value = rbw2raw(rawYmap.toJSON());
    this.onObserveDeep && rawYmap.observeDeep(this.onObserveDeep); // observeDeep this editor's raw
  };

  bindEditor = editor => {
    // 支持异步绑定编辑器
    if (!editor || this.draftEditor) return;
    const draftEditor = editor.update ? editor : editor.editor;
    if (!draftEditor || !editor.componentDidUpdate)
      return console.warn('editor must be Draft ref');
    const isPluginEditor = !!editor.onChange;
    this.draftEditor = editor;
    this.getEditorContainer()?.addEventListener(
      'mousedown',
      this.releaseSelection
    );
    if (isPluginEditor) {
      this._onChange = editor.onChange;
      const componentDidUpdate = editor.componentDidUpdate; // listen to changes
      const that = this;
      editor.componentDidUpdate = function (prevProps, prevState) {
        const editorState = editor.getEditorState();
        if (
          that.editorState !== editorState &&
          editorState !== prevProps.editorState
        ) {
          that.onChange(editorState);
          if (that._waitUpdateTarget) {
            that.muxSetRaw(that._waitUpdateTarget);
          }
        }
        componentDidUpdate.apply(editor, [prevProps, prevState]);
      };
      // this._onChange = editor.onChange; // listen to changes
      // this._onChange &&
      //   (editor.onChange = (...args) => {
      //     this.onChange(args[0]);
      //     this._onChange.apply(editor, args);
      //     if (this._waitUpdateTarget) {
      //       this.editorState = args[0];
      //       this.muxSetRaw(this._waitUpdateTarget);
      //     }
      //   });
    } else {
      this._update = editor.update; // listen to changes
      this._update &&
        (editor.update = (...args) => {
          console.log(args);
          this.onChange(args[0]);
          this._update.apply(editor, args);
          if (this._waitUpdateTarget) {
            this.editorState = args[0];
            this.muxSetRaw(this._waitUpdateTarget);
          }
        });
    }
  };

  getEditorContainer = () => {
    if (!this.draftEditor) return null;
    return (
      this.draftEditor.editorContainer ||
      this.draftEditor.editor?.editorContainer
    );
  };

  // _onSelect = e => {
  //   const editorState = this.getEditorState()
  //   const selection = editorState.getSelection()
  //   let anchor = monacoModel.getOffsetAt(sel.getStartPosition())
  //   let head = monacoModel.getOffsetAt(sel.getEndPosition())
  //   if (sel.getDirection() === monaco.SelectionDirection.RTL) {
  //     const tmp = anchor
  //     anchor = head
  //     head = tmp
  //   }
  //   this.awareness.setLocalStateField('selection', {
  //     anchor: Y.createRelativePositionFromTypeIndex(this.ytext, anchor),
  //     head: Y.createRelativePositionFromTypeIndex(this.ytext, head)
  //   })
  // }

  getEditorState = () => {
    return this.editorState || this.draftEditor.props.editorState;
  };

  setStateByRaw = raw => {
    const _onChange = this._update || this._onChange;
    if (!raw || !raw.blocks || !_onChange) return;
    const editorState = this.getEditorState();
    const selectionState = editorState.getSelection();
    const newEditorState = EditorState.push(
      editorState,
      convertFromRaw(raw),
      'sycn-change'
    );
    const isCollapsed = selectionState.isCollapsed();
    if (!selectionState.getHasFocus() && isCollapsed) {
      this.editorState = newEditorState;
      this.value = raw;
      return _onChange.call(this.draftEditor, this.editorState);
    }
    this.setStateAndSelection(_onChange, newEditorState, isCollapsed, raw);
  };

  setStateAndSelection = (_onChange, newEditorState, isCollapsed, raw) => {
    const editorState = this.getEditorState();
    const selectionState = editorState.getSelection();
    const contentState = editorState.getCurrentContent();
    const startKey = selectionState.getStartKey();
    const endKey = selectionState.getEndKey();
    const start = selectionState.getStartOffset();
    const end = selectionState.getEndOffset();
    const newSelection = getNewSelection(
      { startKey, endKey, start, end },
      raw,
      contentState
    );
    // this.localSelectionState = newSelection
    // console.log(this.shouldAcceptSelection);
    this.editorState = newSelection
      ? EditorState[
          isCollapsed || this.shouldAcceptSelection
            ? 'acceptSelection'
            : 'forceSelection'
        ](newEditorState, newSelection)
      : newEditorState;
    this.value = raw;
    _onChange.call(this.draftEditor, this.editorState);
  };

  releaseSelection = () => {
    this.shouldAcceptSelection = true;
  };

  decorations = new Map();

  // 渲染光标
  // rerenderDecorations = () => {
  //   // const currentDecorations = this.decorations.get(this.editor) || []
  //   const newDecorations = []
  //   this.awareness.getStates().forEach((state, clientID) => {
  //     if (clientID !== this.doc.clientID && state.selection != null && state.selection.anchor != null && state.selection.head != null) {
  //       const anchorAbs = Y.createAbsolutePositionFromRelativePosition(state.selection.anchor, this.doc)
  //       const headAbs = Y.createAbsolutePositionFromRelativePosition(state.selection.head, this.doc)
  //       if (anchorAbs !== null && headAbs !== null && anchorAbs.type === ytext && headAbs.type === ytext) {
  //         let start, end, afterContentClassName, beforeContentClassName
  //         if (anchorAbs.index < headAbs.index) {
  //           start = monacoModel.getPositionAt(anchorAbs.index)
  //           end = monacoModel.getPositionAt(headAbs.index)
  //           afterContentClassName = 'yRemoteSelectionHead'
  //           beforeContentClassName = null
  //         } else {
  //           start = monacoModel.getPositionAt(headAbs.index)
  //           end = monacoModel.getPositionAt(anchorAbs.index)
  //           afterContentClassName = null
  //           beforeContentClassName = 'yRemoteSelectionHead'
  //         }
  //         // newDecorations.push({
  //         //   range: new SelectionState(start.lineNumber, start.column, end.lineNumber, end.column),
  //         //   options: {
  //         //     className: 'yRemoteSelection',
  //         //     afterContentClassName,
  //         //     beforeContentClassName
  //         //   }
  //         // })
  //       }
  //     }
  //   })
  //   // this.decorations.set(editor, editor.deltaDecorations(currentDecorations, newDecorations))
  // }

  destroy() {
    console.warn('y-darf-js is destoryed');
    this.getEditorContainer()?.removeEventListener(
      'mousedown',
      this.releaseSelection
    );
    this._update &&
      this.draftEditor &&
      (this.draftEditor.update = this._update);
    this._onChange &&
      this.draftEditor &&
      (this.draftEditor.onChange = this._onChange);
    this.mutex = null;
    this.cancel?.();
    // this._monacoChangeHandler.dispose()
    this.rawYmap && this.rawYmap.unobserveDeep(this.onObserveDeep);
    // this.doc.off('beforeAllTransactions', this._beforeTransaction)
    if (this.awareness !== null) {
      // @ts-ignore
      this.awareness.off('change', this.rerenderDecorations);
    }
  }
}
