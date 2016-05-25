import request from 'superagent'
import assert from 'utils/assert'

const appsTextUrl = 'https://raw.githubusercontent.com/wisnuc/appifi/master/hosted/apps.json'
const hubUrl = 'https://hub.docker.com/v2'
const repoUrl = (repoName) => hubUrl + '/repositories/' + repoName

let memo = {
  status: 'init', // 'refreshing', 'success', 'error'
  message: null,  // for error message
  apps: []        // for apps
}

function info(text) {
  console.log(`[appstore] ${text}`)
}

function requestAppsText() {

  return new Promise((resolve, reject) => {

    request.get(appsTextUrl)
      .set('Accept', 'text/plain')
      .end((err, res) => {
        err ? reject(err) : resolve(res.text)
      })
  })
}

/** tag is useless now **/
/*
function requestTag(url) {

  return new Promise((resolve, reject) => {
    
    request.get(url)
      .set('Accpt', 'application/json')
      .end((err, res) => {
        if (err) resolve(err)
        else if (!res.ok) resolve(new Error('Bad Response'))
        else resolve(res.body)
      })
  })
}
*/

/* this promise never reject */
async function requestRepo(repo) {

  let task =  new Promise((resolve) => { // never reject

    request.get(repoUrl(repo.name))
      .set('Accept', 'application/json')
      .end((err, res) => {
        if (err) resolve(err)
        // else if (!res.ok) resolve(new Error('Bad Response'))
        else resolve(res.body)
      })
  }) 

  let r = await task
  if (r instanceof Error) 
    return r

  return Object.assign({}, r, { alias: repo.alias, imageLink: repo.image })
}

/* request all repos and neglect error */
async function requestAllRepos() {

  info('requesting apps text')
  let appsText = await requestAppsText()

  info('parse apps text')
  let apps = JSON.parse(appsText)
  
  info('request all apps repo information')
  let responses = await Promise.all(apps.map(repo => requestRepo(repo)))
  return responses.filter(res => (!(res instanceof Error)))
}

function refresh(memo, callback) {

  if (typeof callback !== 'undefined' && typeof callback !== 'function')
    throw 'callback must be a function if provided'

  if (memo.status === 'refreshing') return callback(null, memo)

  memo.status = 'refreshing'
  memo.message = null
  memo.apps = []

  requestAllRepos()
    .then(r => {
      memo.status = 'success'
      memo.message = null
      memo.apps = r

      if (callback) callback(null, memo)
    })
    .catch(e => {
      info(`ERROR: ${e.message}`)
      memo.status = 'error'
      memo.message = e.message
      memo.apps = [] 

      if (callback) callback(null, memo)
    })
}

export default {

  init: () => {
    info('initialize')
    refresh(memo)
  },

  get: () => memo,

  refresh: (callback) => refresh(memo, callback) 
}

