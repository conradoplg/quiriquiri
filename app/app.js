"use strict"

var User = require('./user').User
var credentials = require('../secret')
const EventEmitter = require('events')
const log = require('winston')


class QuiriQuiriApp extends EventEmitter {
    constructor() {
        super()
        this.users = {}
    }

    loadConfig(config) {
        var allUsers = config.users || {}
        for (var username in allUsers) {
            let userConfig = allUsers[username]
            this.addUser(userConfig.token, userConfig.secret)
        }
    }

    saveConfig(config) {
        for (let user of this.users) {
            user.saveConfig(config)
        }
    }

    addUser(token, secret) {
        let user = new User(credentials["consumer_key"], credentials["consumer_secret"], token, secret)
        user.verify((err, user) => {
            if (err) {
                console.log(err)
            } else {
                log.debug('user.verify returned', user)
                this.users[user.data.scren_name] = user
                this.emit('user-added', user)
            }
        })
    }
}

module.exports.QuiriQuiriApp = QuiriQuiriApp
