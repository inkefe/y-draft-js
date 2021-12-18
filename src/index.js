// import * as error from 'lib0/error.js'
// import invariant from 'tiny-invariant';
import * as Y from 'yjs';
// import { Awareness } from 'y-protocols/awareness.js' // eslint-disable-line
import { convertFromRaw, convertToRaw, EditorState, genKey } from 'draft-js';
import {
  transRaw,
  getNewSelection,
  changeYmapByDelta,
  toSyncElement,
  getTargetByPath,
  onTargetSync,
  toRawSharedData,
} from './utils';
import { diffRaw, rbw2raw, raw2rbw } from './diff';

const LOCAL_OPERATIONS = new WeakMap();
const getRawBySharedData = (rawPath, ymap) => {
  !Array.isArray(rawPath) && (rawPath = [rawPath]);
  const target = getTargetByPath(rawPath, ymap);
  if (!target) return null;
  const rbw = target.toJSON();
  const raw = rbw2raw(rbw);
  if (!rbw || !rbw.blocks) return rbw;
  return raw;
};

export {
  toRawSharedData,
  getRawBySharedData,
  getTargetByPath,
  onTargetSync,
  toSyncElement,
  getNewSelection,
  rbw2raw,
  raw2rbw,
};
const CHANGE_CLIENT = 'CHANGE_CLIENT'; // 用于识别是不是自己的更新

export class DraftBinding {
  constructor(opts) {
    const {
      ymap,
      rawPath: _rawPath,
      editor,
      provider,
      updatable = true,
      debug,
    } = opts;
    this.log = debug ? console.log : () => {};
    this.version = VERSION;
    let rawPath = _rawPath;
    !Array.isArray(rawPath) && (rawPath = [rawPath]);
    this.doc = ymap.doc;
    this.clientID = this.doc.clientID;
    this.trackedSet = new Set([this.clientID, this]);
    this.ymap = ymap;
    this.awareness = provider.awareness;
    this._lock = false;
    this.mutex = (f, g) => {
      if (!this._lock) {
        this._lock = true;
        try {
          f();
          this._lock = false;
        } finally {
          this._lock = false;
        }
        this._lock = false;
      } else if (g !== undefined) {
        g();
      }
    };
    this.rawPath = rawPath;
    this.onObserveDeep = events => {
      if (!this._updatable) return (this._stopUpdateEvents = events);
      this._stopUpdateEvents = null;
      let currentTarget = null;
      const originOrpId = events[0].currentTarget.get(CHANGE_CLIENT);
      if (this.oprID === originOrpId) return;
      events.forEach(item => {
        const { path } = item;
        if (path.length > 0 && path[0] !== CHANGE_CLIENT) {
          // 自己的更改不用更新
          currentTarget = item.currentTarget;
          this.oprID = originOrpId;
        }
      });
      this.log('exe :[onObserveDeep]', !!currentTarget, this.rawPath.join('.'));
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
    this.onChange = editorState =>
      this.mutex(
        () => {
          this.editorState = editorState;
          const raw = transRaw(convertToRaw(editorState.getCurrentContent()));
          if (!this.value) return (this.value = raw);
          if (!this._updatable) return;
          const selection = editorState.getSelection();
          // console.log(selection.getHasFocus(), selection.getAnchorOffset(), selection.getAnchorKey());
          const allowUndo =
            this.editorState.allowUndo ?? this.editorState.getAllowUndo();
          if (this.shouldAcceptSelection && !selection.isCollapsed()) {
            this.shouldAcceptSelection = false;
          } // 释放控制
          const selectData = {
            anchorKey: selection.getAnchorKey(),
            anchorOffset: selection.getAnchorOffset(),
            focusKey: selection.getFocusKey(),
            focusOffset: selection.getFocusOffset(),
            hasFocus: selection.getHasFocus(),
          };
          this.awareness.setLocalStateField('selection', selectData);
          const newJson = JSON.stringify(raw);
          const oldJson = JSON.stringify(this.value);
          this.rawYmap = getTargetByPath(this.rawPath, this.ymap);
          if (oldJson === newJson || !this.rawYmap) return; // console.log(newJson, oldJson)
          const delta = diffRaw(this.value, raw);
          changeYmapByDelta(
            delta,
            this.rawYmap,
            () => {
              this.oprID = genKey();
              this.rawYmap.set(CHANGE_CLIENT, this.oprID);
            },
            allowUndo ? this.clientID : null
          );
          this.value = JSON.parse(newJson);
        },
        () => {
          console.warn('onChange has been delayed', this);
        }
      );
    this.bindEditor(editor);
    this._updatable = !!updatable;
  }

  setUpdatable = val => {
    this._updatable = !!val;
    if (!!val && this._stopUpdateEvents) {
      this.onObserveDeep(this._stopUpdateEvents);
    }
  };

  forceRefresh = currentTarget => {
    const raw = rbw2raw(currentTarget.toJSON());
    this.muxSetRaw(raw);
  };

  muxSetRaw = raw => {
    this._waitUpdateTarget = null;
    this.mutex(
      () => {
        this.setStateByRaw(raw);
        if (this._waitUpdateTarget) {
          this._lock = false;
          return this.muxSetRaw(this._waitUpdateTarget);
        }
      },
      () => {
        console.warn('setStateByRaw has been delayed', this);
        this._waitUpdateTarget = raw;
      }
    );
  };

  listenTargetYmap = rawYmap => {
    this.rawYmap = rawYmap;
    this.oprID = this.rawYmap.get(CHANGE_CLIENT);
    if (!this.oprID) {
      this.oprID = genKey();
      this.rawYmap.set(CHANGE_CLIENT, this.oprID);
    }
    this.undoManager = new Y.UndoManager(this.rawYmap, {
      trackedOrigins: this.trackedSet,
    });
    this.value = rbw2raw(this.rawYmap.toJSON());
    this.log('on :[onObserveDeep]', rawYmap, this.rawPath.join('.'));
    this.rawYmap.observeDeep(this.onObserveDeep); // observeDeep this editor's raw
  };

  undo = () => {
    if (!this.undoManager) return;
    this.doc.transact(() => {
      this.oprID = genKey();
      this.rawYmap.set(CHANGE_CLIENT, this.oprID);
      this.undoManager.undo();
    });
  };

  redo = () => {
    if (!this.undoManager) return;
    this.doc.transact(() => {
      this.oprID = genKey();
      this.rawYmap.set(CHANGE_CLIENT, this.oprID);
      this.undoManager.redo();
    });
  };

  bindEditor = editor => {
    // 支持异步绑定编辑器
    if (!editor || this.draftEditor) return;
    const draftEditor = editor.update ? editor : editor.editor;
    if (!draftEditor || !editor.componentDidUpdate) {
      return console.warn('editor must be Draft ref');
    }
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
      this._onChange &&
        (editor.onChange = function (editorState) {
          if (that.editorState === editorState) {
            if (that._lockFocus) that._lockFocus = false;
            return;
          }
          if (that._lockFocus) {
            editorState = EditorState.forceSelection(
              editorState,
              that.newSelection
            );
          }
          that._lockFocus = false;
          if (this !== editor) {
            that.onChange(editorState);
          }
          that._onChange.apply(editor, [editorState]);
          that.editorState = editorState;
          if (that._waitUpdateTarget) {
            that._lock = false;
            that.muxSetRaw(that._waitUpdateTarget);
          }
        });
      editor.componentDidUpdate = function (prevProps, prevState) {
        const editorState = editor.getEditorState();
        if (
          that.editorState !== editorState &&
          editorState !== prevProps.editorState
        ) {
          that.onChange(editorState);
          // console.log('componentDidUpdate.onChange');
          if (that._waitUpdateTarget) {
            that._lock = false;
            that.muxSetRaw(that._waitUpdateTarget);
          }
        }
        componentDidUpdate.apply(this, [prevProps, prevState]);
      };
    } else {
      this._update = editor.update; // listen to changes
      this._update &&
        (editor.update = (...args) => {
          this.onChange(args[0]);
          this._update.apply(editor, args);
          if (this._waitUpdateTarget) {
            this._lock = false;
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

  getEditorState = () => {
    return this.editorState || this.draftEditor.props.editorState;
  };

  setStateByRaw = raw => {
    const _onChange = this._update || this._onChange;
    if (!raw || !raw.blocks || !_onChange) return;
    const editorState = this.getEditorState();
    const selectionState = editorState.getSelection();
    const newEditorState = EditorState.createWithContent(convertFromRaw(raw));
    newEditorState.allowUndo = false;
    const isCollapsed = selectionState.isCollapsed();
    // console.log(selectionState.getHasFocus(), 'selectionState')
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
    const hasFocus = selectionState.getHasFocus();

    const newSelection = getNewSelection(
      { startKey, endKey, start, end, hasFocus },
      raw,
      contentState
    );
    this.log(
      'NewSelection ->>' + newSelection.serialize().split(',').join(' | ')
    );

    this.newSelection = newSelection;
    // this.localSelectionState = newSelection
    // console.log(this.shouldAcceptSelection);
    this.editorState = newSelection
      ? EditorState[
          isCollapsed || this.shouldAcceptSelection
            ? 'acceptSelection'
            : 'forceSelection'
        ](newEditorState, newSelection)
      : newEditorState;
    this._lockFocus = true;
    this.value = raw;
    this.editorState.allowUndo = false;
    // const now = Date.now()
    // console.log(now - this.now)
    // this.now = now
    _onChange.call(this.draftEditor, this.editorState);
  };

  releaseSelection = () => {
    this.shouldAcceptSelection = true;
  };

  isDetoryed = false;

  destroy = () => {
    // console.warn('y-darf-js is destoryed');
    this.getEditorContainer()?.removeEventListener(
      'mousedown',
      this.releaseSelection
    );
    this.isDetoryed = true;
    this.log('destroy: ' + this.rawPath.join('.'));
    this._update &&
      this.draftEditor &&
      (this.draftEditor.update = this._update);
    if (this._onChange) {
      this.draftEditor && (this.draftEditor.onChange = this._onChange);
      Reflect.deleteProperty(this.draftEditor, 'componentDidUpdate');
    }
    this.cancel?.();
    this.rawYmap && this.rawYmap.unobserveDeep(this.onObserveDeep);
    if (this.awareness !== null) {
      // @ts-ignore
      this.awareness.off('change', this.rerenderDecorations);
    }
  };
}
