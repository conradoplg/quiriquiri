"use strict"

var Twit = require('twit')
const EventEmitter = require('events');
var zpad = require('zpad');
const log = require('winston')
var assert = require('assert')


function numericalStringCompare(a, b) {
    var len = Math.max(a.length, b.length)
    return zpad(a, len).localeCompare(zpad(b, len))
}

class User extends EventEmitter {
    constructor(consumer_key, consumer_secret, token, secret) {
        super()
        this.twit = new Twit({
            consumer_key: consumer_key,
            consumer_secret: consumer_secret,
            access_token: token,
            access_token_secret: secret,
            timeout_ms: 5 * 1000,
        })
        this.config = {}
    }

    verify(callback) {
        this.twit.get('account/verify_credentials', {
                skip_status: true
            })
            .catch(callback)
            .then((result) => {
                this.name = result.data.name
                this.screen_name = result.data.screen_name
                this.profile_image_url = result.data.profile_image_url_https
                callback(null, this)
            })
    }

    loadConfig(config) {
        var all_users = config.users || {}
        this.config = all_users[this.screen_name] || {}
    }

    saveConfig(config) {
        config.users = config.users || {}
        config.users[this.screen_name] = this.config
    }

    start() {
        assert(!self._timeout)
        self._timeout = setInterval(this._loadNewTweets, 90 * 1000)
    }

    stop() {
        assert(self._timeout)
        clearInterval(self._timeout)
        self._timeout = null
    }

    _loadNewTweets() {
        since_id = this.config.since_id
        _loadTweets(since_id, null, null, (err, all_tweets) => {
            if (all_tweets.length > 0) {
                this.config.since_id = all_tweets[0].id_str
            }
        })
    }

    _loadTweets(since_id, max_id, all_tweets, callback) {
        if (!all_tweets) {
            all_tweets = []
        }
        var args = {
            count: 200,
            tweet_mode: 'extended'
        }
        if (since_id) {
            args.since_id = since_id
        }
        if (max_id) {
            args.max_id = max_id
        }
        log.debug('GET statues/home_timeline', args)
        this.twit.get('statuses/home_timeline', args)
            .catch((err) => {
                log.debug('caught error')
                if (callback) {
                    callback(err)
                }
                this.emit('load-error', err)
            })
            .then((result) => {
                var tweets = result.data
                if (result.resp.statusCode < 200 || result.resp.statusCode >= 300) {
                    this.emit('load-error', result.data)
                    return
                }
                log.debug('Tweets returned: ', tweets.length)
                if (all_tweets.length > 0 && tweets.length > 0 &&
                    all_tweets[all_tweets.length - 1].id_str == tweets[0].id_str) {
                    //remove first, which is a duplicate
                    log.debug('Removed duplicate tweet')
                    tweets = tweets.slice(1)
                }
                all_tweets = all_tweets.concat(tweets)
                if (tweets.length > 150) {
                    var new_max_id = tweets[tweets.length - 1].id_str
                    log.debug('new_max_id: ', new_max_id)
                    this._loadTweets(since_id, new_max_id, all_tweets)
                } else {
                    if (callback) {
                        callback(null, all_tweets)
                    }
                    this.emit('tweets-loaded', all_tweets)
                }
            })
    }
}

module.exports.User = User
