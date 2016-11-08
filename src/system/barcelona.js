import fs from 'fs'
import child from 'child_process'

import { storeState, storeDispatch } from '../reducers'

const BOARD_EVENT = '/proc/BOARD_event'
const FAN_IO = '/proc/FAN_io'

const fsStatAsync = Promise.promisify(fs.stat)
const fsReadFileAsync = Promise.promisify(fs.readFile)
const childExecAsync = Promise.promisify(child.exec)

const updateFanSpeed = () => 
  fsReadFileAsync(FAN_IO)
    .then(data => {
      let fanSpeed = parseInt(data.toString().trim())
      storeDispatch({
        type: 'BARCELONA_FANSPEED_UPDATE',
        data: fanSpeed
      })
    })
    .catch(e => {}) // suppress nodejs red warning

var powerButtonCounter = 0

const pollingPowerButton = () => 
  setInterval(() => 
    fsReadFileAsync(BOARD_EVENT)
      .then(data => {
        if (data.toString().trim() === 'PWR ON') {
          powerButtonCounter++
          if (powerButtonCounter > 4) child.exec('poweroff', () => {})
        }
        else
          powerButtonCounter = 0
      })
      .catch(e => {}) // suppress nodejs red warning
  , 1000)

const setFanScale = (SCALE) => 
  (async (scale) => {

    if (!(typeof scale === 'number'))
      throw new Error(`scale ${scale} is not a number`)

    let fanScale = Math.floor(scale)

    if (fanScale < 0 || fanScale > 100)
      throw new Error(`fanScale ${fanScale} out of range`)

    await childExecAsync(`echo ${fanScale} > ${FAN_IO}`)

    storeDispatch({
      type: 'CONFIG_BARCELONA_FANSCALE',
      data: fanScale
    })
  })(SCALE).then(() => {}).catch(e => {}) // dirty TODO

// workaround FIXME
child.exec('echo "PWR_LED 1" > /proc/BOARD_io', err => {})

const barcelonaInit = () => {

  console.log('[system] barcelona init')
  
  pollingPowerButton() 
  setFanScale(storeState().config.barcelonaFanScale)
} 

export { updateFanSpeed, pollingPowerButton, setFanScale, barcelonaInit }

