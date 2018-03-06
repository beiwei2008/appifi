const Router = require('express').Router
const debug = require('debug')('webtorrent')
const { createIpcMain, getIpcMain, destroyIpcMain } = require('./ipcMain')
const fs = require('fs')
const path = require('path')
const formidable = require('formidable')
const mkdirp = require('mkdirp')
const broadcast = require('../common/broadcast')
const getFruit = require('../fruitmix')
const auth = require('../middleware/auth')
/**
const out = fs.openSync('./out.log', 'a');
const err = fs.openSync('./out.log', 'a');
let opts = { stdio: ['ignore', out, err] }
**/

var torrentTmpPath
broadcast.on('FruitmixStarted', () => {
  // 尝试创建种子目录
  torrentTmpPath = path.join(getFruit().fruitmixPath, 'torrentTmp')
  mkdirp.sync(torrentTmpPath)
})

let router = Router()

// 下载开关
router.get('/switch', (req, res) => {
  if (getIpcMain()) res.status(200).json({switch: true})
  else res.status(200).json({switch: false})
})

// 获取版本信息
router.get('/version', (req, res) => {
  res.status(200).json({version: false})
})

// 打开/关闭 开关
router.patch('/switch', (req, res) => {
  let { op } = req.body
  if (!['start', 'close'].includes(op)) res.status(400).end('unknown op')
  if (op === 'close') destroyIpcMain()
  else createIpcMain()
  res.status(200).end()
})

// 检查开关中间件
router.use(function(req, res, next) {
  if (!getIpcMain()) return res.status(400).end('webTorrent is closed')
  else next()
})

// query type(optional) : enum [ finished, running ]
// 根据条件获取传输任务列表
router.get('/', auth.jwt(), (req, res) => {
  let { torrentId, type } = req.query
  let user = req.user
  getIpcMain().call('getSummary', { torrentId, type, user }, (error, data) => {
    if (error) res.status(400).json(error)
    else res.status(200).json(data)
  })
})

// 同上， 为IOS提供
router.get('/ppg3', auth.jwt(), (req, res) => {
  let { ppgId, type } = req.query
  let user = req.user
  getIpcMain().call('getSummary', { torrentId: ppgId, type, user }, (error, data) => {
    if (error) res.status(400).json(error)
    else {
      data.ppgPath = data.torrentPath
      data.ppgURL = data.magnetURL
      data.torrentPath = undefined
      data.magnetURL = undefined
      res.status(200).json(data)
    }
  })
})

// 创建HTTP下载任务
router.post('/http', auth.jwt(), (req, res) => {
  getIpcMain().call('addHttp', { url: req.body.url, dirUUID: req.body.dirUUID, user: req.user }, (error, data) => {
    if(error) return res.status(400).json(error)
    res.status(200).json(data)
  })
})

// 创建magnet下载任务
router.post('/magnet', auth.jwt(), (req, res) => {
  getIpcMain().call('addMagnet', { magnetURL: req.body.magnetURL, dirUUID: req.body.dirUUID, user: req.user }, (error, data) => {
    if(error) return res.status(400).json(error)
    res.status(200).json(data)
  })
})

//同上，为IOS提供
router.post('/ppg1', auth.jwt(), (req, res) => {
  getIpcMain().call('addMagnet', { magnetURL: req.body.ppgURL, dirUUID: req.body.dirUUID, user: req.user }, (error, data) => {
    if(error) return res.status(400).json(error)
    res.status(200).json(data)
  })
})

// 创建种子下载任务
router.post('/torrent', auth.jwt(), (req, res) => {
  // 保存上传种子
  let form = new formidable.IncomingForm()
  form.uploadDir = torrentTmpPath
  form.keepExtensions = true
  form.parse(req, (err, fields, files) => {
    if (err) return res.status(500).json(err)
    let dirUUID = fields.dirUUID
    let torrentPath = files.torrent.path
    let user = req.user
    if (!dirUUID || !torrentPath) return res.status(400).end('parameter error')
    getIpcMain().call('addTorrent', {torrentPath, dirUUID, user}, (err, torrentId) => {
      if (err) return res.status(400).json(err)
      return res.status(200).json({torrentId})
    })
  })
})

// 同上，为IOS提供
router.post('/ppg2', auth.jwt(), (req, res) => {
  let form = new formidable.IncomingForm()
  form.uploadDir = torrentTmpPath
  form.keepExtensions = true
  form.parse(req, (err, fields, files) => {
    if (err) return res.status(500).json(err)
    let dirUUID = fields.dirUUID
    let torrentPath = files.ppg.path
    let user = req.user
    if (!dirUUID || !torrentPath) return res.status(400).end('parameter error')
    getIpcMain().call('addTorrent', {torrentPath, dirUUID, user}, (err, torrentId) => {
      if (err) return res.status(400).json(err)
      return res.status(200).json({torrentId})
    })
  })
})

// 暂停、继续、删除 传输任务
router.patch('/:torrentId', auth.jwt(), (req, res) => {
  let ops = ['pause', 'resume', 'destroy']
  let op = req.body.op
  if(!ops.includes(op)) return res.status(400).json({ message: 'unknown op' })
  getIpcMain().call(op, { torrentId: req.params.torrentId, user: req.user }, (error, data) => {
    if(error) return res.status(400).json(error)
    return res.status(200).json(data)
  })
})

module.exports = router
