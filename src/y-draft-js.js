import * as Y from 'yjs'
import * as error from 'lib0/error.js'
// import invariant from 'tiny-invariant';
import { createMutex } from 'lib0/mutex.js'
import { Awareness } from 'y-protocols/awareness.js' // eslint-disable-line
import { convertFromRaw, convertToRaw, EditorState, SelectionState } from 'draft-js';
import { transRaw, getNewSelection, changeYmapByDelta, toRawSharedData, toSyncElement } from './utils'
import { diffRaw, rbw2raw } from './diff'

const LOCAL_OPERATIONS = new WeakMap();
const getRawSharedByData = (ymap, contenField) => {    
  return rbw2raw(ymap.get(contenField).toJSON())
}
export { toRawSharedData, getRawSharedByData }
const CHANGE_CLIENT = 'CHANGE_CLIENT'
export class DraftBinding {
  constructor(opts) {
    const { ymap, filed, editor, provider, parmas } = opts
    this.editor = editor
    this.doc = ymap.doc
    this.ymap = ymap
    this.awareness = provider.awareness
    this.mux = createMutex()
    this.rawKey = filed
    console.log('DraftBinding', ymap.get(filed), editor, provider);
    // editor._onSelect = e => {
    //   editor._onSelect(e)
    //   this._onSelect(e)
    // }
    // this.value = rbw2raw(ymap.get(key)?.toJSON())
    console.log(this.value, filed);
    // ymap.doc.on('afterTransaction', update => {
    //   console.log(update, 'afterTransaction');
    // })
    // ymap.set(CHANGE_CLIENT, Math.random())
    ymap.observeDeep(event => this.mux(() => {
      let currentTarget = null
      event.forEach(item => {
        const { path } = item
        if(path[0] === this.rawKey && this.oprID !== item.currentTarget.get(this.rawKey).get(CHANGE_CLIENT)) { // 自己的更改不用更新
          currentTarget = item.currentTarget
        }
      })
      currentTarget && this.setStateByRaw(getRawSharedByData(currentTarget, this.rawKey))
    }))

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

    this.onChange = editorState => this.mux(() =>{
      const raw = transRaw(convertToRaw(editorState.getCurrentContent()))
      if (!this.value) return (this.value = raw)
      const newJson = JSON.stringify(raw)
      const oldJson = JSON.stringify(this.value)
      if (oldJson === newJson) return // console.log(newJson, oldJson)
      const delta = diffRaw(this.value, raw)
      changeYmapByDelta(delta, this.ymap.get(this.rawKey), (ymap) => {
        this.oprID = Math.random()
        ymap.set(CHANGE_CLIENT, this.oprID)
      })
      this.value = JSON.parse(newJson)
    })
    const _update = this.editor.update // listen to changes
    _update && (this.editor.update = (...args) => {
      this.onChange.apply(this, args)
      _update.apply(this.editor, args)
    })
    const _onChange = this.editor.onChange
    _onChange && (this.editor.onChange = (...args) => {
      this.onChange.apply(this, args)
      _onChange.apply(this.editor, args)
    })
  }

  oprID = Math.random()

  _onSelect = e => {
    const editorState = this.getEditorState()
    const selection = editorState.getSelection()
    let anchor = monacoModel.getOffsetAt(sel.getStartPosition())
    let head = monacoModel.getOffsetAt(sel.getEndPosition())
    if (sel.getDirection() === monaco.SelectionDirection.RTL) {
      const tmp = anchor
      anchor = head
      head = tmp
    }
    this.awareness.setLocalStateField('selection', {
      anchor: Y.createRelativePositionFromTypeIndex(this.ytext, anchor),
      head: Y.createRelativePositionFromTypeIndex(this.ytext, head)
    })
  }
  getEditorState = () => {
    return this.editor.props.editorState
  }

  setStateByRaw = (raw) => {
    const _onChange = this.editor.props.onChange
    this.value = raw
    if (!raw || !raw.blocks || !_onChange) return
    const editorState = this.getEditorState()
    const selectionState = editorState.getSelection();
    const newEditorState = EditorState.push(editorState, convertFromRaw(raw), 'sycn-change')
    if (!selectionState.getHasFocus()) {
      return _onChange(newEditorState);
    }
    const contentState = editorState.getCurrentContent();
    const startKey = selectionState.getStartKey();
    const endKey = selectionState.getEndKey();
    const start = selectionState.getStartOffset();
    const end = selectionState.getEndOffset();
    const newSelection = getNewSelection({ startKey, endKey, start, end }, raw, contentState)

    _onChange(EditorState.forceSelection(newEditorState, newSelection));
  }

  decorations = new Map()

  // 渲染光标
  rerenderDecorations = () => {
    // const currentDecorations = this.decorations.get(this.editor) || []
    const newDecorations = []
    this.awareness.getStates().forEach((state, clientID) => {
      if (clientID !== this.doc.clientID && state.selection != null && state.selection.anchor != null && state.selection.head != null) {
        const anchorAbs = Y.createAbsolutePositionFromRelativePosition(state.selection.anchor, this.doc)
        const headAbs = Y.createAbsolutePositionFromRelativePosition(state.selection.head, this.doc)
        if (anchorAbs !== null && headAbs !== null && anchorAbs.type === ytext && headAbs.type === ytext) {
          let start, end, afterContentClassName, beforeContentClassName
          if (anchorAbs.index < headAbs.index) {
            start = monacoModel.getPositionAt(anchorAbs.index)
            end = monacoModel.getPositionAt(headAbs.index)
            afterContentClassName = 'yRemoteSelectionHead'
            beforeContentClassName = null
          } else {
            start = monacoModel.getPositionAt(headAbs.index)
            end = monacoModel.getPositionAt(anchorAbs.index)
            afterContentClassName = null
            beforeContentClassName = 'yRemoteSelectionHead'
          }
          // newDecorations.push({
          //   range: new SelectionState(start.lineNumber, start.column, end.lineNumber, end.column),
          //   options: {
          //     className: 'yRemoteSelection',
          //     afterContentClassName,
          //     beforeContentClassName
          //   }
          // })
        }
      }
    })
    // this.decorations.set(editor, editor.deltaDecorations(currentDecorations, newDecorations))
  }

  destroy () {
    // this._monacoChangeHandler.dispose()
    // this.ytext.unobserve(this._ytextObserver)
    // this.doc.off('beforeAllTransactions', this._beforeTransaction)
    if (this.awareness !== null) {
      // @ts-ignore
      this.awareness.off('change', this.rerenderDecorations)
    }
  }
}
