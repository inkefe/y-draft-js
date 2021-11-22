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

'use strict';

import Draft from 'draft-js';
import {Map} from 'immutable';
import React from 'react';
import Editor from '@draft-js-plugins/editor';
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
import {insertTeXBlock} from '../modifiers/insertTeXBlock';
import {removeTeXBlock} from '../modifiers/removeTeXBlock';
import { mentions } from '../data/content';
var { EditorState, RichUtils, convertToRaw, convertFromRaw} = Draft;


const inlineToolbarPlugin = createInlineToolbarPlugin();
const { InlineToolbar } = inlineToolbarPlugin;
class TeXEditorExample extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      editorState: EditorState.createWithContent(convertFromRaw(props.defaultValue)),
      liveTeXEdits: Map(),
      open: false,
      suggestions: mentions
    };

    const mentionPlugin = createMentionPlugin();
    // eslint-disable-next-line no-shadow
    const { MentionSuggestions } = mentionPlugin;
    // eslint-disable-next-line no-shadow
    const plugins = [ mentionPlugin, inlineToolbarPlugin];
    this.plugins = plugins;
    this.MentionSuggestions = MentionSuggestions;

    this._blockRenderer = (block) => {
      if (block.getType() === 'atomic') {
        return {
          component: TeXBlock,
          editable: false,
          props: {
            onStartEdit: (blockKey) => {
              var {liveTeXEdits} = this.state;
              this.setState({liveTeXEdits: liveTeXEdits.set(blockKey, true)});
            },
            onFinishEdit: (blockKey, newContentState) => {
              var {liveTeXEdits} = this.state;
              this.setState({
                liveTeXEdits: liveTeXEdits.remove(blockKey),
                editorState:EditorState.createWithContent(newContentState),
              });
            },
            onRemove: (blockKey) => this._removeTeX(blockKey),
          },
        };
      }
      return null;
    };

    this._focus = () => this.editorRef.focus();
    this._onChange = (editorState) => {
      this.setState({editorState})
      const { onChange } = this.props
      onChange && onChange(editorState)
    };

    this._handleKeyCommand = (command, editorState) => {
      var newState = RichUtils.handleKeyCommand(editorState, command);
      if (newState) {
        this._onChange(newState);
        return true;
      }
      return false;
    };

    this._removeTeX = (blockKey) => {
      var {editorState, liveTeXEdits} = this.state;
      this.setState({
        liveTeXEdits: liveTeXEdits.remove(blockKey),
        editorState: removeTeXBlock(editorState, blockKey),
      });
    };

    this._insertTeX = () => {
      console.log(convertToRaw(this.state.editorState.getCurrentContent()));
      // this.setState({
      //   liveTeXEdits: Map(),
      //   editorState: insertTeXBlock(this.state.editorState),
      // });
    };
  }

  componentDidMount () {
    this.props.onRef && (this.props.onRef.current = this.editorRef)
    this.editorRef.setStateByRaw = this.setStateByRaw
  }

  componentDidUpdate(prevProps, prevState) {
    const newJson = JSON.stringify(this.props.defaultValue)
    const oldJson = JSON.stringify(prevProps.defaultValue)
    // console.log('componentDidUpdate', newJson === oldJson);
    if (newJson !== oldJson) {
      setTimeout(() => {
        this._onChange(EditorState.createWithContent(convertFromRaw(this.props.defaultValue)))
      }, 0)
    }
  }

  onOpenChange = (open) => this.setState({open});

  onSearchChange = (value) => {
    if(!value.value) return this.onOpenChange(false)
    this.setState({
      suggestions: defaultSuggestionsFilter(value, mentions),
    })
  }
  /**
   * While editing TeX, set the Draft editor to read-only. This allows us to
   * have a textarea within the DOM.
   */
  render() {
    const { MentionSuggestions, plugins } = this
    const { editorState, liveTeXEdits, open, suggestions } = this.state;
    return (
      <div className="TexEditor-container">
        <div className="TeXEditor-root">
          <div className="TeXEditor-editor" onClick={this._focus}>
            <Editor
              blockRendererFn={this._blockRenderer}
              editorState={editorState}
              handleKeyCommand={this._handleKeyCommand}
              onChange={this._onChange}
              placeholder="Start a document..."
              plugins={plugins}
              readOnly={liveTeXEdits.count()}
              ref={(ref) => (this.editorRef = ref)}
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
              (externalProps) => (
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
        <button onClick={this._insertTeX} className="TeXEditor-insert">
          {'console raw'}
        </button>
      </div>
    );
  }
}
export default React.forwardRef((props, ref) => <TeXEditorExample {...props} onRef={ref}/>)
// export default TeXEditorExample
