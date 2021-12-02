import * as Y from 'yjs';
import { SelectionState, genKey, EditorState, convertFromRaw, convertToRaw } from 'draft-js';
import Dmp from 'diff-match-patch';
import { isEmpty } from 'lodash';
import { DiffPatcher } from 'jsondiffpatch';

function _extends() {
  _extends = Object.assign || function (target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];

      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }

    return target;
  };

  return _extends.apply(this, arguments);
}

Array.prototype.arrayToObj = function () {
  return _extends({}, this);
};

var diffPatcher = new DiffPatcher({
  objectHash: function objectHash(obj) {
    if (isEmpty(obj)) return '[]';
    if (Array.isArray(obj)) return JSON.stringify(obj);
    var res = {};
    Object.keys(obj).sort().forEach(function (key) {
      res[key] = obj[key];
    });
    return JSON.stringify(res);
  },
  textDiff: {
    minLength: 1
  },
  cloneDiffValues: true
});

var formatStringLen = function formatStringLen(length, char) {
  if (char === void 0) {
    char = '1';
  }

  return Array.from({
    length: length
  }).fill(char).join('');
};

var getKeyByEntityData = function getKeyByEntityData(entityData) {
  var type = entityData.type,
      data = entityData.data;

  switch (type // 保证在同一行，不同类型的entity的key不重复
  ) {
    case 'COMMENT':
      return "COMMENT-" + Object.values(data).map(function (i) {
        return i.key;
      }).join('-');
    // case 'OKR':
    //   return `OKR-${data.key}`
    // case 'TABLE':
    //   return `OKR-${data.key}`

    case 'mention':
      return "mention-" + (data.key || data.mention.name);
    // case 'IMAGE':
    //   return `IMG`
    // case 'VIDEO':
    //   return `VIDEO`

    default:
      return type;
  }
};

var entityArray2Map = function entityArray2Map(arr) {
  var entityRange = {};
  var entity = {};
  var rangeMap = {};
  arr.forEach(function (item, index) {
    var entityData = item.key;
    var type = entityData.type,
        data = entityData.data;
    var key = getKeyByEntityData(entityData); // key = rangeMap[key] ? `${key}-0` : key

    if (type === 'mention') {
      rangeMap[key] = {
        length: formatStringLen(item.length),
        offset: formatStringLen(item.offset),
        key: _extends({}, entityData, {
          data: data.mention.id + "-" + (data.key || data.mention.name)
        })
      };
      entity[data.mention.id + "-" + (data.key || data.mention.name)] = data;
      entityRange[key] = 1;
      return;
    }

    if (type === 'COMMENT') {
      var dataKey = {};
      var commentkey = key;
      var i = 1;

      while (rangeMap[commentkey]) {
        commentkey = key + "-" + i++;
      }

      entityRange[commentkey] = 1;
      Object.values(data).forEach(function (com) {
        entity[com.key] = com;
        dataKey[com.key] = 1;
      });
      rangeMap[commentkey] = {
        length: formatStringLen(item.length),
        offset: formatStringLen(item.offset),
        key: _extends({}, entityData, {
          data: dataKey
        })
      };
      return;
    } // rangeMap[key] = {
    //   length: formatStringLen(item.length),
    //   offset: formatStringLen(item.offset),
    //   key: entityData,
    // }


    entityRange[index] = item;
  });
  return {
    entityRange: entityRange,
    rangeMap: rangeMap,
    entity: entity
  };
};

var entityRange2Array = function entityRange2Array(entityRanges, entityPool, enityRangeMap) {
  var arr = []; // const isAtomic = Object.keys(entityRanges).every(key => +key >= 0)
  // if (isAtomic) arr.push(objToArray(entityRanges))

  for (var index in entityRanges) {
    var target = null;
    var enityRange = enityRangeMap[index] || entityRanges[index];
    if (!(enityRange != null && enityRange.key)) continue;
    var _enityRange$key = enityRange.key,
        type = _enityRange$key.type,
        data = _enityRange$key.data;

    if (type === 'mention') {
      // enityRange.data = entityPool[data]
      target = {
        offset: enityRange.offset.length,
        length: enityRange.length.length,
        key: _extends({}, enityRange.key, {
          data: entityPool[data]
        })
      };
    }

    if (type === 'COMMENT') {
      (function () {
        var comments = {};
        Object.keys(data).forEach(function (key, i) {
          comments[i] = entityPool[key];
        });
        target = {
          offset: enityRange.offset.length,
          length: enityRange.length.length,
          key: _extends({}, enityRange.key, {
            data: comments
          })
        };
      })();
    }

    target = target || entityRanges[index];
    arr.push(target);
  }

  arr.sort(function (a, b) {
    return a.offset - b.offset;
  });
  return arr;
};

var raw2rbw = function raw2rbw(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  raw = transRaw(raw);
  var _raw = raw,
      blocks = _raw.blocks,
      entityMap = _raw.entityMap;
  var blockMap = {};
  var entityPool = {}; // mention和comment的映射的属性池

  var enityRangeMap = {};
  var rbw = {
    blocks: blocks.map(function (item) {
      var _item$entityRanges = item.entityRanges,
          entityRanges = _item$entityRanges === void 0 ? [] : _item$entityRanges,
          inlineStyleRanges = item.inlineStyleRanges;
      var newEntityRanges = entityRanges.map(function (enti) {
        return _extends({}, enti, {
          key: entityMap[enti.key]
        });
      });

      var _entityArray2Map = entityArray2Map(newEntityRanges),
          entityRange = _entityArray2Map.entityRange,
          entity = _entityArray2Map.entity,
          rangeMap = _entityArray2Map.rangeMap;

      entityPool = Object.assign(entityPool, entity);
      enityRangeMap = Object.assign(enityRangeMap, rangeMap);
      blockMap[item.key] = _extends({}, item, {
        inlineStyleRanges: inlineStyleRanges.map(function (item) {
          return _extends({}, item, {
            length: formatStringLen(item.length),
            offset: formatStringLen(item.offset)
          });
        }).arrayToObj(),
        entityRanges: entityRange
      });
      return item.key;
    }) // 用于保留顺序

  };
  rbw.blockMap = blockMap;
  rbw.entityPool = entityPool;
  rbw.enityRangeMap = enityRangeMap;
  return rbw;
};

var rbw2raw = function rbw2raw(rbw) {
  var blocks = rbw.blocks,
      blockMap = rbw.blockMap,
      entityPool = rbw.entityPool,
      enityRangeMap = rbw.enityRangeMap;
  if (!rbw || !blocks) return rbw;
  var entityMap = {};
  var entityKey = 0;
  var commentMap = new Map();
  var newBlocks = blocks.map(function (key) {
    if (!blockMap[key]) return null;
    var entityRanges = entityRange2Array(blockMap[key].entityRanges, entityPool, enityRangeMap).map(function (entity) {
      var data = entity.key;
      var key;

      if (commentMap.has(data)) {
        key = commentMap.get(data);
      } else {
        key = ++entityKey;
        commentMap.set(data, key);
      }

      entityMap[key] = data;
      return _extends({}, entity, {
        key: key
      });
    });
    return _extends({}, blockMap[key], {
      inlineStyleRanges: objToArray(blockMap[key].inlineStyleRanges).map(function (item) {
        var _item$length, _item$offset;

        return _extends({}, item, {
          length: ((_item$length = item.length) == null ? void 0 : _item$length.length) || 0,
          offset: ((_item$offset = item.offset) == null ? void 0 : _item$offset.length) || 0
        });
      }),
      entityRanges: entityRanges
    });
  }).filter(Boolean);
  return {
    blocks: newBlocks,
    entityMap: entityMap
  };
};

var diffRaw = function diffRaw(preRaw, nextRaw) {
  var preRbw = raw2rbw(preRaw);
  var nextRbw = raw2rbw(nextRaw);
  var delta = diffPatcher.diff(preRbw, nextRbw);
  return delta;
};

new Dmp();

var getRaw = function getRaw(text) {
  return {
    blocks: [{
      key: genKey(),
      text: text,
      type: 'unstyled',
      depth: 0,
      inlineStyleRanges: [],
      entityRanges: [],
      data: {}
    }],
    entityMap: {}
  };
}; // text转RAW, key为xxxx，没有@


var stringToRaw = function stringToRaw(str) {
  var contentRaw = String(str).split('\n').map(getRaw);
  return contentRaw;
}; // 类数组对象转数组的方法

function objToArray(obj) {
  if (!obj) return [];
  var length = Math.max.apply(null, Object.keys(obj).filter(function (key) {
    return key.match(/^\d+$/);
  })) + 1;
  return Array.from(_extends({}, obj, {
    length: length
  })).filter(Boolean);
}

var transRaw = function transRaw(raw) {
  if (!raw) return raw;
  var reg = /,"(data|entityMap)":({}|\[\])/g;
  var res = JSON.parse(JSON.stringify(raw).replace(reg, function (_, $1) {
    return ",\"" + $1 + "\":{}";
  }));
  return res;
}; // 对方法进行封装，防止内部报错


var tryCatchFunc = function tryCatchFunc(fn, msg) {
  return function () {
    try {
      for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      return typeof fn === 'function' && fn.apply(this, args);
    } catch (error) {
      console.warn(msg || '方法报错', error);
    }
  };
};
var DMP = new Dmp(); // 计算序号, 默认不跟随内容更改

var diffIndex = function diffIndex(diffArr, index, needFlow) {
  var curIndex = DMP.diff_xIndex(diffArr, index);
  if (needFlow) return curIndex;
  if (index === 0) return 0;
  var lastIndex = DMP.diff_xIndex(diffArr, index - 1);
  if (lastIndex === index - 1 && curIndex !== index) return index;
  return curIndex;
};

var getStringDiffArray = function getStringDiffArray(txt1, txt2) {
  return DMP.diff_main(txt1, txt2);
};

var transToRawObj = function transToRawObj(raw) {
  return typeof raw === 'string' && raw.match(/^({|\[)/) ? tryCatchFunc(function (raw) {
    return JSON.parse(raw);
  })(raw) || stringToRaw(raw) : raw.blocks ? raw : stringToRaw('');
}; // RAW转text

var rawToText = function rawToText(raw) {
  raw = transToRawObj(raw);
  if (!raw) return '';
  return raw.blocks ? raw.blocks.reduce(function (a, b, index) {
    return {
      text: "" + a.text + (index > 0 ? '\n' : '') + b.text
    };
  }, {
    text: ''
  }).text : '';
};

var getNewSelection = function getNewSelection(_ref, raw, contentState) {
  var _newParmas$anchorKey, _newParmas$focusKey;

  var startKey = _ref.startKey,
      endKey = _ref.endKey,
      start = _ref.start,
      end = _ref.end;
  var oldBlockArray = contentState.getBlocksAsArray();
  var newParmas = {
    hasFocus: true
  };
  var isCollapsed = startKey === endKey && start === end;
  var blocks = raw.blocks;
  if (blocks.length === 0) return;
  var editorText = rawToText(raw);
  var oldEditorText = contentState.getPlainText();
  var textDiff = getStringDiffArray(oldEditorText, editorText); // console.log(startKey, endKey, start, end);

  if (textDiff.length === 1 && textDiff[0][0] === 0) {
    // 文本内容没有变化，保留原来的选择状态
    return new SelectionState({
      anchorKey: startKey,
      focusKey: endKey,
      anchorOffset: start,
      focusOffset: end,
      hasFocus: true
    });
  }

  var blockKeys = blocks.map(function (block) {
    return block.key;
  });
  var startIndex = blockKeys.indexOf(startKey);

  if (startKey === endKey && startIndex >= 0) {
    newParmas.anchorKey = startKey;
    newParmas.focusKey = endKey;
  }

  var endIndex = blockKeys.indexOf(endKey);
  var oldBlockKeys = oldBlockArray.map(function (block) {
    return block.key;
  });

  if (startIndex < 0 || endIndex < 0 || startIndex > endIndex) {
    // 起点和终点某一个被删掉了，或者拖拽改变了他们的前后顺序
    var oldStartIndex = oldBlockKeys.indexOf(startKey);
    var oldEndIndex = oldBlockKeys.indexOf(endKey);
    var preBlockKeys = oldBlockKeys.slice(oldStartIndex, oldEndIndex + 1); // length 可能为1，但肯定不为0
    // console.log('1', preBlockKeys.join(), blockKeys.join());

    while (preBlockKeys.length > 0 && (blockKeys.indexOf(preBlockKeys[0]) < 0 || // eslint-disable-next-line no-unmodified-loop-condition
    blockKeys.indexOf(preBlockKeys[0]) > endIndex && endIndex >= 0)) {
      preBlockKeys.shift(); // 从上向下找起点
    } // console.log('2', preBlockKeys.join());


    if (startIndex < 0 || endIndex < 0) {
      // 起点或终点被删掉了
      if (preBlockKeys.length > 0) {
        // 如果有起点
        newParmas.anchorKey = preBlockKeys[0];
        startIndex < 0 && (newParmas.anchorOffset = 0);

        while (preBlockKeys.length > 0 && (blockKeys.indexOf(preBlockKeys[preBlockKeys.length - 1]) < 0 || blockKeys.indexOf(preBlockKeys[preBlockKeys.length - 1]) < startIndex)) {
          preBlockKeys.pop(); // 从下向上找终点
        } // console.log('3', preBlockKeys.join());


        if (preBlockKeys.length > 0) {
          // 如果有终点
          newParmas.focusKey = preBlockKeys[preBlockKeys.length - 1];
          endIndex < 0 && (newParmas.focusOffset = blocks[blockKeys.indexOf(newParmas.focusKey)].text.length);
        } else {
          // 终点被删掉了, 选择key为anchorKey，lenght为anchorKey所在的length
          newParmas.focusKey = newParmas.anchorKey;
          newParmas.focusOffset = blocks[blockKeys.indexOf(newParmas.focusKey)].text.length;
        }
      } else {
        // 之前选中区域全删没了, 现存的最近一行的最后一个字符
        var startBlocks = oldBlockKeys.slice(0, oldStartIndex).filter(function (key) {
          return blockKeys.indexOf(key) >= 0;
        });
        var endBlocks = oldBlockKeys.slice(oldEndIndex + 1).filter(function (key) {
          return blockKeys.indexOf(key) >= 0;
        });

        if (endBlocks.length === 0 && startBlocks.length === 0) {
          // 全都找不到了，聚焦到最后
          newParmas.anchorKey = blocks[blocks.length - 1].key;
          newParmas.anchorOffset = blocks[blocks.length - 1].text.length;
        } else {
          // 先找到最近的一个
          newParmas.anchorKey = startBlocks.length > 0 ? startBlocks[startBlocks.length - 1] : endBlocks[0];
          newParmas.anchorOffset = blocks[blockKeys.indexOf(newParmas.anchorKey)].text.length;
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

  newParmas.anchorKey = (_newParmas$anchorKey = newParmas.anchorKey) != null ? _newParmas$anchorKey : startKey;
  newParmas.focusKey = (_newParmas$focusKey = newParmas.focusKey) != null ? _newParmas$focusKey : endKey;

  if (newParmas.anchorOffset !== undefined && newParmas.focusOffset !== undefined) {
    // console.log(newParmas);
    return new SelectionState(newParmas);
  } // 上述的newParmas缺少anchorOffset和focusOffset，需要进一步根据start和end来调整计算
  // startKey也是新选择的startKey，endKey也是新选择的endKey


  if (newParmas.anchorOffset === undefined) {
    var anchorText = blocks[blockKeys.indexOf(newParmas.anchorKey)].text;
    var oldAnchorText = oldBlockArray[oldBlockKeys.indexOf(newParmas.anchorKey)].text;
    var anchorDiff = getStringDiffArray(oldAnchorText, anchorText); // console.log(anchorDiff, start);

    newParmas.anchorOffset = diffIndex(anchorDiff, start, !isCollapsed);

    if (startKey === endKey) {
      newParmas.focusOffset = isCollapsed ? newParmas.anchorOffset : diffIndex(anchorDiff, end);
    }
  }

  if (newParmas.focusOffset === undefined) {
    var focusText = blocks[blockKeys.indexOf(newParmas.focusKey)].text;
    var oldFocusText = oldBlockArray[oldBlockKeys.indexOf(newParmas.focusKey)].text;
    var focusDiff = getStringDiffArray(oldFocusText, focusText);
    newParmas.focusOffset = diffIndex(focusDiff, end);
  } // console.log(newParmas);


  return new SelectionState(newParmas);
};

var getDeltaArray = function getDeltaArray(diff, path) {
  if (path === void 0) {
    path = [];
  }

  var deltaArray = [];

  if (!Array.isArray(diff) && !diff._t) {
    // 没到叶子节点
    Object.keys(diff).forEach(function (key) {
      deltaArray = deltaArray.concat(getDeltaArray(diff[key], [].concat(path, [key])));
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


var getOperationByDiff = function getOperationByDiff(diff, path) {
  if (diff._t === 'a') {
    // array
    return Object.keys(diff).sort(function (a, b) {
      return ~~a.replace(/^_/, '-') - b.replace(/^_/, '-');
    }).map(function (key) {
      if (key === '_t') return null;
      var res = {
        type: 'array',
        path: path
      };
      var isModify = !Array.isArray(diff[key]);

      if (key[0] === '_') {
        return diff[key][2] === 3 ? _extends({}, res, {
          action: 'move',
          index: ~~key.substr(1),
          // 原index
          value: diff[key][1] // new index

        }) : _extends({}, res, {
          action: 'delete',
          index: ~~key.substr(1),
          length: 1
        });
      }

      if (isModify) {
        return getDeltaArray(diff[key], [].concat(path, [key]));
      }

      return _extends({}, res, {
        action: 'insert',
        index: ~~key,
        value: diff[key].map(function (item) {
          return toSyncElement(item);
        })
      });
    }).filter(Boolean).reduce(function (prev, curr) {
      return Array.isArray(curr) ? [].concat(prev, curr) : [].concat(prev, [curr]);
    }, []);
  }

  if (diff[2] === 2 && diff.length === 3) {
    // text of block
    var _DMP$patch_fromText$ = DMP.patch_fromText(diff[0])[0],
        textDelta = _DMP$patch_fromText$.diffs,
        start1 = _DMP$patch_fromText$.start1;
    return textDelta.reduce(function (res, item) {
      var index = 0;

      if (res.length === 0) {
        index = start1;
      } else {
        var _res = res[res.length - 1],
            length = _res.length,
            action = _res.action,
            _index = _res.index;
        index = (action === 'retain' ? length : _index) + (item[0] === 0 ? item[1].length : 0);
      } // console.log(index, res);


      return [].concat(res, [{
        type: 'string',
        path: path,
        action: item[0] === 0 ? 'retain' : item[0] === 1 ? 'insert' : 'delete',
        index: index,
        value: item[1],
        length: res.length === 0 ? start1 + item[1].length : item[1].length
      }]);
    }, []).filter(function (item) {
      return item.action !== 'retain';
    });
  }

  if (diff.length === 1) {
    // add data
    return [{
      type: 'object',
      path: path,
      action: 'replace',
      value: toSyncElement(diff[0])
    }];
  }

  if (diff.length === 3 && diff[2] === 0 && diff[1] === 0) {
    // delete data
    return [{
      type: 'object',
      path: path,
      action: 'delete'
    }];
  }

  return [{
    // replace data
    type: 'object',
    path: path,
    action: 'replace',
    value: toSyncElement(diff[1])
  }];
};
/**
 * Converts all elements int a Draft content to SyncElements and adds them
 * to the SharedType
 *
 * @param sharedType
 * @param raw
 */


function toRawSharedData(raw) {
  var rbw = raw2rbw(raw);
  return toSyncElement(rbw);
}
function toSyncElement(item) {
  if (typeof item === 'string') {
    var textElement = new Y.Text(item);
    return textElement;
  }

  if (Array.isArray(item)) {
    return Y.Array.from(item.map(toSyncElement));
  }

  if (item && typeof item === 'object') {
    var mapElement = new Y.Map();
    var isRaw = item.blocks && item.entityMap && !item.entityPool;
    if (isRaw) return toRawSharedData(item);
    Object.keys(item).forEach(function (key) {
      mapElement.set(key, toSyncElement(item[key]));
    });
    return mapElement;
  }

  return item === void 0 ? '' : item;
}
var getTargetByPath = function getTargetByPath(path, target, isSync) {
  if (path.length === 0) return target;
  return path.reduce(function (t, key, index) {
    if (!t) {
      !isSync && console.warn("Could not find target according to path [" + path.join('.') + "], it is recommended that you use 'onTargetSync' to listen for the value of the path");
      return t;
    }

    var res = t.get(key);
    return res;
  }, target);
};
var changeYmapByDelta = function changeYmapByDelta(delta, ymap, syncOpr, origin) {
  if (!delta || delta.length === 0) return;
  var operations = getDeltaArray(delta, []).sort(function (a, b) {
    return a.path.length - b.path.length;
  });
  if (operations.length === 0) return;
  var ydoc = ymap.doc; // console.log(operations, delta, ymap);

  ydoc.transact(function () {
    operations.forEach(function (opr) {
      try {
        applyYDocOp(opr, ymap);
      } catch (e) {
        console.error(ymap, opr, e);
      }
    });
    if (syncOpr && syncOpr.apply) syncOpr(ymap);
  }, origin);
};

var applyYDocOp = function applyYDocOp(opr, ymap) {
  var type = opr.type,
      path = opr.path,
      action = opr.action,
      value = opr.value,
      index = opr.index,
      length = opr.length;

  if (type === 'string') {
    var target = getTargetByPath(path, ymap);
    return action === 'insert' ? target.insert(index, value) : target.delete(index, length);
  }

  if (type === 'array') {
    var _target2 = getTargetByPath(path, ymap);

    if (action === 'insert') {
      if (index === _target2.length) return _target2.push(value); // 最后一位是push方法

      return _target2.insert(index, value);
    }

    if (action === 'delete') {
      return _target2.delete(index, length);
    }

    if (action === 'move') {
      var moveToLast = +value === _target2.length - 1;

      var item = _target2.get(index).clone();

      _target2.delete(index, 1);

      return moveToLast ? _target2.push([item]) : _target2.insert(value, [item]); // 最后一位是push方法
    }
  }

  if (type === 'object') {
    var _index2 = path.length - 1;

    var _target3 = getTargetByPath(path.slice(0, -1), ymap); // while(index < path.length && ymap.get[path[index]]) {
    //   target = ymap.get[path[index]]
    //   index++
    // }
    // index-- //退到此时真值的位置
    // if(index === path.length - 1) { // 遍历到底了,操作的就是最后的一个父元素
    //   target = target.parent
    //   index = index - 1


    if (action === 'delete') {
      return _target3.delete(path[_index2]);
    }

    if (action === 'replace') {
      return _target3.set(path[_index2], value);
    } // }
    // path没遍历到底，delete不需要处理了，replace需要补齐数据，防止undefined报错
    // if(action !== 'replace') return
    // index++
    // for(; index < path.length; index++) {
    //   target.set(path[index], index === path.length - 1 ? value : new Y.Map())
    //   target = target.get(path[index])
    // }

  }
}; // 获取指定路径的数据，如果有值则用回调返回，如果没有则自动监听到目标值出现, 并且持续监听目标路径下的y对象，一旦被更改成另一个对象也会执行回调，并返回的cancle方法来取消监听


var onTargetSync = function onTargetSync(path, ymap, cb) {
  if (!ymap) return console.warn('ymap is undefined');
  if (!cb) return console.warn('callback is necessary in onTargetSync');
  Array.isArray(path) || (path = [path]);
  var target = getTargetByPath(path, ymap, true);

  if (target) {
    cb(target);
  }

  var _target = null;

  function ob(e) {
    var target = getTargetByPath(path, ymap, true);
    if (!target) return; // 等待目标字段的内容出现

    _target !== target && cb(target);
    _target = target;
  }

  ymap.observeDeep(ob);
  return function () {
    ymap.unobserveDeep(ob);
  };
};

// import * as error from 'lib0/error.js'

var getRawBySharedData = function getRawBySharedData(rawPath, ymap) {
  !Array.isArray(rawPath) && (rawPath = [rawPath]);
  var target = getTargetByPath(rawPath, ymap);
  if (!target) return null;
  var rbw = target.toJSON();
  var raw = rbw2raw(rbw);
  if (!rbw || !rbw.blocks) return rbw;

  if (raw.blocks.length !== rbw.blocks.length) {
    ymap.set(rawPath, toRawSharedData(raw));
  } // 修复


  return raw;
};
var CHANGE_CLIENT = 'CHANGE_CLIENT'; // 用于识别是不是自己的更新

var DraftBinding = /*#__PURE__*/function () {
  function DraftBinding(opts) {
    var _this = this;

    this.forceRefresh = function () {
      var raw = rbw2raw(_this.rawYmap.toJSON());

      _this.muxSetRaw(raw);
    };

    this.muxSetRaw = function (raw) {
      _this._waitUpdateTarget = null;

      _this.mutex(function () {
        _this.setStateByRaw(raw);

        if (_this._waitUpdateTarget) {
          _this._lock = false;
          return _this.muxSetRaw(_this._waitUpdateTarget);
        }
      }, function () {
        console.warn('setStateByRaw has been delayed', _this);
        _this._waitUpdateTarget = raw;
      });
    };

    this.listenTargetYmap = function (rawYmap) {
      _this.rawYmap = rawYmap;

      if (rawYmap.get(CHANGE_CLIENT)) {
        // A tag used to record local actions to prevent executing `setStateByRaw()`
        _this.oprYText = rawYmap.get(CHANGE_CLIENT);

        _this.oprYText.delete(0, _this.oprYText.length - 1);

        _this.oprID = _this.oprYText.toString();
      } else {
        _this.oprID = '0';
        _this.oprYText = toSyncElement(_this.oprID);
        rawYmap.set(CHANGE_CLIENT, _this.oprYText);
      }

      _this.undoManager = new Y.UndoManager(_this.rawYmap, {
        trackedOrigins: _this.trackedSet
      });
      _this.value = rbw2raw(rawYmap.toJSON());
      _this.onObserveDeep && rawYmap.observeDeep(_this.onObserveDeep); // observeDeep this editor's raw
    };

    this.undo = function () {
      if (!_this.undoManager) return;

      _this.undoManager.undo();
    };

    this.redo = function () {
      if (!_this.undoManager) return;

      _this.undoManager.redo();
    };

    this.bindEditor = function (editor) {
      var _this$getEditorContai;

      // 支持异步绑定编辑器
      if (!editor || _this.draftEditor) return;
      var draftEditor = editor.update ? editor : editor.editor;

      if (!draftEditor || !editor.componentDidUpdate) {
        return console.warn('editor must be Draft ref');
      }

      var isPluginEditor = !!editor.onChange;
      _this.draftEditor = editor;
      (_this$getEditorContai = _this.getEditorContainer()) == null ? void 0 : _this$getEditorContai.addEventListener('mousedown', _this.releaseSelection);

      if (isPluginEditor) {
        _this._onChange = editor.onChange;
        var componentDidUpdate = editor.componentDidUpdate; // listen to changes

        var that = _this;

        editor.componentDidUpdate = function (prevProps, prevState) {
          var editorState = editor.getEditorState();

          if (that.editorState !== editorState && editorState !== prevProps.editorState) {
            that.onChange(editorState);

            if (that._waitUpdateTarget) {
              that._lock = false;
              that.muxSetRaw.call(that, that._waitUpdateTarget);
            }
          }

          componentDidUpdate.apply(editor, [prevProps, prevState]);
        };
      } else {
        _this._update = editor.update; // listen to changes

        _this._update && (editor.update = function () {
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }

          _this.onChange(args[0]);

          _this._update.apply(editor, args);

          if (_this._waitUpdateTarget) {
            _this._lock = false;
            _this.editorState = args[0];

            _this.muxSetRaw(_this._waitUpdateTarget);
          }
        });
      }
    };

    this.getEditorContainer = function () {
      var _this$draftEditor$edi;

      if (!_this.draftEditor) return null;
      return _this.draftEditor.editorContainer || ((_this$draftEditor$edi = _this.draftEditor.editor) == null ? void 0 : _this$draftEditor$edi.editorContainer);
    };

    this.getEditorState = function () {
      return _this.editorState || _this.draftEditor.props.editorState;
    };

    this.setStateByRaw = function (raw) {
      var _onChange = _this._update || _this._onChange;

      if (!raw || !raw.blocks || !_onChange) return;

      var editorState = _this.getEditorState();

      var selectionState = editorState.getSelection();
      var newEditorState = EditorState.createWithContent(convertFromRaw(raw));
      newEditorState.allowUndo = false;
      var isCollapsed = selectionState.isCollapsed();

      if (!selectionState.getHasFocus() && isCollapsed) {
        _this.editorState = newEditorState;
        _this.value = raw;
        return _onChange.call(_this.draftEditor, _this.editorState);
      }

      _this.setStateAndSelection(_onChange, newEditorState, isCollapsed, raw);
    };

    this.setStateAndSelection = function (_onChange, newEditorState, isCollapsed, raw) {
      var editorState = _this.getEditorState();

      var selectionState = editorState.getSelection();
      var contentState = editorState.getCurrentContent();
      var startKey = selectionState.getStartKey();
      var endKey = selectionState.getEndKey();
      var start = selectionState.getStartOffset();
      var end = selectionState.getEndOffset();
      var newSelection = getNewSelection({
        startKey: startKey,
        endKey: endKey,
        start: start,
        end: end
      }, raw, contentState); // this.localSelectionState = newSelection
      // console.log(this.shouldAcceptSelection);

      _this.editorState = newSelection ? EditorState[isCollapsed || _this.shouldAcceptSelection ? 'acceptSelection' : 'forceSelection'](newEditorState, newSelection) : newEditorState;
      _this.value = raw;
      _this.editorState.allowUndo = false;

      _onChange.call(_this.draftEditor, _this.editorState);
    };

    this.releaseSelection = function () {
      _this.shouldAcceptSelection = true;
    };

    var ymap = opts.ymap,
        _rawPath = opts.rawPath,
        _editor = opts.editor,
        provider = opts.provider;
        opts.parmas;
    this.version = "1.2.3";
    var rawPath = _rawPath;
    !Array.isArray(rawPath) && (rawPath = [rawPath]);
    this.doc = ymap.doc;
    this.clientID = this.doc.clientID;
    this.trackedSet = new Set([this.clientID, this]);
    this.ymap = ymap;
    this.awareness = provider.awareness;
    this._lock = false;

    this.mutex = function (f, g) {
      if (!_this._lock) {
        _this._lock = true;

        try {
          f();
          _this._lock = false;
        } finally {
          _this._lock = false;
        }

        _this._lock = false;
      } else if (g !== undefined) {
        g();
      }
    };

    this.rawPath = rawPath; // console.log(
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

    this.onObserveDeep = function (event, isupate) {
      var currentTarget = null;
      event.forEach(function (item) {
        var path = item.path;
        var originOrpId = item.currentTarget.get(CHANGE_CLIENT).toString();

        if (path.length > 0 && path[0] !== CHANGE_CLIENT && _this.oprID !== originOrpId) {
          // 自己的更改不用更新
          currentTarget = item.currentTarget;
          _this.oprID = originOrpId;
        }
      });
      currentTarget && _this.forceRefresh(currentTarget);
    };

    !provider.synced ? provider.on('sync', function (isSynced) {
      if (!isSynced) return;
      _this.cancel = onTargetSync(_this.rawPath, ymap, function (rawYmap) {
        _this.listenTargetYmap(rawYmap);
      });
    }) : this.cancel = onTargetSync(this.rawPath, ymap, function (rawYmap) {
      _this.listenTargetYmap(rawYmap);
    });

    this.onChange = function (editorState) {
      return _this.mutex(function () {
        var _this$editorState$all;

        _this.editorState = editorState;
        var raw = transRaw(convertToRaw(editorState.getCurrentContent()));
        if (!_this.value) return _this.value = raw;
        var selection = editorState.getSelection();
        var allowUndo = (_this$editorState$all = _this.editorState.allowUndo) != null ? _this$editorState$all : _this.editorState.getAllowUndo();

        if (_this.shouldAcceptSelection && !selection.isCollapsed()) {
          _this.shouldAcceptSelection = false;
        } // 释放控制


        _this.awareness.setLocalStateField('selection', {
          anchorKey: selection.getAnchorKey(),
          anchorOffset: selection.getAnchorOffset(),
          focusKey: selection.getFocusKey(),
          focusOffset: selection.getFocusOffset(),
          hasFocus: selection.getHasFocus()
        });

        var newJson = JSON.stringify(raw);
        var oldJson = JSON.stringify(_this.value);
        if (oldJson === newJson || !_this.rawYmap) return; // console.log(newJson, oldJson)

        _this.rawYmap = getTargetByPath(_this.rawPath, _this.ymap);
        var delta = diffRaw(_this.value, raw);
        changeYmapByDelta(delta, _this.rawYmap, function () {
          _this.oprYText.insert(_this.oprID.length, '0');

          _this.oprID = _this.oprID + '0';
        }, allowUndo ? _this.clientID : null);
        _this.value = JSON.parse(newJson);
      }, function () {
        console.warn('onChange has been delayed', _this);
      });
    };

    this.bindEditor(_editor);
  }

  var _proto = DraftBinding.prototype;

  _proto.destroy = function destroy() {
    var _this$getEditorContai2, _this$cancel;

    // console.warn('y-darf-js is destoryed');
    (_this$getEditorContai2 = this.getEditorContainer()) == null ? void 0 : _this$getEditorContai2.removeEventListener('mousedown', this.releaseSelection);
    this._update && this.draftEditor && (this.draftEditor.update = this._update); // this.mutex = null;

    (_this$cancel = this.cancel) == null ? void 0 : _this$cancel.call(this);
    this.rawYmap && this.rawYmap.unobserveDeep(this.onObserveDeep);

    if (this.awareness !== null) {
      // @ts-ignore
      this.awareness.off('change', this.rerenderDecorations);
    }
  };

  return DraftBinding;
}();

export { DraftBinding, getNewSelection, getRawBySharedData, getTargetByPath, onTargetSync, raw2rbw, rbw2raw, toRawSharedData, toSyncElement };
