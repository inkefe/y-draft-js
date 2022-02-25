const randomjson = require('randomjson');
const { objToArray } = require('../src/utils');
const fs = require('fs-extra')
const types = ['IMAGE', 'COMMENT', 'LINK', 'TIP-TABLE', 'mention'];

function logFile(path, data) {
  fs.ensureFileSync(`./temp/${path}`)
  fs.writeJsonSync(`./temp/${path}`, data)
}

exports.logFile = logFile
function arrToObj(arr, base = 0) {
  const res = {}
  if (!arr) return res
  arr.forEach((item, index) => {
    res[index + base] = item
  })
  return res
}

/**
 *  get random Number
 * @param {number, number} min max return r (min ≤ r < max)
 */
 function getRandomNumBoth (Min, Max) {
  const Range = Max - Min
  const Rand = Math.random()
  const num = Min + Math.floor(Rand * Range)
  return num
}
const TEXT = '<@string{0,2000}>'
const OFFSET = '<@[0-1900]>'
const LENGTH = '<@[0-200]>'

const getCommentData = () => {
  return arrToObj(randomjson({
    'data<@{1,3}>': [
      {
        'unique': '<@string{5}>',
        'anchorKey': '<@string{5}>',
        'selectedText': '<@string{2, 15}>',
        'resolved': '<@[0,1]>',
        'comment_id': '<@[1000-9999]>'
      }
    ]
  }).data)
}

const getRandomEntity = () => {
  const type = types[getRandomNumBoth(0, types.length)]
  switch (type) {
    case 'IMAGE':
      return {
        type,
        mutability: 'IMMUTABLE',
        'data': randomjson({
          'alt': '<@string{5,8}>',
          'src': '<@string{5,38}>'
        })
      }
    case 'COMMENT':
      return {
        type,
        mutability: 'MUTABLE',
        data: getCommentData()
      }
    case 'mention':
      return {
        type,
        mutability: "SEGMENTED",
        data: randomjson({
          "mention": {
              "id": "<@[10-9999]>",
              "name": "<@string{5}>",
              "pinyin": "<@string{5}>"
          },
          "key": "<@string{5}>"
        })
      }
    case 'LINK':
      return {
        type,
        mutability: 'MUTABLE',
        'data': randomjson({
            'url': '<@string{5,38}>',
            'target': '_blank'
        })
      }
    case 'TIP-TABLE':
      return {
        type,
        mutability: 'IMMUTABLE',
        data: randomjson({
          "rows": '<@[2-99]>',
          "cols": '<@[2-99]>',
          "key": "<@string{5}>",
          "isInit": '<@[0-1]>',
          "create_uid": "<@[10-9999]>",
          "table_id": "<@string{10}>"
        })
      }
  }
}


const RandomBlockJson = {
  'key': '<@string{5}>',
  'text': TEXT,
  'type': '<@string{4,7}>',
  'depth': 0,
  'data': {},
  'inlineStyleRanges<@{0,5}>': [
    {
      'offset': OFFSET,
      'length': LENGTH,
      'style': '<@string{5}>'
    }
  ],
  'entityRanges<@{0,5}>': [
    {
      'offset': OFFSET,
      'length': LENGTH,
      'key': 6
    }
  ],
}

function getRandomRaw(isLarge) {
  const blocks = Array.from({ length: getRandomNumBoth(1, isLarge ? 300 : 20) }).map(() => randomjson(RandomBlockJson))
  let index = 0;
  blocks.forEach(block => {
    block.entityRanges = block.entityRanges.sort((a, b) => a.offset - b.offset).map(entityRange => {
      index = index + 1
      return {
        ...entityRange,
        key: index
      }
    });
    block.inlineStyleRanges.sort((a, b) => a.offset - b.offset);
  })
  const entityMap = arrToObj(Array.from({ length: index }).map(() => {
    const entity = getRandomEntity()
    return entity
  }), 1)
  return { blocks, entityMap }
}

// ========================================================

function mockAddEntity(raw) {
  raw = JSON.parse(JSON.stringify(raw))
  const { blocks, entityMap } = raw
  const entityMapArr = objToArray(entityMap);

  const blockIndex = getRandomNumBoth(0, blocks.length);
  let curKey = entityMapArr.length + 1;
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blockIndex > i) continue
    const block = blocks[i]
    if (blockIndex === i) {
      const en = randomjson({
        'offset': OFFSET,
        'length': LENGTH,
        'key': 'temp'
      })
      let hadChange = false
      block.entityRanges.push(en)
      block.inlineStyleRanges.sort((a, b) => a.offset - b.offset)
      const es = block.entityRanges.sort((a, b) => a.offset - b.offset)
      for(let j = es.length - 1; j >= 0; j--) {
        const item = es[j]
        if(item.key !== 'temp') {
          if(hadChange) continue
          curKey = item.key
          item.key = item.key + 1
          continue
        }
        item.key = curKey
        hadChange = true
      }
      continue
    }
    block.entityRanges = block.entityRanges.map(entityRange => {
      curKey = Math.min(curKey, entityRange.key)
      entityRange.key = entityRange.key + 1
      return entityRange
    });
  }
  const entity = getRandomEntity()

  // console.log('mockAddEntity', blockIndex, entity);
  entityMapArr.splice(curKey - 1, 0, entity);
  const newEntityMap = arrToObj(entityMapArr, 1);

  return {
    blocks,
    entityMap: newEntityMap
  }
}

function mockRemoveEntity(raw, blockIndex) {
  raw = JSON.parse(JSON.stringify(raw))
  const { entityMap, blocks } = raw
  const entityMapArr = objToArray(entityMap);
  blockIndex = blockIndex ?? getRandomNumBoth(0, blocks.length)
  console.log('mockRemoveEntity', blockIndex);
  let hadChange = false
  block.forEach((block, index) => {
    if (blockIndex === index) {
      const removeIndex = getRandomNumBoth(0, block.entityRanges.length)
      block.entityRanges = block.entityRanges.map((entityRange, i) => {
        if(i === removeIndex) {
          return null
        }
        return {
          ...entityRange,
          key: i > removeIndex ? (entityRange.key - 1) : entityRange.key
        }
      })
      hadChange = true
    }
    if (!hadChange) return
    block.entityRanges = block.entityRanges.map(entityRange => {
      return {
        ...entityRange,
        key: entityRange.key - 1
      }
    })
  })
  // entityMapArr.splice(deleteKey, 1);
  const newEntityMap = arrToObj(entityMapArr, 1);

  return {
    blocks,
    entityMap: newEntityMap
  }
}

function changeText(raw, index, text) {
  const randomNumber = getRandomNumBoth(0, 10) // 0 1 2 3
  if(randomNumber === 0 && randomNumber === 1) {
    raw = mockRemoveEntity(raw, index)
  }
  if(randomNumber === 2) {
    raw = mockAddEntity(raw)
  }
  // console.log('changeText', index, text);
  const { entityMap, blocks } = raw
  const canChange = () => !!getRandomNumBoth(0, 3)
  const getLength = () => getRandomNumBoth(1, 200)
  const newBlock =  blocks.map(i => ({
    ...i,
    text,
    entityRanges: i.entityRanges.map(item => ({
      ...item,
      length: canChange() ? getLength() : item.length
    })),
    inlineStyleRanges: i.entityRanges.map(item => ({
      ...item,
      length: canChange() ? getLength() : item.length
    })),
  }))
  return {
    blocks: newBlock,
    entityMap,
  }
}

function removeBlock (raw, index) {
  const { entityMap, blocks } = raw
  if (blocks.length === 1) return addBlock(raw, index)
  console.log('removeBlock', index);
  const entityMapArr = objToArray(entityMap);
  let removeLength = 0
  const newBlock = blocks.map((b, i) => {
    if(index === i) {
      removeLength = b.entityRanges.length
      b.entityRanges.forEach(en => {
        entityMapArr[en.key - 1] = null
      })
      return null
    }
    if(i > index) {
      return {
        ...b,
        entityRanges: b.entityRanges.map(item => ({
          ...item,
          key: item.key - removeLength
        }))
      }
    }
    return b
  }).filter(Boolean)
  const newEntityMap = arrToObj(entityMapArr.filter(Boolean), 1);
  return {
    blocks: newBlock,
    entityMap: newEntityMap,
  }
}

function addBlock(raw, index) {
  const { entityMap } = raw
  const blocks = JSON.parse(JSON.stringify(raw.blocks))
  const entityMapArr = objToArray(entityMap);
  const newBlock = randomjson(RandomBlockJson)
  newBlock.entityRanges.sort((a, b) => a.offset - b.offset);
  newBlock.inlineStyleRanges.sort((a, b) => a.offset - b.offset);
  const newBlocks = []

  // console.log('addBlock', JSON.stringify(newBlock), index, entityMapArr.length);

  let entityKey = entityMapArr.length + 1 // 11
  for(let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i]
    if(i < index) {
      newBlocks.unshift(b)
      continue
    }
    newBlocks.unshift({
      ...b,
      entityRanges: b.entityRanges.map(item => {
        entityKey = Math.min(item.key, entityKey) // 12 11
        return {
          ...item,
          key: item.key + newBlock.entityRanges.length
        }
      })
    })
    if (i === index) {
      const enti = []
      newBlock.entityRanges = newBlock.entityRanges.map((item, i) => {
        enti.push(getRandomEntity())
        return {
          ...item,
          key: entityKey + i
        }
      })
      entityMapArr.splice(entityKey - 1, 0, ...enti)
      newBlocks.unshift(newBlock)
    }
    // b.entityRanges.forEach(en => {
    //   // if(i < index) entityKey = en.key
    //   // else 
    //   entityKey = en.key
    //   en.key = en.key + newBlock.entityRanges.length
    // })
  }
  // console.log('newBlocks', JSON.stringify(newBlocks));
  const newEntityMap = arrToObj(entityMapArr, 1);
  return {
    blocks: newBlocks,
    entityMap: newEntityMap
  }
}
function randomChangeRaw(raw) {
  const type = getRandomNumBoth(0, 11)
  switch (type) {
    case 0:
    case 1:
    case 2:
    case 3:
    case 4: { // changeText
      return changeText(raw, getRandomNumBoth(0, raw.blocks.length))
    }
    case 5:
    case 6:
    case 7: { // addEntity
      return mockAddEntity(raw)
    }
    case 8: {
      return addBlock(raw, getRandomNumBoth(0, raw.blocks.length))
    }
    case 9: {
      return removeBlock(raw, getRandomNumBoth(0, raw.blocks.length))
    }
    case 10: { // replace
      const index =  getRandomNumBoth(0, raw.blocks.length)
      const res = removeBlock(raw, index)
      return addBlock(res, index)
    }
    default: return raw
  }
}
exports.getRandomRaw = getRandomRaw

exports.randomChangeRaw = randomChangeRaw
