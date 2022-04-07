const { getRandomRaw, randomChangeRaw, logFile } = require('./utils');
const { setRawToSharedData, getRawBySharedData } = require('../src/index')
const { diffRaw, diffPatcher, raw2rbw, rbw2raw } = require('../src/diff');
const { changeYmapByDelta } = require('../src/utils')
const fs = require('fs-extra')
const Y = require('yjs')

function sleep(ms) {
  return new Promise(resolve=> setTimeout(resolve, ms))
}
const ydoc = new Y.Doc();
const raw = {
  'blocks': [
      {
          'key': '649ma',
          'text': '1',
          'type': 'unstyled',
          'depth': 0,
          'inlineStyleRanges': [],
          'entityRanges': [],
          'data': {}
      },],
    'entityMap': {},
}

const newRaw = {
  'blocks': [
      {
          'key': '649ma',
          'text': 'accbb',
          'type': 'unstyled',
          'depth': 0,
          'inlineStyleRanges': [],
          'entityRanges': [],
          'data': {}
      },],
    'entityMap': {},
}
const rawYmap = ydoc.getMap('raw')
// jest.setTimeout(15000)
/**
test('test change yjs', () => {
  
  setRawToSharedData('raw', ydoc, raw);
  let preRaw = raw
  return new Promise(resolve => {
     const start = () => {
      for (let i = 0; i < 1000; i++) {
        logFile(`preRaw_${i}.json`, JSON.parse(JSON.stringify(preRaw)))
        const newRaw = randomChangeRaw(preRaw)
        logFile(`newRaw_${i}.json`, JSON.parse(JSON.stringify(newRaw)))
        const delta = diffRaw(preRaw, newRaw);
        changeYmapByDelta(
          delta,
          rawYmap
        );
        // logFile(`delta_${i}.json`, delta || {})
        // await sleep(10)
        const ydocRaw = getRawBySharedData('raw', ydoc)
        logFile(`ydocRaw_${i}.json`, JSON.parse(JSON.stringify(ydocRaw)))
        expect(
          ydocRaw
        ).toEqual(newRaw)
        preRaw = newRaw
      }
    }
    fs.remove('./temp', () => {
      resolve()
      start()
    })
  })
})
*/
function changeRaw (raw, text) {
  return {
    'blocks': [
      {
        ...raw.blocks[0],
        text: raw.blocks[0].text + text,
      }
    ],
    'entityMap': raw.entityMap,
  }
}
test('test diffrent user change yjs', () => {
  
  setRawToSharedData('raw', ydoc, raw);
  let preRawA = raw
  let preRawB = raw
  return new Promise(resolve => {
     const start = () => {
      for (let i = 0; i < 10; i++) {
        // logFile(`preRaw_${i}.json`, JSON.parse(JSON.stringify(preRaw)))
        const rawA = changeRaw(preRawA, 'a')
        const rawB = changeRaw(preRawB, 'b')
        // logFile(`newRaw_${i}.json`, JSON.parse(JSON.stringify(newRaw)))
        const deltaA = diffRaw(preRawA, rawA);
        const deltaB = diffRaw(preRawB, rawB);
        changeYmapByDelta(
          deltaA,
          rawYmap
        );
        changeYmapByDelta(
          deltaB,
          rawYmap
        );
        // logFile(`delta_${i}.json`, delta || {})
        // await sleep(10)
        const ydocRaw = getRawBySharedData('raw', ydoc)
        logFile(`ydocRaw_${i}.json`, JSON.parse(JSON.stringify(ydocRaw)))
        expect(
          ydocRaw
        ).toEqual(ydocRaw)
        preRawA = ydocRaw
        preRawB = ydocRaw
      }
    }
    fs.remove('./temp', () => {
      resolve()
      start()
    })
  })
})
