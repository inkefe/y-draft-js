import * as Y from 'yjs';
import { genKey, SelectionState, EditorState, convertFromRaw, convertToRaw } from 'draft-js';
import Dmp from 'diff-match-patch';
import _isEmpty from 'lodash/isEmpty';
import { DiffPatcher } from 'jsondiffpatch';
import _throttle from 'lodash/throttle';

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
    if (_isEmpty(obj)) return '[]';
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
  if (!data) return '';

  switch (type // 保证在同一行，不同类型的entity的key不重复
  ) {
    case 'COMMENT':
      return "COMMENT-" + Object.values(data).filter(Boolean).map(function (i) {
        return i.unique || i.key;
      }).join('-');

    case 'LINK':
      return "LINK-" + (data.key || data.url);
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

var entityArray2Map = function entityArray2Map(arr, globalRangeMap) {
  var entityRange = {};
  var entity = {};
  var rangeMap = {};
  arr.forEach(function (item, index) {
    var entityData = item.key;
    if (!entityData) return;
    var type = entityData.type,
        data = entityData.data;
    var key = getKeyByEntityData(entityData); // key = rangeMap[key] ? `${key}-0` : key

    if (type === 'mention' && key) {
      rangeMap[key] = {
        length: formatStringLen(item.length),
        offset: formatStringLen(item.offset),
        key: _extends({}, entityData, {
          data: data.mention.id + "-" + (data.key || data.mention.name)
        })
      };
      entity[data.mention.id + "-" + (data.key || data.mention.name)] = data;
      entityRange[key] = index;
      return;
    }

    if (type === 'LINK' && key) {
      rangeMap[key] = {
        length: formatStringLen(item.length),
        offset: formatStringLen(item.offset),
        key: _extends({}, entityData, {
          data: "link-" + (data.key || data.url)
        })
      };
      entity["link-" + (data.key || data.url)] = data;
      entityRange[key] = index;
      return;
    }

    if (type === 'COMMENT' && key) {
      var dataKey = {};

      if (key === 'COMMENT-') {
        return;
      }

      var commentkey = key;
      var i = 1;

      while (globalRangeMap[commentkey]) {
        commentkey = key + "-" + i++;
      }

      entityRange[commentkey] = index;
      Object.values(data).forEach(function (com) {
        entity[com.unique || com.key] = com;
        dataKey[com.unique || com.key] = 1;
      });
      rangeMap[commentkey] = globalRangeMap[commentkey] = {
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


    entityRange[index] = _extends({}, item, {
      length: formatStringLen(item.length),
      offset: formatStringLen(item.offset)
    });
  });
  return {
    entityRange: entityRange,
    rangeMap: rangeMap,
    entity: entity
  };
};

var entityRange2Array = function entityRange2Array(entityRanges, entityPool, enityRangeMap) {
  var arr = [];

  for (var index in entityRanges) {
    var target = null;
    var enityRange = enityRangeMap[index] || entityRanges[index];
    if (!(enityRange != null && enityRange.key)) continue;
    var _enityRange$key = enityRange.key,
        type = _enityRange$key.type,
        data = _enityRange$key.data;
    var offset = enityRange.offset.length;
    var length = enityRange.length.length;

    if (type === 'mention' && data) {
      // enityRange.data = entityPool[data]
      target = {
        offset: offset,
        length: length,
        key: _extends({}, enityRange.key, {
          data: entityPool[data]
        })
      };
    }

    if (type === 'LINK' && data) {
      target = {
        offset: offset,
        length: length,
        key: _extends({}, enityRange.key, {
          data: entityPool[data]
        })
      };
    }

    if (type === 'COMMENT' && data) {
      (function () {
        var comments = {};
        Object.keys(data).forEach(function (key, i) {
          comments[i] = entityPool[key];
        });
        target = {
          offset: offset,
          length: length,
          key: _extends({}, enityRange.key, {
            data: comments
          })
        };
      })();
    }

    target = target || _extends({}, entityRanges[index], {
      offset: offset,
      length: length
    });
    var i = isNaN(Number(index)) ? entityRanges[index] : Number(index);
    arr[i] = target;
  }

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
  var globalRangeMap = {};
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

      var _entityArray2Map = entityArray2Map(newEntityRanges, globalRangeMap),
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
    if (!blockMap[key]) return getRaw().blocks[0];
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
  });
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

var DIFF_DELETE = -1;
var DIFF_INSERT = 1;
var DIFF_EQUAL = 0;
var getRaw = function getRaw(texts) {
  if (texts === void 0) {
    texts = '';
  }

  if (!Array.isArray(texts)) texts = [texts];
  return {
    blocks: texts.map(function (text) {
      return {
        key: genKey(),
        text: text || '',
        type: 'unstyled',
        depth: 0,
        inlineStyleRanges: [],
        entityRanges: [],
        data: {}
      };
    }),
    entityMap: {}
  };
}; // text转RAW, key为xxxx，没有@

var stringToRaw = function stringToRaw(str) {
  var contentRaw = getRaw(String(str || '').split('\n'));
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
var isRaw = function isRaw(raw) {
  return raw && raw.blocks && raw.entityMap;
};

var transRaw = function transRaw(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  var _raw$blocks = raw.blocks,
      blocks = _raw$blocks === void 0 ? [] : _raw$blocks,
      entityMap = raw.entityMap;
  if (_isEmpty(entityMap)) raw.entityMap = {};
  blocks.forEach(function (block) {
    if (_isEmpty(block.data)) block.data = {};
  });
  return raw;
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
      end = _ref.end,
      hasFocus = _ref.hasFocus;
  var oldBlockArray = contentState.getBlocksAsArray();
  var newParmas = {
    hasFocus: hasFocus
  };
  var isCollapsed = startKey === endKey && start === end;
  var blocks = raw.blocks;
  if (blocks.length === 0) return;
  var editorText = rawToText(raw);
  var oldEditorText = contentState.getPlainText(); // console.log(startKey, endKey, start, end);

  if (oldEditorText === editorText) {
    // 文本内容没有变化，保留原来的选择状态
    return new SelectionState({
      anchorKey: startKey,
      focusKey: endKey,
      anchorOffset: start,
      focusOffset: end,
      hasFocus: hasFocus
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
    // const needFlow = !isCollapsed || !isUndo

    var needFlow = !isCollapsed || oldAnchorText.length - anchorText.length > 0;
    newParmas.anchorOffset = diffIndex(anchorDiff, start, needFlow);

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
    var actionKeys = Object.keys(diff).reduce(function (_ref2, a) {
      var del = _ref2[0],
          add = _ref2[1];
      if (a === '_t') return [del, add];

      if (a[0] === '_') {
        return [[a].concat(del), add]; // delete from right to left
      }

      return [del, [].concat(add, [a])]; // add from left to right
    }, [[], []]).reduce(function (prev, curr) {
      return Array.isArray(curr) ? [].concat(prev, curr) : [].concat(prev, [curr]);
    }, []);
    return actionKeys.map(function (key) {
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
    });
  }

  if (diff[2] === 2 && diff.length === 3) {
    // text of block
    var _DMP$patch_fromText$ = DMP.patch_fromText(diff[0])[0],
        textDelta = _DMP$patch_fromText$.diffs,
        start1 = _DMP$patch_fromText$.start1;

    if (ingnoreKeys.indexOf(path[path.length - 1]) >= 0) {
      return [{
        type: 'object',
        // as object
        path: path,
        action: 'replace',
        value: textDelta.reduce(function (prev, curr) {
          var op = curr[0],
              text = curr[1];
          if (op === DIFF_DELETE) return prev;
          return prev + text;
        }, '')
      }];
    }

    return textDelta.reduce(function (res, item) {
      var index = 0;

      if (res.length === 0) {
        index = start1;
      } else {
        var nextIndex = res[res.length - 1].nextIndex;
        index = nextIndex;
      } // console.log(index, res);


      var action = item[0] === DIFF_EQUAL ? 'retain' : item[0] === DIFF_INSERT ? 'insert' : 'delete';
      return [].concat(res, [{
        type: 'string',
        path: path,
        action: action,
        index: index,
        nextIndex: action === 'delete' ? index : index + item[1].length,
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
var ingnoreKeys = ['type', 'key', 'mutability'];
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

    var _isRaw = item.blocks && item.entityMap && !item.entityPool;

    if (_isRaw) return toRawSharedData(item);
    Object.keys(item).forEach(function (key) {
      mapElement.set(key, ingnoreKeys.indexOf(key) >= 0 && typeof item[key] === 'string' ? item[key] : toSyncElement(item[key]));
    });
    return mapElement;
  }

  return item === void 0 ? '' : item;
}
var getTargetByPath = function getTargetByPath(path, target, isSync) {
  if (path.length === 0) return target;
  return path.reduce(function (t, key, index) {
    if (!t) {
      !isSync && console.warn("Could not find target according to path [" + path.join('.') + "], it is recommended that you use 'onTargetSync' to listen for the value of the path", target);
      return t;
    }

    var res = t.get ? t.get(key) : t[key];
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
    if (!target && action === 'delete') return;

    if (typeof target === 'string' || !target) {
      var field = path[path.length - 1];
      var ydata = getTargetByPath(path.slice(0, path.length - 1), ymap);
      return action === 'insert' ? ydata.set(field, value) : ydata.delete(field);
    }

    return action === 'insert' ? target.insert(index, value) : target.delete(index, length);
  }

  if (type === 'array') {
    var _target = getTargetByPath(path, ymap);

    if (action === 'insert') {
      if (index === _target.length) return _target.push(value); // 最后一位是push方法

      return _target.insert(index, value);
    }

    if (action === 'delete') {
      return _target.delete(index, length);
    }

    if (action === 'move') {
      var moveToLast = +value === _target.length - 1;

      var item = _target.get(index).clone();

      _target.delete(index, 1);

      return moveToLast ? _target.push([item]) : _target.insert(value, [item]); // 最后一位是push方法
    }
  }

  if (type === 'object') {
    var _index = path.length - 1;

    var _target2 = getTargetByPath(path.slice(0, -1), ymap); // while(index < path.length && ymap.get[path[index]]) {
    //   target = ymap.get[path[index]]
    //   index++
    // }
    // index-- //退到此时真值的位置
    // if(index === path.length - 1) { // 遍历到底了,操作的就是最后的一个父元素
    //   target = target.parent
    //   index = index - 1


    if (action === 'delete') {
      return _target2.delete(path[_index]);
    }

    if (action === 'replace') {
      return _target2.set(path[_index], value);
    } // }
    // path没遍历到底，delete不需要处理了，replace需要补齐数据，防止undefined报错
    // if(action !== 'replace') return
    // index++
    // for(; index < path.length; index++) {
    //   target.set(path[index], index === path.length - 1 ? value : new Y.Map())
    //   target = target.get(path[index])
    // }

  }
};

var _pathTargeDoc = new WeakMap(); // 获取从ydoc下指定路径的数据，如果有值则用回调返回，如果没有则自动监听到目标值出现, 并且持续监听目标路径下的y对象，一旦被更改成另一个对象也会执行回调，并返回的cancle方法来取消监听


var onTargetSync = function onTargetSync(path, ydoc, cb, firstType) {
  var _targetDoc$pathKey;

  if (firstType === void 0) {
    firstType = Y.Map;
  }

  if (!ydoc) return console.warn('ydoc is undefined');
  if (!cb) return console.warn('callback is necessary in onTargetSync');
  var targetDoc = _pathTargeDoc.has(ydoc) ? _pathTargeDoc.get(ydoc) || {} : {};

  _pathTargeDoc.set(ydoc, targetDoc);

  Array.isArray(path) || (path = [path]);

  var _path = path,
      fixField = _path[0],
      subPath = _path.slice(1);

  var firstData = ydoc.get(fixField, firstType);

  if (subPath.length === 0) {
    setTimeout(function () {
      return cb(firstData);
    }, 0);
    return;
  }

  var target = getTargetByPath(subPath, firstData, true);
  var pathKey = path.join('.');
  targetDoc[pathKey] = {
    target: target,
    callBacks: [].concat(((_targetDoc$pathKey = targetDoc[pathKey]) == null ? void 0 : _targetDoc$pathKey.callBacks) || [], [cb])
  };

  function ob(e) {
    var target = getTargetByPath(subPath, firstData, true);

    if (!target || !targetDoc[pathKey] || targetDoc[pathKey].target === target) {
      return;
    } // 等待目标字段的内容出现


    targetDoc[pathKey].target = target;
    targetDoc[pathKey].callBacks.forEach(function (fn) {
      return fn(target);
    });
  }

  firstData.observeDeep(ob);

  if (target) {
    setTimeout(function () {
      return cb(target);
    }, 0);
  }

  return function () {
    if (!targetDoc[pathKey]) return;
    var _targetDoc$pathKey$ca = targetDoc[pathKey].callBacks,
        callBacks = _targetDoc$pathKey$ca === void 0 ? [] : _targetDoc$pathKey$ca;
    callBacks.splice(callBacks.indexOf(cb), 1);
    firstData.unobserveDeep(ob);

    if (callBacks.length === 0) {
      delete targetDoc[pathKey];
    }
  };
};

// import * as error from 'lib0/error.js'

var getRawBySharedData = function getRawBySharedData(rawPath, ydoc) {
  !Array.isArray(rawPath) && (rawPath = [rawPath]);
  var target = getTargetByPath(rawPath, ydoc);
  if (!target) return null;
  var rbw = null;
  var raw = null;

  try {
    rbw = target.toJSON();
    raw = rbw2raw(rbw);
    if (!isRaw(raw)) return null;
  } catch (error) {
    return null;
  }

  return raw;
};

var setRawToSharedData = function setRawToSharedData(rawPath, ydoc, raw) {
  !Array.isArray(rawPath) && (rawPath = [rawPath]);
  var target = getTargetByPath(rawPath, ydoc);
  if (!target) return console.log("path:" + rawPath + " is undefined");
  var rbw = raw2rbw(raw);
  ydoc.transact(function () {
    target.forEach(function (val, key) {
      return target.delete(key);
    });
    target.set(CHANGE_CLIENT, genKey()); // const rawYmap = toRawSharedData(rbw)

    Object.entries(rbw).forEach(function (_ref) {
      var key = _ref[0],
          val = _ref[1];
      return target.set(key, toSyncElement(val));
    });
  }); // console.log(target.toJSON(), 'target.toJSON()');

  return target;
};
var CHANGE_CLIENT = 'CHANGE_CLIENT'; // 用于识别是不是自己的更新

var editorMap = {};
var preAwarenessMap = new WeakMap(); // 更新光标数据

var updateAwareness = _throttle(function (provider, selectData) {
  var selectStr = JSON.stringify(selectData);
  var preAwareness = preAwarenessMap.get(provider) || '';
  preAwarenessMap.set(provider, selectStr);
  var preNotFocus = !!preAwareness.match(/:false}$/);
  if (preAwareness === selectStr || preNotFocus && !selectData.hasFocus) return;
  provider.awareness.setLocalStateField('selection', selectData);
}, 300);

var DraftBinding = function DraftBinding(opts) {
  var _this = this;

  this.getSectionData = function () {
    var selection = _this.getEditorState().getSelection();

    if (_this.isCompositeMode() && _this.selectData) return _this.selectData;
    _this.selectData = {
      anchorKey: selection.getAnchorKey(),
      anchorOffset: selection.getAnchorOffset(),
      focusKey: selection.getFocusKey(),
      focusOffset: selection.getFocusOffset(),
      isBackward: selection.getIsBackward(),
      hasFocus: selection.getHasFocus()
    };
    return _this.selectData;
  };

  this.setUpdatable = function (val) {
    _this._updatable = !!val;

    if (!!val && _this._stopUpdateEvents) {
      _this.onObserveDeep(_this._stopUpdateEvents);
    }
  };

  this.forceRefresh = _throttle(function () {
    var raw = rbw2raw(_this.rawYmap.toJSON());

    _this.muxSetRaw(raw);
  }, 500, {
    leading: true,
    trailing: true
  });

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
    var _this$rawYmap;

    var val = rbw2raw(rawYmap.toJSON());

    if (isRaw(val)) {
      _this.value = val;
      _this.oldJson = JSON.stringify(val);
    } else {
      _this.value = getRaw();
      _this.oldJson = JSON.stringify(val);
      rawYmap = setRawToSharedData(_this.rawPath, _this.doc, _this.value);

      _this.log('initRaw =>', _this.value, _this.rawPath.join('.'));
    }

    (_this$rawYmap = _this.rawYmap) == null ? void 0 : _this$rawYmap.unobserveDeep(_this.onObserveDeep);
    _this.rawYmap = rawYmap;
    _this.oprID = _this.rawYmap.get(CHANGE_CLIENT);

    if (!_this.oprID) {
      _this.oprID = genKey();

      _this.rawYmap.set(CHANGE_CLIENT, _this.oprID);
    }

    _this.undoManager = new Y.UndoManager(_this.rawYmap, {
      trackedOrigins: _this.trackedSet
    });

    _this.log('on :[onObserveDeep]', rawYmap, _this.rawPath.join('.'));

    _this.rawYmap.observeDeep(_this.onObserveDeep); // observeDeep this editor's raw


    return true;
  };

  this.undo = function () {
    if (!_this.undoManager) return;

    _this.doc.transact(function () {
      _this.oprID = genKey();

      _this.rawYmap.set(CHANGE_CLIENT, _this.oprID);

      _this.undoManager.undo();
    });
  };

  this.redo = function () {
    if (!_this.undoManager) return;

    _this.doc.transact(function () {
      _this.oprID = genKey();

      _this.rawYmap.set(CHANGE_CLIENT, _this.oprID);

      _this.undoManager.redo();
    });
  };

  this.bindEditor = function (editor) {
    var _this$getEditorContai;

    // 支持异步绑定编辑器
    if (!editor) return;

    if (_this.draftEditor) {
      console.warn('[editor-change] bind other draftEditor, preEditor:', _this.draftEditor, 'newEditor:', editor);
    }

    var draftEditor = editor.update ? editor : editor.getEditorRef == null ? void 0 : editor.getEditorRef(); // 原始的draft-editor

    if (!draftEditor || !editor.componentDidUpdate) {
      return console.warn('editor must be Draft ref');
    }

    var isPluginEditor = !!editor.onChange;
    _this.isPluginEditor = isPluginEditor;
    _this.draftEditor = editor;
    _this.editorKey = draftEditor.getEditorKey();
    (_this$getEditorContai = _this.getEditorContainer()) == null ? void 0 : _this$getEditorContai.addEventListener('mousedown', _this.releaseSelection);

    if (isPluginEditor) {
      _this._onChange = editor.onChange;
      var componentDidUpdate = editor.componentDidUpdate; // listen to changes

      var that = _this;
      _this._onChange && (editor.onChange = function (editorState) {
        if (that.editorState === editorState) {
          if (that._lockFocus) that._lockFocus = false;
          return;
        }

        if (that._lockFocus) {
          editorState = EditorState.forceSelection(editorState, that.newSelection);
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
        var editorState = editor.getEditorState();

        if (that.editorState !== editorState && editorState !== prevProps.editorState) {
          that.onChange(editorState); // console.log('componentDidUpdate.onChange');

          if (that._waitUpdateTarget) {
            that._lock = false;
            that.muxSetRaw(that._waitUpdateTarget);
          }
        }

        componentDidUpdate.apply(this, [prevProps, prevState]);
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

  this.isCompositeMode = function () {
    return _this.getEditorState().isInCompositionMode();
  };

  this.getEditorState = function () {
    return _this.editorState || _this.draftEditor.props.editorState;
  };

  this.setStateByRaw = function (raw) {
    var _this$draftEditor;

    var _onChange = _this._update || _this._onChange;

    if (!isRaw(raw) || !_onChange) return;
    if (!_this.draftEditor) return _this.destroy();

    if (_this.isPluginEditor && !((_this$draftEditor = _this.draftEditor) != null && _this$draftEditor.getEditorRef != null && _this$draftEditor.getEditorRef())) {
      if (_this.isDetoryed) {
        return _this.rawYmap.unobserveDeep(_this.onObserveDeep);
      }

      return console.warn('drafjsEditor Can`t be found it, please rebind the editor', _this, _this.rawPath);
    }

    var editorState = _this.getEditorState();

    var selectionState = editorState.getSelection();
    var newEditorState = EditorState.set(EditorState.createWithContent(convertFromRaw(raw)), {
      inCompositionMode: _this.isCompositeMode()
    });
    newEditorState.allowUndo = false;
    var isCollapsed = selectionState.isCollapsed(); // console.log(selectionState.getHasFocus(), 'selectionState')

    var focusLength = Object.values(editorMap).filter(Boolean).length; // console.log(this.isCompositeMode(), 'isCompositeMode');

    if (focusLength > 0 && !editorMap[_this.editorKey] || focusLength === 0) {
      _this.editorState = newEditorState;
      _this.value = raw;
      _this.oldJson = JSON.stringify(raw);
      return _onChange.call(_this.draftEditor, newEditorState);
    }

    _this.setStateAndSelection(_onChange, newEditorState, isCollapsed, raw);
  };

  this.setStateAndSelection = function (_onChange, newEditorState, isCollapsed, raw) {
    var editorState = _this.getEditorState();

    var contentState = editorState.getCurrentContent();

    var _ref2 = _this.selectData || _this.getSectionData(),
        anchorKey = _ref2.anchorKey,
        focusKey = _ref2.focusKey,
        anchorOffset = _ref2.anchorOffset,
        focusOffset = _ref2.focusOffset,
        isBackward = _ref2.isBackward,
        hasFocus = _ref2.hasFocus;

    var startKey = isBackward ? focusKey : anchorKey;
    var endKey = isBackward ? anchorKey : focusKey;
    var start = isBackward ? focusOffset : anchorOffset;
    var end = isBackward ? anchorOffset : focusOffset;
    var newSelection = getNewSelection({
      startKey: startKey,
      endKey: endKey,
      start: start,
      end: end,
      hasFocus: hasFocus
    }, raw, contentState);

    _this.log('NewSelection ->>' + newSelection.serialize().split(',').join(' | '), hasFocus);

    _this.newSelection = newSelection; // this.localSelectionState = newSelection
    // console.log(this.shouldAcceptSelection);

    _this.editorState = newSelection ? EditorState[isCollapsed || _this.shouldAcceptSelection ? 'acceptSelection' : 'forceSelection'](newEditorState, newSelection) : newEditorState;
    _this._lockFocus = true;
    _this.value = raw;
    _this.oldJson = JSON.stringify(raw);
    _this.editorState.allowUndo = false; // const now = Date.now()
    // console.log(now - this.now)
    // this.now = now

    _onChange.call(_this.draftEditor, _this.editorState);
  };

  this.releaseSelection = function () {
    _this.shouldAcceptSelection = true;
  };

  this.isDetoryed = false;

  this.destroy = function () {
    var _this$getEditorContai2, _this$rawYmap2;

    // console.warn('y-darf-js is destoryed');
    (_this$getEditorContai2 = _this.getEditorContainer()) == null ? void 0 : _this$getEditorContai2.removeEventListener('mousedown', _this.releaseSelection);
    (_this$rawYmap2 = _this.rawYmap) == null ? void 0 : _this$rawYmap2.unobserveDeep(_this.onObserveDeep);
    _this.isDetoryed = true;

    _this.provider.off('status', _this.onStatusChange);

    _this.log('destroy: ' + _this.rawPath.join('.'));

    _this._update && _this.draftEditor && (_this.draftEditor.update = _this._update);

    if (_this._onChange) {
      _this.draftEditor && (_this.draftEditor.onChange = _this._onChange);
      Reflect.deleteProperty(_this.draftEditor, 'componentDidUpdate');
    }

    Reflect.deleteProperty(editorMap, _this.editorKey);
    _this.cancel == null ? void 0 : _this.cancel();
  };

  var ydoc = opts.ydoc,
      _rawPath = opts.rawPath,
      _editor = opts.editor,
      provider = opts.provider,
      _opts$updatable = opts.updatable,
      updatable = _opts$updatable === void 0 ? true : _opts$updatable,
      debug = opts.debug;
  this.log = debug ? console.log : function () {};
  this.version = "1.8.0";
  this.provider = provider;
  var rawPath = _rawPath;
  !Array.isArray(rawPath) && (rawPath = [rawPath]);
  ydoc.getMap(rawPath[0]);
  this.doc = ydoc;
  this.clientID = this.doc.clientID;
  this.trackedSet = new Set([this.clientID, this]);
  this.awareness = provider.awareness;
  this._lock = false;
  this._updatable = !!updatable;
  this.isConnecting = provider.wsconnecting;

  this.onStatusChange = function (_ref3) {
    var status = _ref3.status;
    _this.isConnecting = status === 'connecting';
  };

  provider.on('status', this.onStatusChange);

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

  this.rawPath = rawPath;

  this.onObserveDeep = function (events) {
    if (!_this._updatable) return _this._stopUpdateEvents = events;
    _this._stopUpdateEvents = null;
    var currentTarget = null;

    var originOrpId = _this.rawYmap.get(CHANGE_CLIENT);

    if (_this.oprID === originOrpId) return;
    events.forEach(function (item) {
      var path = item.path;

      if (path.length > 0 && path[0] !== CHANGE_CLIENT) {
        // 自己的更改不用更新
        currentTarget = item.currentTarget;
        _this.oprID = originOrpId;
      }
    });

    _this.log('exe :[onObserveDeep]', !!currentTarget, _this.rawPath.join('.'));

    currentTarget && _this.forceRefresh();
  };

  !provider.synced ? provider.on('sync', function (isSynced) {
    if (!isSynced) return;
    _this.cancel = onTargetSync(_this.rawPath, ydoc, function (rawYmap) {
      _this.listenTargetYmap(rawYmap);
    });
  }) : this.cancel = onTargetSync(this.rawPath, ydoc, function (rawYmap) {
    _this.listenTargetYmap(rawYmap);
  });

  this.onChange = function (editorState) {
    return _this.mutex(function () {
      var _this$editorState$all;

      _this.editorState = editorState;
      var raw = transRaw(convertToRaw(editorState.getCurrentContent()));
      if (!_this.value) return _this.value = raw;
      var selection = editorState.getSelection();

      var selectData = _this.getSectionData(selection);

      if (!_this._updatable) return; // console.log(selection.serialize(), selectData, this.isCompositeMode());

      var allowUndo = (_this$editorState$all = _this.editorState.allowUndo) != null ? _this$editorState$all : _this.editorState.getAllowUndo();

      if (_this.shouldAcceptSelection && !selection.isCollapsed()) {
        _this.shouldAcceptSelection = false;
      } // 释放控制


      editorMap[_this.editorKey] = selectData.hasFocus;
      updateAwareness(_this.provider, selectData);
      var newJson = JSON.stringify(raw);
      var rawYmap = getTargetByPath(_this.rawPath, ydoc);
      if (!rawYmap || _this.isConnecting) return;

      if (_this.rawYmap !== rawYmap && !_this.listenTargetYmap(rawYmap)) {
        return;
      }

      if (_this.oldJson === newJson) return; // console.log(newJson, oldJson)

      var delta = diffRaw(_this.value, raw);
      changeYmapByDelta(delta, _this.rawYmap, function () {
        _this.oprID = genKey();

        _this.rawYmap.set(CHANGE_CLIENT, _this.oprID);
      }, allowUndo ? _this.clientID : null);
      _this.oldJson = newJson;
      _this.value = JSON.parse(newJson);
    }, function () {
      console.warn('onChange has been delayed', _this);
    });
  };

  this.bindEditor(_editor);
};

export { DraftBinding, diffPatcher, getNewSelection, getRawBySharedData, getTargetByPath, onTargetSync, raw2rbw, rbw2raw, setRawToSharedData, toRawSharedData, toSyncElement };
