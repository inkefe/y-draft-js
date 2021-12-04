import Dmp from 'diff-match-patch';
import { isEmpty } from 'lodash';
import { DiffPatcher } from 'jsondiffpatch';
import { transRaw, objToArray } from './utils';
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
  switch (
    type // 保证在同一行，不同类型的entity的key不重复
  ) {
    case 'COMMENT':
      return `COMMENT-${Object.values(data)
        .map(i => i.key)
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
const entityArray2Map = arr => {
  const entityRange = {};
  const entity = {};
  const rangeMap = {};
  arr.forEach((item, index) => {
    const entityData = item.key;
    const { type, data } = entityData;
    const key = getKeyByEntityData(entityData);
    // key = rangeMap[key] ? `${key}-0` : key
    if (type === 'mention') {
      rangeMap[key] = {
        length: formatStringLen(item.length),
        offset: formatStringLen(item.offset),
        key: {
          ...entityData,
          data: `${data.mention.id}-${data.key || data.mention.name}`,
        },
      };
      entity[`${data.mention.id}-${data.key || data.mention.name}`] = data;
      entityRange[key] = 1;
      return;
    }
    if (type === 'LINK') {
      rangeMap[key] = {
        length: formatStringLen(item.length),
        offset: formatStringLen(item.offset),
        key: {
          ...entityData,
          data: `link-${data.key || data.url}`,
        },
      };
      entity[`link-${data.key || data.url}`] = data;
      entityRange[key] = 1;
      return;
    }
    if (type === 'COMMENT') {
      const dataKey = {};
      let commentkey = key;
      let i = 1;
      while (rangeMap[commentkey]) {
        commentkey = `${key}-${i++}`;
      }
      entityRange[commentkey] = 1;
      Object.values(data).forEach(com => {
        entity[com.key] = com;
        dataKey[com.key] = 1;
      });
      rangeMap[commentkey] = {
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
    entityRange[index] = item;
  });
  return {
    entityRange,
    rangeMap,
    entity,
  };
};
const entityRange2Array = (entityRanges, entityPool, enityRangeMap) => {
  const arr = [];
  // const isAtomic = Object.keys(entityRanges).every(key => +key >= 0)
  // if (isAtomic) arr.push(objToArray(entityRanges))
  for (const index in entityRanges) {
    let target = null;
    const enityRange = enityRangeMap[index] || entityRanges[index];
    if (!enityRange?.key) continue;
    const { type, data } = enityRange.key;
    if (type === 'mention') {
      // enityRange.data = entityPool[data]
      target = {
        offset: enityRange.offset.length,
        length: enityRange.length.length,
        key: {
          ...enityRange.key,
          data: entityPool[data],
        },
      };
    }
    if (type === 'LINK') {
      target = {
        offset: enityRange.offset.length,
        length: enityRange.length.length,
        key: {
          ...enityRange.key,
          data: entityPool[data],
        },
      };
    }
    if (type === 'COMMENT') {
      const comments = {};
      Object.keys(data).forEach((key, i) => {
        comments[i] = entityPool[key];
      });
      target = {
        offset: enityRange.offset.length,
        length: enityRange.length.length,
        key: {
          ...enityRange.key,
          data: comments,
        },
      };
    }
    target = target || entityRanges[index];
    arr.push(target);
  }
  arr.sort((a, b) => a.offset - b.offset);
  return arr;
};

const raw2rbw = raw => {
  if (!raw || typeof raw !== 'object') return raw;
  raw = transRaw(raw);
  const { blocks, entityMap } = raw;
  const blockMap = {};
  let entityPool = {}; // mention和comment的映射的属性池
  let enityRangeMap = {};

  const rbw = {
    blocks: blocks.map(item => {
      const { entityRanges = [], inlineStyleRanges } = item;
      const newEntityRanges = entityRanges.map(enti => ({
        ...enti,
        key: entityMap[enti.key],
      }));
      const { entityRange, entity, rangeMap } =
        entityArray2Map(newEntityRanges);
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
  const newBlocks = blocks
    .map(key => {
      if (!blockMap[key]) return null;
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
    })
    .filter(Boolean);
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
const DMP = new Dmp();

const getStringDiffArray = (txt1, txt2) => {
  return DMP.diff_main(txt1, txt2);
};

export {
  DiffPatcher,
  diffPatcher,
  DMP,
  diffRaw,
  getStringDiffArray,
  raw2rbw,
  rbw2raw,
};
