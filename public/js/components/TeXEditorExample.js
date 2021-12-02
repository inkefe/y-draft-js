/**
 * Copyright (c) Facebook, Inc. and its affiliates. All rights reserved.
 *
 * This file provided by Facebook is for non-commercial testing and evaluation
 * purposes only. Facebook reserves all rights not expressly granted.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * FACEBOOK BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
 * ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import Draft, {
  Modifier,
  SelectionState,
  KeyBindingUtil,
  getDefaultKeyBinding,
} from 'draft-js';
import { Map } from 'immutable';
import React from 'react';
import faker from 'faker';
import Editor, { createEditorStateWithText } from '@draft-js-plugins/editor';
import createMentionPlugin, {
  defaultSuggestionsFilter,
} from '@draft-js-plugins/mention';
import createInlineToolbarPlugin, {
  Separator,
} from '@draft-js-plugins/inline-toolbar';
import HeadlinesButton from './HeadlinesButton';
import {
  ItalicButton,
  BoldButton,
  UnderlineButton,
  CodeButton,
  UnorderedListButton,
  OrderedListButton,
  BlockquoteButton,
  CodeBlockButton,
} from '@draft-js-plugins/buttons';
import TeXBlock from './TeXBlock';
import { removeTeXBlock } from '../modifiers/removeTeXBlock';
import { mentions } from '../data/content';
const { EditorState, RichUtils, convertToRaw, convertFromRaw } = Draft;

const valueToEditorState = value => {
  let editorState = null;
  value = value || '';
  if (typeof value === 'string') {
    editorState = createEditorStateWithText(value);
  } else {
    if (typeof value !== 'object' || !Array.isArray(value.blocks)) return;
    else {
      editorState = EditorState.createWithContent(convertFromRaw(value));
    }
  }
  return editorState || EditorState.createEmpty();
};

const inlineToolbarPlugin = createInlineToolbarPlugin();
const { InlineToolbar } = inlineToolbarPlugin;
class TeXEditorExample extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      editorState: valueToEditorState(props.defaultValue),
      liveTeXEdits: Map(),
      open: false,
      isMock: false,
      isRemove: false,
      suggestions: mentions,
    };

    const mentionPlugin = createMentionPlugin();
    // eslint-disable-next-line no-shadow
    const { MentionSuggestions } = mentionPlugin;
    // eslint-disable-next-line no-shadow
    const plugins = [mentionPlugin, inlineToolbarPlugin];
    this.plugins = plugins;
    this.MentionSuggestions = MentionSuggestions;

    this._blockRenderer = block => {
      if (block.getType() === 'atomic') {
        return {
          component: TeXBlock,
          editable: false,
          props: {
            onStartEdit: blockKey => {
              const { liveTeXEdits } = this.state;
              this.setState({ liveTeXEdits: liveTeXEdits.set(blockKey, true) });
            },
            onFinishEdit: (blockKey, newContentState) => {
              const { liveTeXEdits } = this.state;
              this.setState({
                liveTeXEdits: liveTeXEdits.remove(blockKey),
                editorState: EditorState.createWithContent(newContentState),
              });
            },
            onRemove: blockKey => this._removeTeX(blockKey),
          },
        };
      }
      return null;
    };

    this._focus = () => this.editorRef.focus();
    this._onChange = editorState => {
      this.setState({ editorState });
      const { onChange } = this.props;
      onChange && onChange(editorState);
    };

    this._removeTeX = blockKey => {
      const { editorState, liveTeXEdits } = this.state;
      this.setState({
        liveTeXEdits: liveTeXEdits.remove(blockKey),
        editorState: removeTeXBlock(editorState, blockKey),
      });
    };

    this.consoleRaw = () => {
      console.log(convertToRaw(this.state.editorState.getCurrentContent()));
      // this.setState({
      //   liveTeXEdits: Map(),
      //   editorState: insertTeXBlock(this.state.editorState),
      // });
    };
  }

  handleKeyCommand = (command, editorState) => {
    if (command === 'y-draft-undo') {
      this.props.draftBind?.undo();
      return 'handled';
    }
    if (command === 'y-draft-redo') {
      this.props.draftBind?.redo();
      return 'handled';
    }
    const newState = RichUtils.handleKeyCommand(editorState, command);
    if (newState) {
      this._onChange(newState);
      return true;
    }
    return false;
  };

  myKeyBindingFn(e) {
    const cmd = getDefaultKeyBinding(e);
    if (cmd === 'undo') return 'y-draft-undo';
    if (cmd === 'redo') return 'y-draft-redo';
    return cmd;
  }

  mockInsertText = () => {
    const { isMock } = this.state;
    this.setState({ isMock: !isMock });
    if (!isMock) {
      this.timer = window.setInterval(this.autoInsertText, 3000);
    } else {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  };

  autoInsertText = () => {
    const { editorState, isRemove } = this.state;
    if (isRemove) {
      return this.autoRemoveText();
    }
    const content = editorState.getCurrentContent();
    const blocks = content.getBlocksAsArray().map(block => ({
      key: block.getKey(),
      length: block.getLength(),
    }));
    const number = faker.datatype.number({
      min: 0,
      max: blocks.length - 1,
    });
    const anchorOffset = faker.datatype.number({
      min: 0,
      max: blocks[number].length - 1,
    });
    const isSpace = faker.datatype.number({
      min: 0,
      max: 8,
    });
    const randomChar =
      isSpace < 2
        ? ' '
        : String.fromCharCode(
            faker.datatype.number({
              min: 32,
              max: 126,
            })
          );

    const newContentState = Modifier.insertText(
      content,
      new SelectionState({
        anchorKey: blocks[number].key,
        focusKey: blocks[number].key,
        anchorOffset,
        focusOffset: anchorOffset,
      }),
      randomChar === '`' ? '*' : randomChar
    );
    this.editorRef.editor.update(
      EditorState.push(editorState, newContentState, 'insert-characters')
    );
  };

  toggleAction = () => {
    const { isRemove } = this.state;
    this.setState({ isRemove: !isRemove });
  };

  autoRemoveText = () => {
    const { editorState } = this.state;
    const content = editorState.getCurrentContent();
    const blocks = content.getBlocksAsArray().map(block => ({
      key: block.getKey(),
      length: block.getLength(),
    }));
    const number = faker.datatype.number({
      min: 0,
      max: blocks.length - 1,
    });
    const anchorOffset = faker.datatype.number({
      min: 0,
      max: blocks[number].length - 1,
    });
    if (content.getPlainText().replace(/\n/g, '').length === 0) {
      this.mockInsertText();
    }
    const newContentState = Modifier.removeRange(
      content,
      new SelectionState({
        anchorKey: blocks[number].key,
        focusKey: blocks[number].key,
        anchorOffset,
        focusOffset: anchorOffset + 1,
      })
    );
    const editorStateNew = EditorState.push(
      editorState,
      newContentState,
      'remove-characters'
    );
    editorStateNew.allowUndo = false; // undo [y-draft-js]
    this.editorRef.editor.update(editorStateNew);
    console.log(editorStateNew, editorStateNew.allowUndo);
  };

  componentDidMount() {
    this.props.onRef && (this.props.onRef.current = this.editorRef);
  }

  componentDidUpdate(prevProps, prevState) {
    const newJson = JSON.stringify(this.props.defaultValue);
    const oldJson = JSON.stringify(prevProps.defaultValue);
    // console.log('componentDidUpdate', newJson === oldJson);
    if (newJson !== oldJson) {
      setTimeout(() => {
        this._onChange(
          EditorState.createWithContent(convertFromRaw(this.props.defaultValue))
        );
      }, 0);
    }
  }

  onOpenChange = open => this.setState({ open });

  onSearchChange = value => {
    if (!value.value) return this.onOpenChange(false);
    this.setState({
      suggestions: defaultSuggestionsFilter(value, mentions),
    });
  };

  /**
   * While editing TeX, set the Draft editor to read-only. This allows us to
   * have a textarea within the DOM.
   */
  render() {
    const { MentionSuggestions, plugins } = this;
    const { editorState, liveTeXEdits, open, suggestions, isMock, isRemove } =
      this.state;
    const { isOnline } = this.props;
    return (
      <div className={`TexEditor-container ${isOnline ? '' : 'bgred'}`}>
        <div className='TeXEditor-root'>
          <div className='TeXEditor-editor' onClick={this._focus}>
            <Editor
              blockRendererFn={this._blockRenderer}
              editorState={editorState}
              handleKeyCommand={this.handleKeyCommand}
              keyBindingFn={this.myKeyBindingFn}
              onChange={this._onChange}
              placeholder='Start a document...'
              plugins={plugins}
              readOnly={liveTeXEdits.count()}
              ref={ref => (this.editorRef = ref)}
            />
          </div>
          <MentionSuggestions
            open={open}
            onOpenChange={this.onOpenChange}
            suggestions={suggestions}
            onSearchChange={this.onSearchChange}
            onAddMention={() => {
              // get the mention object selected
            }}
          />
          <InlineToolbar>
            {
              // may be use React.Fragment instead of div to improve perfomance after React 16
              externalProps => (
                <div>
                  <BoldButton {...externalProps} />
                  <ItalicButton {...externalProps} />
                  <UnderlineButton {...externalProps} />
                  <CodeButton {...externalProps} />
                  <Separator {...externalProps} />
                  <HeadlinesButton {...externalProps} />
                  <UnorderedListButton {...externalProps} />
                  <OrderedListButton {...externalProps} />
                  <BlockquoteButton {...externalProps} />
                  <CodeBlockButton {...externalProps} />
                </div>
              )
            }
          </InlineToolbar>
        </div>
        <button onClick={this.consoleRaw} className='TeXEditor-insert'>
          {'console raw'}
        </button>

        <button onClick={this.toggleAction} className='remove-button'>
          {isRemove ? 'remove char' : 'insert char'}
        </button>
        <button onClick={this.mockInsertText} className='insert-button'>
          {isMock ? 'stop mock...' : 'mock input'}
        </button>
      </div>
    );
  }
}
export default React.forwardRef((props, ref) => (
  <TeXEditorExample {...props} onRef={ref} />
));
// export default TeXEditorExample
