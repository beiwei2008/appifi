/**
 * Created by jianjin.wu on 2017/3/22.
 * the entrance of routes
 */
// const router = require('express').Router()

// const login = require('./login')
// const files = require('./files').default
import { Router } from 'express'
import login from './login'
import files from './files'
import filemap from './filemap'
const ipctest = require('./ipctest')
const auth = require('../middleware/auth')

let router = Router()

router.use('/login', login)
//fixme auth
// app.use('/*', auth.jwt())
router.use('/files', files)
router.use('/filemap', filemap)
router.use('/ipctest', ipctest)

module.exports =  router