// import * as error from 'lib0/error.js'
// import invariant from 'tiny-invariant';
import * as Y from 'yjs';
// import { Awareness } from 'y-protocols/awareness.js' // eslint-disable-line
import { convertFromRaw, convertToRaw, EditorState, genKey } from 'draft-js';
import {
  transRaw,
  isRaw,
  getNewSelection,
  changeYmapByDelta,
  toSyncElement,
  getTargetByPath,
  onTargetSync,
  toRawSharedData,
  getRaw,
} from './utils';
import { diffRaw, rbw2raw, raw2rbw } from './diff';
import _throttle from 'lodash/throttle';

const getRawBySharedData = (rawPath, ydoc) => {
  !Array.isArray(rawPath) && (rawPath = [rawPath]);
  const target = getTargetByPath(rawPath, ydoc);
  if (!target) return null;
  let rbw = null;
  let raw = null;
  try {
    rbw = target.toJSON();
    raw = rbw2raw(rbw);
    if (!isRaw(raw)) return null;
  } catch (error) {
    return null;
  }
  return raw;
};
const setRawToSharedData = (rawPath, ydoc, raw) => {
  !Array.isArray(rawPath) && (rawPath = [rawPath]);
  const target = getTargetByPath(rawPath, ydoc);
  if (!target) return console.log(`path:${rawPath} is undefined`);
  const rbw = raw2rbw(raw);
  ydoc.transact(() => {
    target.forEach((val, key) => target.delete(key));
    target.set(CHANGE_CLIENT, genKey());
    // const rawYmap = toRawSharedData(rbw)
    Object.entries(rbw).forEach(([key, val]) =>
      target.set(key, toSyncElement(val))
    );
  });
  console.log(target.toJSON(), 'target.toJSON()');
  return target;
};
export {
  toRawSharedData,
  setRawToSharedData,
  getRawBySharedData,
  getTargetByPath,
  onTargetSync,
  toSyncElement,
  getNewSelection,
  rbw2raw,
  raw2rbw,
};
const CHANGE_CLIENT = 'CHANGE_CLIENT'; // 用于识别是不是自己的更新
const editorMap = {};
export class DraftBinding {
  constructor(opts) {
    const {
      ydoc,
      rawPath: _rawPath,
      editor,
      provider,
      updatable = true,
      debug,
    } = opts;
    this.log = debug ? console.log : () => {};
    this.version = VERSION;
    this.provider = provider;
    let rawPath = _rawPath;
    !Array.isArray(rawPath) && (rawPath = [rawPath]);
    ydoc.getMap(rawPath[0]);
    this.doc = ydoc;
    this.clientID = this.doc.clientID;
    this.trackedSet = new Set([this.clientID, this]);
    this.awareness = provider.awareness;
    this._lock = false;
    this._updatable = !!updatable;
    this.isConnecting = provider.wsconnecting;
    this.onStatusChange = ({ status }) => {
      this.isConnecting = status === 'connecting';
    };
    provider.on('status', this.onStatusChange);

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
      const originOrpId = this.rawYmap.get(CHANGE_CLIENT);
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
      currentTarget && this.forceRefresh();
    };

    !provider.synced
      ? provider.on('sync', isSynced => {
          if (!isSynced) return;
          this.cancel = onTargetSync(this.rawPath, ydoc, rawYmap => {
            this.listenTargetYmap(rawYmap);
          });
        })
      : (this.cancel = onTargetSync(this.rawPath, ydoc, rawYmap => {
          this.listenTargetYmap(rawYmap);
        }));
    this.onChange = editorState =>
      this.mutex(
        () => {
          this.editorState = editorState;
          const raw = transRaw(convertToRaw(editorState.getCurrentContent()));
          if (!this.value) return (this.value = raw);
          const selection = editorState.getSelection();
          const selectData = this.getSectionData(selection);
          if (!this._updatable) return;
          // console.log(selection.serialize(), selectData, this.isCompositeMode());
          const allowUndo =
            this.editorState.allowUndo ?? this.editorState.getAllowUndo();
          if (this.shouldAcceptSelection && !selection.isCollapsed()) {
            this.shouldAcceptSelection = false;
          } // 释放控制
          editorMap[this.editorKey] = selectData.hasFocus;
          this.updateAwareness(selectData);
          const newJson = JSON.stringify(raw);
          const rawYmap = getTargetByPath(this.rawPath, ydoc);
          if (!rawYmap || this.isConnecting) return;
          if (this.rawYmap !== rawYmap && !this.listenTargetYmap(rawYmap)) {
            return;
          }
          if (this.oldJson === newJson) return; // console.log(newJson, oldJson)
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
          this.oldJson = newJson;
          this.value = JSON.parse(newJson);
        },
        () => {
          console.warn('onChange has been delayed', this);
        }
      );
    this.bindEditor(editor);
  }

  getSectionData = () => {
    const selection = this.getEditorState().getSelection();
    if (this.isCompositeMode() && this.selectData) return this.selectData;
    this.selectData = {
      anchorKey: selection.getAnchorKey(),
      anchorOffset: selection.getAnchorOffset(),
      focusKey: selection.getFocusKey(),
      focusOffset: selection.getFocusOffset(),
      isBackward: selection.getIsBackward(),
      hasFocus: selection.getHasFocus(),
    };
    return this.selectData;
  };

  updateAwareness = _throttle(selectData => {
    this.awareness.setLocalStateField('selection', selectData);
  }, 300);

  setUpdatable = val => {
    this._updatable = !!val;
    if (!!val && this._stopUpdateEvents) {
      this.onObserveDeep(this._stopUpdateEvents);
    }
  };

  forceRefresh = () => {
    const raw = rbw2raw(this.rawYmap.toJSON());
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
    const val = rbw2raw(rawYmap.toJSON());
    if (isRaw(val)) {
      this.value = val;
      this.oldJson = JSON.stringify(val);
    } else {
      this.value = getRaw();
      this.oldJson = JSON.stringify(val);
      rawYmap = setRawToSharedData(this.rawPath, this.doc, this.value);
      this.log('initRaw =>', this.value, this.rawPath.join('.'));
    }
    this.rawYmap?.unobserveDeep(this.onObserveDeep);
    this.rawYmap = rawYmap;
    this.oprID = this.rawYmap.get(CHANGE_CLIENT);
    if (!this.oprID) {
      this.oprID = genKey();
      this.rawYmap.set(CHANGE_CLIENT, this.oprID);
    }
    this.undoManager = new Y.UndoManager(this.rawYmap, {
      trackedOrigins: this.trackedSet,
    });
    this.log('on :[onObserveDeep]', rawYmap, this.rawPath.join('.'));
    this.rawYmap.observeDeep(this.onObserveDeep); // observeDeep this editor's raw
    return true;
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
    if (!editor) return;
    if (this.draftEditor) {
      console.warn(
        '[editor-change] bind other draftEditor, preEditor:',
        this.draftEditor,
        'newEditor:',
        editor
      );
    }
    const draftEditor = editor.update ? editor : editor.getEditorRef(); // 原始的draft-editor
    if (!draftEditor || !editor.componentDidUpdate) {
      return console.warn('editor must be Draft ref');
    }
    const isPluginEditor = !!editor.onChange;
    this.isPluginEditor = isPluginEditor;
    this.draftEditor = editor;
    this.editorKey = draftEditor.getEditorKey();
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

  isCompositeMode = () => this.getEditorState().isInCompositionMode();

  getEditorState = () => {
    return this.editorState || this.draftEditor.props.editorState;
  };

  setStateByRaw = raw => {
    const _onChange = this._update || this._onChange;
    if (!isRaw(raw) || !_onChange) return;
    if (this.isPluginEditor && !this.draftEditor.getEditorRef()) {
      return console.warn(
        'drafjsEditor Can`t be found it, please rebind the editor',
        this.draftEditor
      );
    }
    const editorState = this.getEditorState();
    const selectionState = editorState.getSelection();
    const newEditorState = EditorState.set(
      EditorState.createWithContent(convertFromRaw(raw)),
      { inCompositionMode: this.isCompositeMode() }
    );
    newEditorState.allowUndo = false;
    const isCollapsed = selectionState.isCollapsed();
    // console.log(selectionState.getHasFocus(), 'selectionState')
    const focusLength = Object.values(editorMap).filter(Boolean).length;
    // console.log(this.isCompositeMode(), 'isCompositeMode');
    if ((focusLength > 0 && !editorMap[this.editorKey]) || focusLength === 0) {
      this.editorState = newEditorState;
      this.value = raw;
      this.oldJson = JSON.stringify(raw);
      return _onChange.call(this.draftEditor, newEditorState);
    }
    this.setStateAndSelection(_onChange, newEditorState, isCollapsed, raw);
  };

  setStateAndSelection = (_onChange, newEditorState, isCollapsed, raw) => {
    const editorState = this.getEditorState();
    const contentState = editorState.getCurrentContent();
    const {
      anchorKey,
      focusKey,
      anchorOffset,
      focusOffset,
      isBackward,
      hasFocus,
    } = this.selectData || this.getSectionData();

    const startKey = isBackward ? focusKey : anchorKey;
    const endKey = isBackward ? anchorKey : focusKey;
    const start = isBackward ? focusOffset : anchorOffset;
    const end = isBackward ? anchorOffset : focusOffset;

    const newSelection = getNewSelection(
      { startKey, endKey, start, end, hasFocus },
      raw,
      contentState
    );
    this.log(
      'NewSelection ->>' + newSelection.serialize().split(',').join(' | '),
      hasFocus
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
    this.oldJson = JSON.stringify(raw);
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
    this.provider.off('status', this.onStatusChange);
    this.log('destroy: ' + this.rawPath.join('.'));
    this._update &&
      this.draftEditor &&
      (this.draftEditor.update = this._update);
    if (this._onChange) {
      this.draftEditor && (this.draftEditor.onChange = this._onChange);
      Reflect.deleteProperty(this.draftEditor, 'componentDidUpdate');
    }
    Reflect.deleteProperty(editorMap, this.editorKey);
    this.cancel?.();
    this.rawYmap && this.rawYmap.unobserveDeep(this.onObserveDeep);
  };
}
