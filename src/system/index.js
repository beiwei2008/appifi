import child from 'child_process'
import os from 'os'

import express from 'express'
import Debug from 'debug'
const debug = Debug('system:router')

import validator from 'validator'

import { storeState } from '../appifi/lib/reducers'
import sysconfig from './sysconfig'
import mir from './mir'
import { mac2dev, aliases, addAliasAsync, deleteAliasAsync } from './ipaliasing'
import eth from './eth'

const codeMap = new Map([
  ['EINVAL', 400],
  ['ENOENT', 404]
]) 

const router = express.Router()

const K = x => y => x
const respond = (res, err, obj) => err ? 
    res.status(codeMap.get(err.code) || 500)
      .json({ code: err.code, message: err.message }) :
    res.status(200)
      .json((obj === null || obj === undefined) ? { message: 'success' } : obj)

const timedate = (callback) => 
  child.exec('timedatectl', (err, stdout, stderr) => 
    err ? callback(err) : callback(null, stdout.toString().split('\n').filter(l => l.length)
      .reduce((prev, curr) => {
        let pair = curr.split(': ').map(str => str.trim())
        prev[pair[0]] = pair[1]
        return prev
      }, {})))


// timedate
router.get('/timedate', (req, res) => timedate((err, obj) => 
  err ? K(res.status(500).end())(console.log(err)) : res.status(200).json(obj)))

// network
router.get('/net', (req, res) => eth().asCallback((err, obj) => 
  err ? K(res.status(500).end())(console.log(err)) : res.status(200).json(obj))) 

// aliasing
router.get('/ipaliasing', (req, res) => res.status(200).json(aliases()))

router.post('/ipaliasing', (req, res) => (async () => {

  let { mac, ipv4 } = req.body
  if (typeof mac !== 'string' || !validator.isMACAddress(mac))
    throw Object.assign(new Error('invalid mac'), { code: 'EINVAL' })
  if (typeof ipv4 !== 'string' || !validator.isIP(ipv4, 4))
    throw Object.assign(new Error('invalid ipv4'), { code: 'EINVAL' })

  let existing = aliases().find(alias => alias.mac === mac) 
  if (existing) 
    await deleteAliasAsync(existing.dev, existing.ipv4)
  
  let dev = mac2dev(mac)
  if (!dev) 
    throw Object.assign(new Error('no interface found with given mac'), { code: 'ENOENT' })

  await addAliasAsync(dev, ipv4)
  return aliases().find(alias => alias.mac === mac)

})().asCallback((err, obj) => respond(res, err, obj)))

router.delete('/ipaliasing', (req, res) => (async () => {
    
  let { mac, ipv4 } = req.body

  if (typeof mac !== 'string' || !validator.isMACAddress(mac))
    throw Object.assign(new Error('invalid mac'), { code: 'EINVAL' })
  if (typeof ipv4 !== 'string' || !validator.isIP(ipv4, 4))
    throw Object.assign(new Error('invalid ipv4'), { code: 'EINVAL' })

  let existing = aliases().find(alias => alias.mac === mac)
  console.log(existing)
  if (existing) 
    await deleteAliasAsync(existing.dev, existing.ipv4)

})().asCallback((err, obj) => respond(res, err, obj)))

// fan
router.get('/fan', (req, res) => {})

router.post('/fan', (req, res) => {

  let { scale } = req.body

  
})

router.use('/storage', mir)
router.use('/mir', mir)

router.get('/boot', (req, res) => {

  let sysboot = storeState().sysboot
 
  debug(sysboot) 

  if (sysboot)
    res.status(200).json(sysboot)
  else 
    res.status(500).end() // TODO
})

const shutdown = (cmd) =>
  setTimeout(() => {
    child.exec('echo "PWRD_LED 3" > /proc/BOARD_io', err => {})
    child.exec(`${cmd}`, err => {})
  }, 1000)

router.post('/boot', (req, res) => {

  let obj = req.body
  if (obj instanceof Object === false)
    return R(res)(400, 'invalid arguments')
  if (['poweroff', 'reboot', 'rebootMaintenance'].indexOf(obj.op) === -1)
    return R(res)(400, 'op must be poweroff, reboot, or rebootMaintenance')

  if (obj.op === 'poweroff') {
    console.log('[system] powering off')
    shutdown('poweroff')
  }
  else if (obj.op === 'reboot') {
    console.log('[system] rebooting')
    shutdown('reboot')
  }
  else if (obj.op === 'rebootMaintenance') {
    console.log('[system] rebooting into maintenance mode')
    sysconfig.set('bootMode', 'maintenance')
    shutdown('reboot')
  }

  res.status(200).json({
    message: 'ok'
  })
})

export default router
