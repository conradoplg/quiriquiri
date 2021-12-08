"use strict"

var User = require('./user').User
var credentials = require('../secret')
const EventEmitter = require('events')
const log = require('./log')
var DropboxAuthorization = require('./dropbox-authorization').DropboxAuthorization


class QuiriQuiriApp extends EventEmitter {
    constructor() {
        super()
        this.users = {}
        this.dropboxRefreshToken = null
    }

    loadConfig(config) {
        var allUsers = config.users || {}
        for (var username in allUsers) {
            let userConfig = allUsers[username]
            try {
                this.addUser(userConfig.token, userConfig.secret, config)
            } catch (err) {
                log.error('Error loading user', [username, err.stack])
            }
        }
        this.dropboxRefreshToken = config.dropbox_refresh_token
    }

    saveConfig(config) {
        for (let username in this.users) {
            this.users[username].saveConfig(config)
        }
        config.dropbox_refresh_token = this.dropboxRefreshToken
    }

    addUser(token, secret, config) {
        let user = new User(credentials["consumer_key"], credentials["consumer_secret"], token, secret)
        user.verify((err, user) => {
            if (err) {
                console.log(err)
            } else {
                log.debug('user.verify returned', user.data)
                if (config) {
                    log.debug('Existing user added; loading config')
                    user.loadConfig(config)
                }
                this.users[user.data.screen_name] = user
                this.emit('user-added', user)
                if (!config) {
                    log.debug('New user added; sending config-changed')
                    this.emit('config-changed')
                }
            }
        })
        user.on('config-changed', (user) => {
            log.debug('user.on config-changed called for', user.data.screen_name)
            this.emit('config-changed')
        })
    }

    linkDropbox(refreshToken) {
        this.dropboxAuthorization = new DropboxAuthorization('quiriquiri://dropbox-authorize/', credentials['dropbox_client_id'], refreshToken)
        let dbx = this.dropboxAuthorization.dbx
        dbx.usersGetCurrentAccount()
            .then((response) => {
                console.log('response', response);
            })
            .catch((error) => {
                console.log(error);
            })
    }

    close() {
        for (let username in this.users) {
            this.users[username].stop()
        }
    }
}

module.exports.QuiriQuiriApp = QuiriQuiriApp
