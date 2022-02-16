'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var Dmp = require('diff-match-patch');
var _isEmpty = require('lodash/isEmpty');
var jsondiffpatch = require('jsondiffpatch');
require('yjs');
var draftJs = require('draft-js');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var Dmp__default = /*#__PURE__*/_interopDefaultLegacy(Dmp);
var _isEmpty__default = /*#__PURE__*/_interopDefaultLegacy(_isEmpty);

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

var getRaw = function getRaw(texts) {
  if (texts === void 0) {
    texts = '';
  }

  if (!Array.isArray(texts)) texts = [texts];
  return {
    blocks: texts.map(function (text) {
      return {
        key: draftJs.genKey(),
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
  var _raw$blocks = raw.blocks,
      blocks = _raw$blocks === void 0 ? [] : _raw$blocks,
      entityMap = raw.entityMap;
  if (_isEmpty__default["default"](entityMap)) raw.entityMap = {};
  blocks.forEach(function (block) {
    if (_isEmpty__default["default"](block.data)) block.data = {};
  });
  return raw;
}; // 对方法进行封装，防止内部报错
new Dmp__default["default"](); // 计算序号, 默认不跟随内容更改

Array.prototype.arrayToObj = function () {
  return _extends({}, this);
};

var diffPatcher = new jsondiffpatch.DiffPatcher({
  objectHash: function objectHash(obj) {
    if (_isEmpty__default["default"](obj)) return '[]';
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
    var entityData = item.key; // if (!entityData) console.log(item);

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

var patchRaw = function patchRaw(preRaw, delta) {
  var preRbw = raw2rbw(preRaw);
  var rbw = diffPatcher.patch(preRbw, delta);
  return rbw2raw(rbw);
};

var DMP = new Dmp__default["default"]();

var getStringDiffArray = function getStringDiffArray(txt1, txt2) {
  return DMP.diff_main(txt1, txt2);
};

exports.DMP = DMP;
exports.diffPatcher = diffPatcher;
exports.diffRaw = diffRaw;
exports.getStringDiffArray = getStringDiffArray;
exports.patchRaw = patchRaw;
exports.raw2rbw = raw2rbw;
exports.rbw2raw = rbw2raw;
