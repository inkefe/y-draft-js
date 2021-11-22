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
export class DraftBinding {
  constructor(ymap, key = 'raw', editor, provider) {
    this.editor = editor
    this.doc = ymap.doc
    this.ymap = ymap
    this.awareness = provider.awareness
    this.mux = createMutex()
    this.rawKey = key
    console.log('DraftBinding', ymap, editor, provider);
    // editor._onSelect = e => {
    //   editor._onSelect(e)
    //   this._onSelect(e)
    // }
    // this.value = rbw2raw(ymap.get(key)?.toJSON())
    console.log(this.value, key);
    // ymap.doc.on('afterTransaction', update => {
    //   console.log(update, 'afterTransaction');
    // })
    ymap.observeDeep(event => this.mux(() => {
      let currentTarget = null
      event.forEach(item => {
        // console.log(item, 'observeDeep');
        const { path } = item
        if(path[0] === this.rawKey) {
          currentTarget = item.currentTarget
          // 
          // hasChange = true
        }
        item.changes.keys.forEach((change, key) => {
          // if (change.action === 'add') {
          //   console.log(`Property "${key}" was added. Initial value: `, ymap.get(key))
          // } else if (change.action === 'update') {
          //   console.log(`Property "${key}" was updated. New value: `, ymap.get(key), `. Previous value: `, change.oldValue)
          // } else if (change.action === 'delete') {
          //   console.log(`Property "${key}" was deleted. New value: undefined. Previous value: `, change.oldValue)
          // }
          // const rbw = ymap.get(key).toJSON()
          // const raw = rbw2raw(rbw)
          // console.log(item, 'observeDeep');
        })
      })
      currentTarget && this.setStateByRaw(getRawSharedByData(currentTarget, this.rawKey))
      // console.log('delta:', event)
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
  onChange = (editorState) => {
    const raw = transRaw(convertToRaw(editorState.getCurrentContent()))
    if (!this.value) return (this.value = raw)
    const newJson = JSON.stringify(raw)
    const oldJson = JSON.stringify(this.value)
    if (oldJson === newJson) return // console.log(newJson, oldJson)
    const delta = diffRaw(this.value, raw)
    changeYmapByDelta(delta, this.ymap.get(this.rawKey))
    this.value = JSON.parse(newJson)
    // LOCAL_OPERATIONS.set(this.editor, this.value)
  }

  setStateByRaw = (raw) => {
    const _onChange = this.editor.props.onChange
    this.value = raw
    if (!raw || !raw.blocks || !_onChange) return
    const editorState = this.getEditorState()
    const selectionState = editorState.getSelection();
    const newEditorState = EditorState.push(editorState, convertFromRaw(raw), 'sycn-change')
    // if (!selectionState.getHasFocus()) {
    //   console.log('notFocus');
    //   return _onChange(newEditorState, true);
    // }
    const contentState = editorState.getCurrentContent();
    const startKey = selectionState.getStartKey();
    const endKey = selectionState.getEndKey();
    const start = selectionState.getStartOffset();
    const end = selectionState.getEndOffset();
    const newSelection = getNewSelection({ startKey, endKey, start, end }, raw, contentState)

    _onChange(EditorState.forceSelection(newEditorState, newSelection), true);
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
