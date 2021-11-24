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

import { convertFromRaw, SelectionState } from 'draft-js';
import { createEditorStateWithText } from '@draft-js-plugins/editor';

export const rawContent = {
  blocks: [
    {
      text: 'This is a Draft-based editor that supports TeX rendering.',
      type: 'unstyled',
      key: '9gm3s',
      depth: 0,
      inlineStyleRanges: [],
      entityRanges: [],
      data: {}
    },
    {
      text: '',
      key: '3s41d',
      type: 'unstyled',
      depth: 0,
      inlineStyleRanges: [],
      entityRanges: [],
      data: {}
    },
    {
      text: (
        'Each TeX block below is represented as a DraftEntity object and ' +
        'rendered using Khan Academy\'s KaTeX library.'
      ),
      key: 'dda23',
      type: 'unstyled',
      depth: 0,
      inlineStyleRanges: [],
      entityRanges: [],
      data: {}
    },
    {
      text: '',
      key: 'ee23x',
      type: 'unstyled',
      depth: 0,
      inlineStyleRanges: [],
      entityRanges: [],
      data: {}
    },
    {
      text: 'Click any TeX block to edit.',
      type: 'unstyled',
      key: '23dfs',
      depth: 0,
      inlineStyleRanges: [],
      entityRanges: [],
      data: {}
    },
    // {
    //   text: ' ',
    //   type: 'atomic',
    //   entityRanges: [{offset: 0, length: 1, key: 'first'}],
    // },
    {
      text: 'You can also insert a new TeX block at the cursor location.',
      type: 'unstyled',
      key: 'io3kj',
      depth: 0,
      inlineStyleRanges: [],
      entityRanges: [],
      data: {}
    },
    {
      text: '',
      key: 'ee23x',
      type: 'unstyled',
      depth: 0,
      inlineStyleRanges: [],
      entityRanges: [],
      data: {}
    },
    {
      text: '',
      key: 'cddc3',
      type: 'unstyled',
      depth: 0,
      inlineStyleRanges: [],
      entityRanges: [],
      data: {}
    },
    {
      text: '',
      key: 'vvd23',
      type: 'unstyled',
      depth: 0,
      inlineStyleRanges: [],
      entityRanges: [],
      data: {}
    },
    {
      text: '',
      key: 'mgh64',
      type: 'unstyled',
      depth: 0,
      inlineStyleRanges: [],
      entityRanges: [],
      data: {}
    },
    {
      text: '',
      key: '66vv4',
      type: 'unstyled',
      depth: 0,
      inlineStyleRanges: [],
      entityRanges: [],
      data: {}
    },
    {
      text: '',
      key: '65fse',
      type: 'unstyled',
      depth: 0,
      inlineStyleRanges: [],
      entityRanges: [],
      data: {}
    },
    {
      text: '',
      key: 'sde41',
      type: 'unstyled',
      depth: 0,
      inlineStyleRanges: [],
      entityRanges: [],
      data: {}
    },
    {
      text: '',
      key: '457wee',
      type: 'unstyled',
      depth: 0,
      inlineStyleRanges: [],
      entityRanges: [],
      data: {}
    },
  ],

  entityMap: {
    // first: {
    //   type: 'TOKEN',
    //   mutability: 'IMMUTABLE',
    //   data: {
    //     content: (
    //       '\\left( \\sum_{k=1}^n a_k b_k \\right)^{\\!\\!2} \\leq\n' +
    //       '\\left( \\sum_{k=1}^n a_k^2 \\right)\n' +
    //       '\\left( \\sum_{k=1}^n b_k^2 \\right)'
    //     ),
    //   },
    // },
  },
};
// text转RAW, key为xxxx，没有@
export const stringToRaw = (str) => {
  const contentRaw = convertToRaw(createEditorStateWithText(str || '').getCurrentContent())
  return contentRaw;
}
// 对方法进行封装，防止内部报错
export const tryCatchFunc = (fn, msg) =>
  function(...args) {
    try {
      return typeof fn === 'function' && fn.apply(this, args)
    } catch (error) {
      console.warn(msg || '方法报错', error)
    }
  }

export const mentions = [
  {
    name: 'Matthew Russell',
    id: '122',
    link: 'https://twitter.com/mrussell247',
    avatar:
      'https://pbs.twimg.com/profile_images/517863945/mattsailing_400x400.jpg',
  },
  {
    name: 'Julian Krispel-Samsel',
    id: '43',
    link: 'https://twitter.com/juliandoesstuff',
    avatar: 'https://avatars2.githubusercontent.com/u/1188186?v=3&s=400',
  },
  {
    name: 'Jyoti Puri',
    id: '433',
    link: 'https://twitter.com/jyopur',
    avatar: 'https://avatars0.githubusercontent.com/u/2182307?v=3&s=400',
  },
  {
    name: 'Max Stoiber',
    id: '233',
    link: 'https://twitter.com/mxstbr',
    avatar: 'https://avatars0.githubusercontent.com/u/7525670?s=200&v=4',
  },
  {
    name: 'Nik Graf',
    link: 'https://twitter.com/nikgraf',
    avatar: 'https://avatars0.githubusercontent.com/u/223045?v=3&s=400',
  },
  {
    name: 'Pascal Brandt',
    id: '123',
    link: 'https://twitter.com/psbrandt',
    avatar:
      'https://pbs.twimg.com/profile_images/688487813025640448/E6O6I011_400x400.png',
  },
];
