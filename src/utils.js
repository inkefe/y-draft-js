import * as Y from 'yjs';
import Dmp from 'diff-match-patch';
import { SelectionState } from 'draft-js';

const transRaw = raw => {
  if (!raw) return raw;
  const reg = /,"(data|entityMap)":({}|\[\])/g;
  const res = JSON.parse(
    JSON.stringify(raw).replace(reg, (_, $1) => `,"${$1}":{}`)
  );
  return res;
};
// 对方法进行封装，防止内部报错
export const tryCatchFunc = (fn, msg) =>
  function (...args) {
    try {
      return typeof fn === 'function' && fn.apply(this, args);
    } catch (error) {
      console.warn(msg || '方法报错', error);
    }
  };
const DMP = new Dmp();
// 计算序号, 默认不跟随内容更改
const diffIndex = (diffArr, index, needFlow) => {
  const curIndex = DMP.diff_xIndex(diffArr, index);
  if (needFlow) return curIndex;
  if (index === 0) return 0;
  const lastIndex = DMP.diff_xIndex(diffArr, index - 1);
  if (lastIndex === index - 1 && curIndex !== index) return index;
  return curIndex;
};
const getStringDiffArray = (txt1, txt2) => {
  return DMP.diff_main(txt1, txt2);
};

export const transToObj = raw =>
  typeof raw === 'string' && raw.match(/^({|\[)/)
    ? tryCatchFunc(raw => {
        return JSON.parse(raw);
      })(raw) || raw
    : raw;

// RAW转text
export const rawToText = raw => {
  raw = transToObj(raw);
  if (!raw) return '';
  return raw.blocks
    ? raw.blocks.reduce(
        (a, b, index) => ({
          text: `${a.text}${index > 0 ? '\n' : ''}${b.text}`,
        }),
        { text: '' }
      ).text
    : '';
};

const getNewSelection = (
  { startKey, endKey, start, end },
  raw,
  contentState
) => {
  const oldBlockArray = contentState.getBlocksAsArray();
  const newParmas = { hasFocus: true };
  const isCollapsed = startKey === endKey && start === end;
  const { blocks } = raw;
  const editorText = rawToText(raw);
  const oldEditorText = contentState.getPlainText();
  const textDiff = getStringDiffArray(oldEditorText, editorText);
  // console.log(startKey, endKey, start, end);
  if (textDiff.length === 1 && textDiff[0][0] === 0) {
    // 文本内容没有变化，保留原来的选择状态
    return new SelectionState({
      anchorKey: startKey,
      focusKey: endKey,
      anchorOffset: start,
      focusOffset: end,
      hasFocus: true,
    });
  }
  const blockKeys = blocks.map(block => block.key);
  const startIndex = blockKeys.indexOf(startKey);
  if (startKey === endKey && startIndex >= 0) {
    newParmas.anchorKey = startKey;
    newParmas.focusKey = endKey;
  }
  const endIndex = blockKeys.indexOf(endKey);
  const oldBlockKeys = oldBlockArray.map(block => block.key);
  if (startIndex < 0 || endIndex < 0 || startIndex > endIndex) {
    // 起点和终点某一个被删掉了，或者拖拽改变了他们的前后顺序
    const oldStartIndex = oldBlockKeys.indexOf(startKey);
    const oldEndIndex = oldBlockKeys.indexOf(endKey);
    const preBlockKeys = oldBlockKeys.slice(oldStartIndex, oldEndIndex + 1); // length 可能为1，但肯定不为0
    // console.log('1', preBlockKeys.join(), blockKeys.join());
    while (
      preBlockKeys.length > 0 &&
      (blockKeys.indexOf(preBlockKeys[0]) < 0 ||
        // eslint-disable-next-line no-unmodified-loop-condition
        (blockKeys.indexOf(preBlockKeys[0]) > endIndex && endIndex >= 0))
    ) {
      preBlockKeys.shift(); // 从上向下找起点
    }
    // console.log('2', preBlockKeys.join());
    if (startIndex < 0 || endIndex < 0) {
      // 起点或终点被删掉了
      if (preBlockKeys.length > 0) {
        // 如果有起点
        newParmas.anchorKey = preBlockKeys[0];
        startIndex < 0 && (newParmas.anchorOffset = 0);
        while (
          preBlockKeys.length > 0 &&
          (blockKeys.indexOf(preBlockKeys[preBlockKeys.length - 1]) < 0 ||
            blockKeys.indexOf(preBlockKeys[preBlockKeys.length - 1]) <
              startIndex)
        ) {
          preBlockKeys.pop(); // 从下向上找终点
        }
        // console.log('3', preBlockKeys.join());
        if (preBlockKeys.length > 0) {
          // 如果有终点
          newParmas.focusKey = preBlockKeys[preBlockKeys.length - 1];
          endIndex < 0 &&
            (newParmas.focusOffset =
              blocks[blockKeys.indexOf(newParmas.focusKey)].text.length);
        } else {
          // 终点被删掉了, 选择key为anchorKey，lenght为anchorKey所在的length
          newParmas.focusKey = newParmas.anchorKey;
          newParmas.focusOffset =
            blocks[blockKeys.indexOf(newParmas.focusKey)].text.length;
        }
      } else {
        // 之前选中区域全删没了, 现存的最近一行的最后一个字符
        const startBlocks = oldBlockKeys
          .slice(0, oldStartIndex)
          .filter(key => blockKeys.indexOf(key) >= 0);
        const endBlocks = oldBlockKeys
          .slice(oldEndIndex + 1)
          .filter(key => blockKeys.indexOf(key) >= 0);
        if (endBlocks.length === 0 && startBlocks.length === 0) {
          // 全都找不到了，聚焦到最后
          newParmas.anchorKey = blocks[blocks.length - 1].key;
          newParmas.anchorOffset = blocks[blocks.length - 1].text.length;
        } else {
          // 先找到最近的一个
          newParmas.anchorKey =
            startBlocks.length > 0
              ? startBlocks[startBlocks.length - 1]
              : endBlocks[0];
          newParmas.anchorOffset =
            blocks[blockKeys.indexOf(newParmas.anchorKey)].text.length;
        }
        newParmas.focusKey = newParmas.anchorKey;
        newParmas.focusOffset = newParmas.anchorOffset;
      }
    } else {
      // 选择除了被移动后剩下的block
      newParmas.anchorKey = preBlockKeys[0];
      newParmas.anchorOffset = 0;
      newParmas.focusKey = endKey;
    }
  }
  newParmas.anchorKey = newParmas.anchorKey ?? startKey;
  newParmas.focusKey = newParmas.focusKey ?? endKey;
  if (
    newParmas.anchorOffset !== undefined &&
    newParmas.focusOffset !== undefined
  ) {
    // console.log(newParmas);
    return new SelectionState(newParmas);
  }
  // 上述的newParmas缺少anchorOffset和focusOffset，需要进一步根据start和end来调整计算
  // startKey也是新选择的startKey，endKey也是新选择的endKey
  if (newParmas.anchorOffset === undefined) {
    const anchorText = blocks[blockKeys.indexOf(newParmas.anchorKey)].text;
    const oldAnchorText =
      oldBlockArray[oldBlockKeys.indexOf(newParmas.anchorKey)].text;
    const anchorDiff = getStringDiffArray(oldAnchorText, anchorText);
    // console.log(anchorDiff, start);
    newParmas.anchorOffset = diffIndex(anchorDiff, start, !isCollapsed);
    if (startKey === endKey) {
      newParmas.focusOffset = isCollapsed
        ? newParmas.anchorOffset
        : diffIndex(anchorDiff, end);
    }
  }
  if (newParmas.focusOffset === undefined) {
    const focusText = blocks[blockKeys.indexOf(newParmas.focusKey)].text;
    const oldFocusText =
      oldBlockArray[oldBlockKeys.indexOf(newParmas.focusKey)].text;
    const focusDiff = getStringDiffArray(oldFocusText, focusText);
    newParmas.focusOffset = diffIndex(focusDiff, end);
  }
  // console.log(newParmas);
  return new SelectionState(newParmas);
};
const getDeltaArray = (diff, path = []) => {
  let deltaArray = [];
  if (!Array.isArray(diff) && !diff._t) {
    // 没到叶子节点
    Object.keys(diff).forEach(key => {
      deltaArray = deltaArray.concat(getDeltaArray(diff[key], [...path, key]));
    });
  } else {
    deltaArray = getOperationByDiff(diff, path);
  }
  return deltaArray;
};
/**
 *
 * @param {*} diff
 * @param {Array} path
 * @returns {Array}
 *  {
 *  type: 'string'|'object'|'array'|'number',
 *  action: 'insert'|'delete'|'replace'|'plus'|'subtract'|'move',
 *  path: [],
 *  index: 0,
 *  length: 0,
 *  value: 'a'
 *  }
 */
const getOperationByDiff = (diff, path) => {
  if (diff._t === 'a') {
    // array
    return Object.keys(diff)
      .reverse()
      .map(key => {
        if (key === '_t') return null;
        const res = {
          type: 'array',
          path,
        };
        const isModify = !Array.isArray(diff[key]);
        if (key[0] === '_') {
          return diff[key][2] === 3
            ? {
                // move
                ...res,
                action: 'move',
                index: ~~key.substr(1),
                value: diff[key][1], // new index
              }
            : {
                ...res,
                action: 'delete',
                index: ~~key.substr(1),
                length: 1,
              };
        }
        if (isModify) {
          return getDeltaArray(diff[key], [...path, key]);
        }
        return {
          ...res,
          action: 'insert',
          index: ~~key,
          value: diff[key].map(item => toSyncElement(item, [...path, key])),
        };
      })
      .filter(Boolean)
      .reduce((prev, curr) => {
        return Array.isArray(curr) ? [...prev, ...curr] : [...prev, curr];
      }, []);
  }
  if (diff[2] === 2 && diff.length === 3) {
    // text of block
    const { diffs: textDelta, start1 } = DMP.patch_fromText(diff[0])[0];
    return textDelta
      .reduce((res, item) => {
        let index = 0;
        if (res.length === 0) {
          index = start1;
        } else {
          const { length, action, index: _index } = res[res.length - 1];
          index =
            (action === 'retain' ? length : _index) +
            (item[0] === 0 ? item[1].length : 0);
        }
        // console.log(index, res);
        return [
          ...res,
          {
            type: 'string',
            path,
            action:
              item[0] === 0 ? 'retain' : item[0] === 1 ? 'insert' : 'delete',
            index,
            value: item[1],
            length: res.length === 0 ? start1 + item[1].length : item[1].length,
          },
        ];
      }, [])
      .filter(item => item.action !== 'retain');
  }
  if (diff.length === 1) {
    // add data
    return [
      {
        type: 'object',
        path,
        action: 'replace',
        value: toSyncElement(diff[0], path),
      },
    ];
  }
  if (diff.length === 3 && diff[2] === 0 && diff[1] === 0) {
    // delete data
    return [
      {
        type: 'object',
        path,
        action: 'delete',
      },
    ];
  }
  return [
    {
      // replace data
      type: 'object',
      path,
      action: 'replace',
      value: toSyncElement(diff[1], path),
    },
  ];
};

export function toSyncElement(item, path = []) {
  if (typeof item === 'string') {
    const textElement = new Y.Text(item);
    return textElement;
  }

  if (Array.isArray(item)) {
    const childElements = item.map(item => toSyncElement(item, path));
    const arrayElement = new Y.Array();
    arrayElement.insert(0, childElements);
    return arrayElement;
  }

  if (item && typeof item === 'object') {
    const mapElement = new Y.Map();
    Object.keys(item).forEach(key => {
      mapElement.set(key, toSyncElement(item[key], [...path, key]));
    });
    return mapElement;
  }
  // if(typeof item === 'number' && (path[path.length - 1] === 'offset' || path[path.length - 1] === 'length')) {

  // }
  return item === void 0 ? '' : item;
}

export const getTargetByPath = (path, target, cb) => {
  if (path.length === 0) return target;
  return path.reduce((t, key, index) => {
    if (!t) {
      return console.warn(
        `Could not find target according to path ${path.join(
          '.'
        )}, it is recommended that you use 'onTargetSync' to listen for the value of the path`
      );
    }
    const res = t.get(key);
    !res && console.log(path, target, key);
    return res;
  }, target);
};

export const changeYmapByDelta = (delta, ymap, syncOpr) => {
  if (!delta || delta.length === 0) return;
  const operations = getDeltaArray(delta, []);
  if (operations.length === 0) return;
  const ydoc = ymap.doc;
  // console.log(operations, delta);
  ydoc.transact(() => {
    operations.forEach(opr => {
      applyYDocOp(opr, ymap);
    });
    syncOpr && syncOpr.apply && syncOpr(ymap);
  });
};
const applyYDocOp = (opr, ymap) => {
  const { type, path, action, value, index, length } = opr;
  if (type === 'string') {
    const target = getTargetByPath(path, ymap);
    // console.log(target, path, index, value);
    return action === 'insert'
      ? target.insert(index, value)
      : target.delete(index, length);
  }
  if (type === 'array') {
    const target = getTargetByPath(path, ymap);
    if (action === 'insert') {
      if (index === target.length) return target.push(value); // 最后一位是push方法
      return target.insert(index, value);
    }
    if (action === 'delete') {
      return target.delete(index, length);
    }
    if (action === 'move') {
      const moveToLast = +value === target.length - 1;
      const item = target.get(index);
      target.delete(index, 1);
      return moveToLast ? target.push([item]) : target.insert(value, [item]); // 最后一位是push方法
    }
  }
  if (type === 'object') {
    const index = path.length - 1;
    const target = getTargetByPath(path.slice(0, -1), ymap);
    // while(index < path.length && ymap.get[path[index]]) {
    //   target = ymap.get[path[index]]
    //   index++
    // }
    // index-- //退到此时真值的位置
    // if(index === path.length - 1) { // 遍历到底了,操作的就是最后的一个父元素
    //   target = target.parent
    //   index = index - 1
    if (action === 'delete') {
      return target.delete(path[index]);
    }
    if (action === 'replace') {
      return target.set(path[index], value);
    }
    // }
    // path没遍历到底，delete不需要处理了，replace需要补齐数据，防止undefined报错
    // if(action !== 'replace') return
    // index++
    // for(; index < path.length; index++) {
    //   target.set(path[index], index === path.length - 1 ? value : new Y.Map())
    //   target = target.get(path[index])
    // }
  }
};
// 获取指定路径的数据，如果有值则用回调返回，如果没有则自动监听到目标值出现，并返回的cancle方法可以取消监听
export const onTargetSync = (path, ymap, cb) => {
  if (!ymap) return console.warn('ymap is undefined');
  if (!cb) return console.warn('callback is necessary in onTargetSync');
  const target = getTargetByPath(path, ymap);
  if (target) {
    cb(target);
    return;
  }
  function ob() {
    const target = getTargetByPath(path, ymap);
    if (!target) return; // 等待目标字段的内容出现
    cb(target);
    ymap.unobserveDeep(ob);
  }
  ymap.observeDeep(ob);
  return () => {
    ymap.unobserveDeep(ob);
  };
};

export { transRaw, getStringDiffArray, diffIndex, getNewSelection };

// 解决draft-js跨行剪切报错
Node.prototype.removeChild = tryCatchFunc(Node.prototype.removeChild);
