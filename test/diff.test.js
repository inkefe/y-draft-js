const { diff } = require('jest-diff');
const fs = require('fs-extra')
// let raw = require('./constants/raw');
let raw = require('./constants/tempRaw');
// const { raw2rbw, rbw2raw } = require('../../lib/index.cjs.js');
const { raw2rbw, rbw2raw, diffRaw, patchRaw } = require('../src/diff');
const { getRandomRaw, randomChangeRaw, logFile } = require('./utils');

test('check raw2rbw & rbw2raw', () => {
  // return new Promise(resolve => {
  //   fs.remove('./temp', () => {
  //     for (let i = 0; i < 1000; i++) {
  //       raw = getRandomRaw()
  //       logFile(`raw_${i}.json`, raw)
  //       const rbw = raw2rbw(raw)
  //       logFile(`rbw_${i}.json`, rbw)
  //       const newRaw = rbw2raw(rbw)
  //       logFile(`newRaw_${i}.json`, newRaw)
  //       expect(
  //         newRaw
  //       ).toEqual(raw)
  //     }
  //     resolve()
  //   })
  // })
});
/*
// jest.setTimeout(20000)
test('check diffRaw', () => {
  return new Promise(resolve => {
    let preRaw = getRandomRaw()
    fs.remove('./temp', () => {
      for (let i = 0; i < 1000; i++) {
        const newRaw = randomChangeRaw(preRaw)
        logFile(`preRaw_${i}.json`, preRaw)
        // logFile(`preRbw_${i}.json`, raw2rbw(preRaw))
        const delta = diffRaw(preRaw, newRaw)
        logFile(`delta_${i}.json`, delta)
        const patchedRaw = patchRaw(preRaw, delta)
        // logFile(`newRbw_${i}.json`, raw2rbw(newRaw))
        logFile(`newRaw_${i}.json`, newRaw)
        logFile(`patchRaw_${i}.json`, patchedRaw)
        // logFile(`patchRbw_${i}.json`, raw2rbw(patchedRaw))
        expect(
          patchedRaw
        ).toEqual(newRaw)
        preRaw = newRaw
      }
      resolve()
    })
  })
});
*/
