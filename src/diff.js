import Dmp from 'diff-match-patch';
import isEmpty from 'lodash/isEmpty';
import { DiffPatcher } from 'jsondiffpatch';
import { transRaw, objToArray, getRaw } from './utils';
// eslint-disable-next-line no-extend-native
Array.prototype.arrayToObj = function () {
  return { ...this };
};
const diffPatcher = new DiffPatcher({
  objectHash: obj => {
    if (isEmpty(obj)) return '[]';
    if (Array.isArray(obj)) return JSON.stringify(obj);
    const res = {};
    Object.keys(obj)
      .sort()
      .forEach(key => {
        res[key] = obj[key];
      });
    return JSON.stringify(res);
  },
  textDiff: {
    minLength: 1,
  },
  cloneDiffValues: true,
});

const formatStringLen = (length, char = '1') => {
  return Array.from({ length }).fill(char).join('');
};

const getKeyByEntityData = entityData => {
  const { type, data } = entityData;
  if (!data) return '';
  switch (
    type // 保证在同一行，不同类型的entity的key不重复
  ) {
    case 'COMMENT':
      return `COMMENT-${Object.values(data)
        .filter(Boolean)
        .map(i => i.unique || i.key)
        .join('-')}`;
    case 'LINK':
      return `LINK-${data.key || data.url}`;
    // case 'TABLE':
    //   return `OKR-${data.key}`
    case 'mention':
      return `mention-${data.key || data.mention.name}`;
    // case 'IMAGE':
    //   return `IMG`
    // case 'VIDEO':
    //   return `VIDEO`
    default:
      return type;
  }
};
const entityArray2Map = (arr, globalRangeMap) => {
  const entityRange = {};
  const entity = {};
  const rangeMap = {};
  arr.forEach((item, index) => {
    const entityData = item.key;
    if (!entityData) return;
    const { type, data } = entityData;
    const key = getKeyByEntityData(entityData);
    // key = rangeMap[key] ? `${key}-0` : key
    if (type === 'mention' && key) {
      rangeMap[key] = {
        length: formatStringLen(item.length),
        offset: formatStringLen(item.offset),
        key: {
          ...entityData,
          data: `${data.mention.id}-${data.key || data.mention.name}`,
        },
      };
      entity[`${data.mention.id}-${data.key || data.mention.name}`] = data;
      entityRange[key] = index;
      return;
    }
    if (type === 'LINK' && key) {
      rangeMap[key] = {
        length: formatStringLen(item.length),
        offset: formatStringLen(item.offset),
        key: {
          ...entityData,
          data: `link-${data.key || data.url}`,
        },
      };
      entity[`link-${data.key || data.url}`] = data;
      entityRange[key] = index;
      return;
    }
    if (type === 'COMMENT' && key) {
      const dataKey = {};
      if (key === 'COMMENT-') {
        return;
      }
      let commentkey = key;
      let i = 1;
      while (globalRangeMap[commentkey]) {
        commentkey = `${key}-${i++}`;
      }
      entityRange[commentkey] = index;
      Object.values(data).forEach(com => {
        entity[com.unique || com.key] = com;
        dataKey[com.unique || com.key] = 1;
      });
      rangeMap[commentkey] = globalRangeMap[commentkey] = {
        length: formatStringLen(item.length),
        offset: formatStringLen(item.offset),
        key: {
          ...entityData,
          data: dataKey,
        },
      };
      return;
    }
    // rangeMap[key] = {
    //   length: formatStringLen(item.length),
    //   offset: formatStringLen(item.offset),
    //   key: entityData,
    // }
    entityRange[index] = {
      ...item,
      length: formatStringLen(item.length),
      offset: formatStringLen(item.offset),
    };
  });
  return {
    entityRange,
    rangeMap,
    entity,
  };
};
const entityRange2Array = (entityRanges, entityPool, enityRangeMap) => {
  const arr = [];
  for (const index in entityRanges) {
    let target = null;
    const enityRange = enityRangeMap[index] || entityRanges[index];
    if (!enityRange?.key) continue;
    const { type, data } = enityRange.key;
    const offset = enityRange.offset.length;
    const length = enityRange.length.length;
    if (type === 'mention' && data) {
      // enityRange.data = entityPool[data]
      target = {
        offset,
        length,
        key: {
          ...enityRange.key,
          data: entityPool[data],
        },
      };
    }
    if (type === 'LINK' && data) {
      target = {
        offset,
        length,
        key: {
          ...enityRange.key,
          data: entityPool[data],
        },
      };
    }
    if (type === 'COMMENT' && data) {
      const comments = {};
      Object.keys(data).forEach((key, i) => {
        comments[i] = entityPool[key];
      });
      target = {
        offset,
        length,
        key: {
          ...enityRange.key,
          data: comments,
        },
      };
    }
    target = target || {
      ...entityRanges[index],
      offset,
      length,
    };
    const i = isNaN(Number(index)) ? entityRanges[index] : Number(index);
    arr[i] = target;
  }
  return arr;
};

const raw2rbw = raw => {
  if (!raw || typeof raw !== 'object') return raw;
  raw = transRaw(raw);
  const { blocks, entityMap } = raw;
  const blockMap = {};
  let entityPool = {}; // mention和comment的映射的属性池
  let enityRangeMap = {};
  const globalRangeMap = {};

  const rbw = {
    blocks: blocks.map(item => {
      const { entityRanges = [], inlineStyleRanges } = item;
      const newEntityRanges = entityRanges.map(enti => ({
        // offset: formatStringLen(enti.offset),
        // length: formatStringLen(enti.length),
        ...enti,
        key: entityMap[enti.key],
      }));
      const { entityRange, entity, rangeMap } = entityArray2Map(
        newEntityRanges,
        globalRangeMap
      );
      entityPool = Object.assign(entityPool, entity);
      enityRangeMap = Object.assign(enityRangeMap, rangeMap);
      blockMap[item.key] = {
        ...item,
        inlineStyleRanges: inlineStyleRanges
          .map(item => ({
            ...item,
            length: formatStringLen(item.length),
            offset: formatStringLen(item.offset),
          }))
          .arrayToObj(),
        entityRanges: entityRange,
      };
      return item.key;
    }), // 用于保留顺序
  };
  rbw.blockMap = blockMap;
  rbw.entityPool = entityPool;
  rbw.enityRangeMap = enityRangeMap;
  return rbw;
};

const rbw2raw = rbw => {
  const { blocks, blockMap, entityPool, enityRangeMap } = rbw;
  if (!rbw || !blocks) return rbw;
  const entityMap = {};
  let entityKey = 0;
  const commentMap = new Map();
  const newBlocks = blocks.map(key => {
    if (!blockMap[key]) return getRaw().blocks[0];
    const entityRanges = entityRange2Array(
      blockMap[key].entityRanges,
      entityPool,
      enityRangeMap
    ).map(entity => {
      const data = entity.key;
      let key;
      if (commentMap.has(data)) {
        key = commentMap.get(data);
      } else {
        key = ++entityKey;
        commentMap.set(data, key);
      }
      entityMap[key] = data;
      return {
        ...entity,
        key,
      };
    });
    return {
      ...blockMap[key],
      inlineStyleRanges: objToArray(blockMap[key].inlineStyleRanges).map(
        item => ({
          ...item,
          length: item.length?.length || 0,
          offset: item.offset?.length || 0,
        })
      ),
      entityRanges,
    };
  });
  return {
    blocks: newBlocks,
    entityMap,
  };
};

const diffRaw = (preRaw, nextRaw) => {
  const preRbw = raw2rbw(preRaw);
  const nextRbw = raw2rbw(nextRaw);
  const delta = diffPatcher.diff(preRbw, nextRbw);
  return delta;
};

const patchRaw = (preRaw, delta) => {
  const preRbw = raw2rbw(preRaw);
  const rbw = diffPatcher.patch(preRbw, delta);
  return rbw2raw(rbw);
};
const DMP = new Dmp();

const getStringDiffArray = (txt1, txt2) => {
  return DMP.diff_main(txt1, txt2);
};

export {
  diffPatcher,
  DMP,
  diffRaw,
  patchRaw,
  getStringDiffArray,
  raw2rbw,
  rbw2raw,
};
