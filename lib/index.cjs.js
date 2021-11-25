'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var mutex_js = require('lib0/mutex.js');
var draftJs = require('draft-js');
var Y = require('yjs');
var Dmp = require('diff-match-patch');
var lodash = require('lodash');
var jsondiffpatch_umd = require('jsondiffpatch/dist/jsondiffpatch.umd');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

function _interopNamespace(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n["default"] = e;
  return Object.freeze(n);
}

var Y__namespace = /*#__PURE__*/_interopNamespace(Y);
var Dmp__default = /*#__PURE__*/_interopDefaultLegacy(Dmp);

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
var DMP$1 = new Dmp__default["default"](); // 计算序号, 默认不跟随内容更改

var diffIndex = function diffIndex(diffArr, index, needFlow) {
  var curIndex = DMP$1.diff_xIndex(diffArr, index);
  if (needFlow) return curIndex;
  if (index === 0) return 0;
  var lastIndex = DMP$1.diff_xIndex(diffArr, index - 1);
  if (lastIndex === index - 1 && curIndex !== index) return index;
  return curIndex;
};

var getStringDiffArray = function getStringDiffArray(txt1, txt2) {
  return DMP$1.diff_main(txt1, txt2);
};

var transToObj = function transToObj(raw) {
  return typeof raw === 'string' && raw.match(/^({|\[)/) ? tryCatchFunc(function (raw) {
    return JSON.parse(raw);
  })(raw) || raw : raw;
}; // RAW转text

var rawToText = function rawToText(raw) {
  raw = transToObj(raw);
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
  var editorText = rawToText(raw);
  var oldEditorText = contentState.getPlainText();
  var textDiff = getStringDiffArray(oldEditorText, editorText); // console.log(startKey, endKey, start, end);

  if (textDiff.length === 1 && textDiff[0][0] === 0) {
    // 文本内容没有变化，保留原来的选择状态
    return new draftJs.SelectionState({
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
    return new draftJs.SelectionState(newParmas);
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


  return new draftJs.SelectionState(newParmas);
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
    return Object.keys(diff).reverse().map(function (key) {
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
    var _DMP$patch_fromText$ = DMP$1.patch_fromText(diff[0])[0],
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

function toSyncElement(item, path) {

  if (typeof item === 'string') {
    var textElement = new Y__namespace.Text(item);
    return textElement;
  }

  if (Array.isArray(item)) {
    var childElements = item.map(function (item) {
      return toSyncElement(item);
    });
    var arrayElement = new Y__namespace.Array();
    arrayElement.insert(0, childElements);
    return arrayElement;
  }

  if (item && typeof item === 'object') {
    var mapElement = new Y__namespace.Map();
    Object.keys(item).forEach(function (key) {
      mapElement.set(key, toSyncElement(item[key]));
    });
    return mapElement;
  } // if(typeof item === 'number' && (path[path.length - 1] === 'offset' || path[path.length - 1] === 'length')) {
  // }


  return item === void 0 ? '' : item;
}
var getTargetByPath = function getTargetByPath(path, target, cb) {
  if (path.length === 0) return target;
  return path.reduce(function (t, key, index) {
    if (!t) {
      return console.warn("Could not find target according to path " + path.join('.') + ", it is recommended that you use 'onTargetSync' to listen for the value of the path");
    }

    var res = t.get(key);
    !res && console.log(path, target, key);
    return res;
  }, target);
};
var changeYmapByDelta = function changeYmapByDelta(delta, ymap, syncOpr) {
  if (!delta || delta.length === 0) return;
  var operations = getDeltaArray(delta, []);
  if (operations.length === 0) return;
  var ydoc = ymap.doc; // console.log(operations, delta);

  ydoc.transact(function () {
    operations.forEach(function (opr) {
      applyYDocOp(opr, ymap);
    });
    syncOpr && syncOpr.apply && syncOpr(ymap);
  });
};

var applyYDocOp = function applyYDocOp(opr, ymap) {
  var type = opr.type,
      path = opr.path,
      action = opr.action,
      value = opr.value,
      index = opr.index,
      length = opr.length;

  if (type === 'string') {
    var target = getTargetByPath(path, ymap); // console.log(target, path, index, value);

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

      var item = _target.get(index);

      _target.delete(index, 1);

      return moveToLast ? _target.push([item]) : _target.insert(value, [item]); // 最后一位是push方法
    }
  }

  if (type === 'object') {
    var _index2 = path.length - 1;

    var _target2 = getTargetByPath(path.slice(0, -1), ymap); // while(index < path.length && ymap.get[path[index]]) {
    //   target = ymap.get[path[index]]
    //   index++
    // }
    // index-- //退到此时真值的位置
    // if(index === path.length - 1) { // 遍历到底了,操作的就是最后的一个父元素
    //   target = target.parent
    //   index = index - 1


    if (action === 'delete') {
      return _target2.delete(path[_index2]);
    }

    if (action === 'replace') {
      return _target2.set(path[_index2], value);
    } // }
    // path没遍历到底，delete不需要处理了，replace需要补齐数据，防止undefined报错
    // if(action !== 'replace') return
    // index++
    // for(; index < path.length; index++) {
    //   target.set(path[index], index === path.length - 1 ? value : new Y.Map())
    //   target = target.get(path[index])
    // }

  }
}; // 获取指定路径的数据，如果有值则用回调返回，如果没有则自动监听到目标值出现，并返回的cancle方法可以取消监听


var onTargetSync = function onTargetSync(path, ymap, cb) {
  if (!ymap) return console.warn('ymap is undefined');
  if (!cb) return console.warn('callback is necessary in onTargetSync');
  var target = getTargetByPath(path, ymap);

  if (target) {
    cb(target);
    return;
  }

  function ob() {
    var target = getTargetByPath(path, ymap);
    if (!target) return; // 等待目标字段的内容出现

    cb(target);
    ymap.unobserveDeep(ob);
  }

  ymap.observeDeep(ob);
  return function () {
    ymap.unobserveDeep(ob);
  };
};

Node.prototype.removeChild = tryCatchFunc(Node.prototype.removeChild);

var diffPatcher = new jsondiffpatch_umd.DiffPatcher({
  objectHash: function objectHash(obj) {
    if (lodash.isEmpty(obj)) return '[]';
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
    }

    entityRange[index] = item;
  });
  return {
    entityRange: entityRange,
    rangeMap: rangeMap,
    entity: entity
  };
};

var entityRange2Array = function entityRange2Array(entityRanges, entityPool, enityRangeMap) {
  if (entityRanges === void 0) {
    entityRanges = [];
  }

  var arr = [];

  for (var index in entityRanges) {
    var target = null;
    var enityRange = enityRangeMap[index];
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
        }),
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
      inlineStyleRanges: blockMap[key].inlineStyleRanges.map(function (item) {
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

var DMP = new Dmp__default["default"]();

var diffString = function diffString(txt1, txt2) {
  return DMP.patch_toText(DMP.patch_make(txt1, txt2));
};

window.DMP = DMP;
window.raw2rbw = raw2rbw;
window.rbw2raw = rbw2raw;
window.diffRaw = diffRaw;
window.diffString = diffString;
window.diffPatcher = diffPatcher;

// import * as error from 'lib0/error.js'

var getRawBySharedData = function getRawBySharedData(rawPath, ymap) {
  !Array.isArray(rawPath) && (rawPath = [rawPath]);
  var target = getTargetByPath(rawPath, ymap);
  if (!target) return null;
  var rbw = target.toJSON();
  var raw = rbw2raw(rbw);

  if (raw.blocks.length !== rbw.blocks.length) {
    ymap.set(rawPath, toRawSharedData(raw));
  } // 修复


  return raw;
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
var CHANGE_CLIENT = 'CHANGE_CLIENT'; // 用于识别是不是自己的更新

var DraftBinding = /*#__PURE__*/function () {
  function DraftBinding(opts) {
    var _this = this;

    this.forceRefresh = function (target) {
      var raw = getRawBySharedData(_this.rawPath, target.parent);

      _this.muxSetRaw(raw);
    };

    this.muxSetRaw = function (raw) {
      _this._waitUpdateTarget = null;

      _this.mutex(function () {
        _this.setStateByRaw(raw);
      }, function () {
        console.warn('setStateByRaw has been delayed');
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
        rawYmap.set(CHANGE_CLIENT, toSyncElement(_this.oprID));
      }

      _this.value = rbw2raw(rawYmap.toJSON());
      rawYmap.observeDeep(_this.onObserveDeep); // observeDeep this editor's raw
    };

    this.bindEditor = function (editor) {
      var _this$getEditorContai;

      // 支持异步绑定编辑器
      if (!editor) return;
      _this.editor = editor;
      (_this$getEditorContai = _this.getEditorContainer()) == null ? void 0 : _this$getEditorContai.addEventListener('click', _this.releaseSelection);
      _this._update = _this.editor.update; // listen to changes

      _this._update && (_this.editor.update = function () {
        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this.onChange.apply(_this, args);

        _this._update.apply(_this.editor, args);

        if (_this._waitUpdateTarget) {
          _this.editorState = args[0];

          _this.muxSetRaw(_this._waitUpdateTarget);
        }
      });
      if (_this._update) return;
      _this._onChange = _this.editor.onChange;
      _this._onChange && (_this.editor.onChange = function () {
        for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
          args[_key2] = arguments[_key2];
        }

        _this.onChange.apply(_this, args);

        _this._onChange.apply(_this.editor, args);

        if (_this._waitUpdateTarget) {
          _this.editorState = args[0];

          _this.muxSetRaw(_this._waitUpdateTarget);
        }
      });
    };

    this.getEditorContainer = function () {
      if (!_this.editor) return null;
      return _this.editor.editorContainer || _this.editor.editor.editorContainer;
    };

    this.getEditorState = function () {
      return _this.editorState || _this.editor.props.editorState || _this.editor.state.editorState;
    };

    this.setStateByRaw = function (raw) {
      var _onChange = _this._update || _this._onChange;

      if (!raw || !raw.blocks || !_onChange) return;

      var editorState = _this.getEditorState();

      var selectionState = editorState.getSelection();
      var newEditorState = draftJs.EditorState.push(editorState, draftJs.convertFromRaw(raw), 'sycn-change');
      var isCollapsed = selectionState.isCollapsed();

      if (!selectionState.getHasFocus() && isCollapsed) {
        _this.editorState = newEditorState;
        _this.value = raw;
        return _onChange.call(_this.editor, _this.editorState);
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

      console.log(_this.shouldAcceptSelection);
      _this.editorState = draftJs.EditorState[isCollapsed || _this.shouldAcceptSelection ? 'acceptSelection' : 'forceSelection'](newEditorState, newSelection);
      _this.value = raw;

      _onChange.call(_this.editor, _this.editorState);
    };

    this.releaseSelection = function () {
      _this.shouldAcceptSelection = true;
    };

    this.decorations = new Map();
    var ymap = opts.ymap,
        _rawPath = opts.rawPath,
        _editor = opts.editor,
        provider = opts.provider;
        opts.parmas;
    var rawPath = _rawPath;
    !Array.isArray(rawPath) && (rawPath = [rawPath]);
    this.doc = ymap.doc;
    this.ymap = ymap;
    this.awareness = provider.awareness;
    this.mutex = mutex_js.createMutex();
    this.rawPath = rawPath;
    console.log('DraftBinding', opts, getTargetByPath(this.rawPath, ymap), _editor, provider); // editor._onSelect = e => {
    //   editor._onSelect(e)
    //   this._onSelect(e)
    // }
    // this.value = rbw2raw(ymap.get(key)?.toJSON())
    // console.log(this.value, this.rawPath);
    // ymap.doc.on('afterTransaction', update => {
    //   console.log(update, 'afterTransaction');
    // })

    provider.on('sync', function (isSynced) {
      if (!isSynced) return;
      _this.cancel = onTargetSync(_this.rawPath, ymap, function (rawYmap) {
        _this.listenTargetYmap(rawYmap);
      });
    });

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
    }; // editor.onDidChangeCursorSelection(() => {
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


    this.onChange = function (editorState) {
      return _this.mutex(function () {
        _this.editorState = editorState;
        var raw = transRaw(draftJs.convertToRaw(editorState.getCurrentContent()));
        if (!_this.value) return _this.value = raw;

        if (_this.shouldAcceptSelection && !editorState.getSelection().isCollapsed()) {
          _this.shouldAcceptSelection = false;
        } // 释放控制


        var newJson = JSON.stringify(raw);
        var oldJson = JSON.stringify(_this.value);
        if (oldJson === newJson) return; // console.log(newJson, oldJson)

        var delta = diffRaw(_this.value, raw);
        changeYmapByDelta(delta, getTargetByPath(_this.rawPath, _this.ymap), function (ymap) {
          _this.oprID = _this.oprID + '0';

          _this.oprYText.insert(_this.oprID.length, '0');
        });
        _this.value = JSON.parse(newJson);
      }, function () {
        console.warn('onChange has been delayed');
      });
    };

    this.bindEditor(_editor);
  }

  var _proto = DraftBinding.prototype;

  // 渲染光标
  // rerenderDecorations = () => {
  //   // const currentDecorations = this.decorations.get(this.editor) || []
  //   const newDecorations = []
  //   this.awareness.getStates().forEach((state, clientID) => {
  //     if (clientID !== this.doc.clientID && state.selection != null && state.selection.anchor != null && state.selection.head != null) {
  //       const anchorAbs = Y.createAbsolutePositionFromRelativePosition(state.selection.anchor, this.doc)
  //       const headAbs = Y.createAbsolutePositionFromRelativePosition(state.selection.head, this.doc)
  //       if (anchorAbs !== null && headAbs !== null && anchorAbs.type === ytext && headAbs.type === ytext) {
  //         let start, end, afterContentClassName, beforeContentClassName
  //         if (anchorAbs.index < headAbs.index) {
  //           start = monacoModel.getPositionAt(anchorAbs.index)
  //           end = monacoModel.getPositionAt(headAbs.index)
  //           afterContentClassName = 'yRemoteSelectionHead'
  //           beforeContentClassName = null
  //         } else {
  //           start = monacoModel.getPositionAt(headAbs.index)
  //           end = monacoModel.getPositionAt(anchorAbs.index)
  //           afterContentClassName = null
  //           beforeContentClassName = 'yRemoteSelectionHead'
  //         }
  //         // newDecorations.push({
  //         //   range: new SelectionState(start.lineNumber, start.column, end.lineNumber, end.column),
  //         //   options: {
  //         //     className: 'yRemoteSelection',
  //         //     afterContentClassName,
  //         //     beforeContentClassName
  //         //   }
  //         // })
  //       }
  //     }
  //   })
  //   // this.decorations.set(editor, editor.deltaDecorations(currentDecorations, newDecorations))
  // }
  _proto.destroy = function destroy() {
    var _this$getEditorContai2, _this$cancel;

    console.warn('y-darf-js is destoryed');
    (_this$getEditorContai2 = this.getEditorContainer()) == null ? void 0 : _this$getEditorContai2.removeEventListener('mousedown', this.releaseSelection);
    this._update && this.editor && (this.editor.update = this._update);
    this._onChange && this.editor && (this.editor.onChange = this._onChange);
    this.mutex = null;
    (_this$cancel = this.cancel) == null ? void 0 : _this$cancel.call(this); // this._monacoChangeHandler.dispose()

    this.rawYmap && this.rawYmap.unobserveDeep(this.onObserveDeep); // this.doc.off('beforeAllTransactions', this._beforeTransaction)

    if (this.awareness !== null) {
      // @ts-ignore
      this.awareness.off('change', this.rerenderDecorations);
    }
  };

  return DraftBinding;
}();

exports.DraftBinding = DraftBinding;
exports.getRawBySharedData = getRawBySharedData;
exports.getTargetByPath = getTargetByPath;
exports.onTargetSync = onTargetSync;
exports.toRawSharedData = toRawSharedData;