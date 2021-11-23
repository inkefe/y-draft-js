import Dmp from 'diff-match-patch'
import { isEmpty, isEqual } from 'lodash'
import { DiffPatcher } from './jsondiffpatch.esm.js'
import { transRaw } from './utils'

const diffPatcher = new DiffPatcher({
  objectHash: (obj) => {
    if (isEmpty(obj)) return '[]'
    if (Array.isArray(obj)) return JSON.stringify(obj)
    const res = {}
    Object.keys(obj).sort().forEach(key => {
      res[key] = obj[key]
    })
    return JSON.stringify(res)
  },
  textDiff: {
    minLength: 1,
  },
  cloneDiffValues: true
})

const getKeyByEntityData = (entityData) => {
  const { type, data } = entityData
  switch (type) { // 保证在同一行，不同类型的entity的key不重复
    case 'COMMENT':
      return `COMMENT-${Object.values(data).map(i => i.key).join('-')}`
    // case 'OKR':
    //   return `OKR-${data.key}`
    // case 'TABLE':
    //   return `OKR-${data.key}`
    case 'mention':
      return `mention-${data.key || data.mention.name}`
    // case 'IMAGE':
    //   return `IMG`
    // case 'VIDEO':
    //   return `VIDEO`
    default:
      return type;
  }
}
const entityArray2Map = (arr) => {
  const entityRange = {}
  const entity = {}
  const rangeMap = {}
  arr.forEach((item, index) => {
    const entityData = item.key
    const { type, data } = entityData
    const key = getKeyByEntityData(entityData)
    // key = rangeMap[key] ? `${key}-0` : key
    if (type === 'mention') {
      rangeMap[key] = {
        ...item,
        key: {
          ...entityData,
          data: `${data.mention.id}-${data.key || data.mention.name}`
        }
      }
      entity[`${data.mention.id}-${data.key || data.mention.name}`] = data
      entityRange[key] = 1
      return
    }
    if (type === 'COMMENT') {
      const dataKey = {}
      let commentkey = key
      let i = 1
      while (rangeMap[commentkey]) {
        commentkey = `${key}-${i++}`
      }
      entityRange[commentkey] = 1
      Object.values(data).forEach(com => {
        entity[com.key] = com
        dataKey[com.key] = 1
      })
      rangeMap[commentkey] = {
        ...item,
        key: {
          ...entityData,
          data: dataKey
        }
      }
      return
    }
    entityRange[index] = item
  })
  return {
    entityRange,
    rangeMap,
    entity,
  }
}
const entityRange2Array = (entityRanges = [], entityPool, enityRangeMap) => {
  const arr = []
  for (const index in entityRanges) {
    let target = null
    const enityRange = enityRangeMap[index]
    if(!enityRange?.key) continue
    const { type, data } = enityRange.key
    if (type === 'mention') {
      // enityRange.data = entityPool[data]
      target = {
        ...enityRange,
        key: {
          ...enityRange.key,
          data: entityPool[data]
        }
      }
    }
    if (type === 'COMMENT') {
      const comments = {}
      Object.keys(data).forEach((key, i) => {
        comments[i] = entityPool[key]
      })
      target = {
        ...enityRange,
        key: {
          ...enityRange.key,
          data: comments
        }
      }
    }
    target = target || entityRanges[index]
    arr.push(target)
  }
  arr.sort((a, b) => a.offset - b.offset)
  return arr
}

const CONSTANTS_MAP = {
  'ordered-list-item': 'ol',
  'unordered-list-item': 'ul',
}
const raw2rbw = (raw) => {
  if (!raw || typeof raw !== 'object') return raw
  raw = transRaw(raw)
  const { blocks, entityMap } = raw
  const blockMap = {};
  let entityPool = {} // mention和comment的映射的属性池
  let enityRangeMap = {}

  const rbw = {
    blocks: blocks.map(item => {
      const { entityRanges = [], inlineStyleRanges } = item
      const newEntityRanges = entityRanges.map(enti => ({
        ...enti,
        key: entityMap[enti.key]
      }))
      const { entityRange, entity, rangeMap } = entityArray2Map(newEntityRanges)
      entityPool = Object.assign(entityPool, entity)
      enityRangeMap = Object.assign(enityRangeMap, rangeMap)
      blockMap[item.key] = {
        ...item,
        entityRanges: entityRange,
      };
      return item.key
    }) // 用于保留顺序
  }
  rbw.blockMap = blockMap
  rbw.entityPool = entityPool
  rbw.enityRangeMap = enityRangeMap
  return rbw
}

const rbw2raw = (rbw) => {
  const { blocks, blockMap, entityPool, enityRangeMap } = rbw
  const entityMap = {}
  let entityKey = 0
  const commentMap = new Map()
  const newBlocks = blocks.map(key => {
    const entityRanges = entityRange2Array(blockMap[key]?.entityRanges, entityPool, enityRangeMap).map(entity => {
      const data = entity.key
      let key
      if (commentMap.has(data)) {
        key = commentMap.get(data)
      } else {
        key = ++entityKey
        commentMap.set(data, key)
      }
      entityMap[key] = data
      return {
        ...entity,
        key
      }
    })
    return {
      ...blockMap[key],
      entityRanges,
    }
  })
  return {
    blocks: newBlocks,
    entityMap
  }
}

const diffRaw = (preRaw, nextRaw) => {
  const preRbw = raw2rbw(preRaw)
  const nextRbw = raw2rbw(nextRaw)
  const delta = diffPatcher.diff(preRbw, nextRbw)
  return delta
}
const DMP = new Dmp()
const diffString = (txt1, txt2) => {
  return DMP.patch_toText(DMP.patch_make(txt1, txt2));
}
const patchString = (txt, diff, back) => {
  // console.log('patchString', txt, ' => ', diff);
  const results = DMP.patch_apply(DMP.patch_fromText(diff), txt);
  // console.log(JSON.stringify(results));
  for (let i = 0; i < results[1].length; i++) {
    if (!results[1][i]) {
      const _error = new Error('text patch failed');
      _error.textPatchFailed = true;
      return back || txt
    }
  }
  return results[0];
}
const getStringDiffArray = (txt1, txt2) => {
  return DMP.diff_main(txt1, txt2)
}

window.DMP = DMP
window.raw2rbw = raw2rbw
window.rbw2raw = rbw2raw
window.diffRaw = diffRaw
window.diffString = diffString
window.diffPatcher = diffPatcher

export {
  DiffPatcher,
  diffPatcher,
  DMP,
  diffRaw,
  diffString,
  patchString,
  getStringDiffArray,
  raw2rbw,
  rbw2raw
}
