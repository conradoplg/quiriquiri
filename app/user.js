"use strict"

var Twit = require('twit')
const EventEmitter = require('events');
var zpad = require('zpad');
const log = require('winston')
var assert = require('assert')
var sinon = require('sinon')
var fs = require('fs')


function numericalStringCompare(a, b) {
    var len = Math.max(a.length, b.length)
    return zpad(a, len).localeCompare(zpad(b, len))
}

class User extends EventEmitter {
    constructor(consumer_key, consumer_secret, token, secret) {
        super()
        assert(consumer_key)
        assert(consumer_secret)
        assert(token)
        assert(secret)
        this.twit = new Twit({
            consumer_key: consumer_key,
            consumer_secret: consumer_secret,
            access_token: token,
            access_token_secret: secret,
            timeout_ms: 5 * 1000,
        })
        this.config = {}
        this.config = {since_id: {}}
        this.config.token = token
        this.config.secret = secret
        this.since_id = {}
    }

    verify(callback) {
        this.twit.get('account/verify_credentials', {
                skip_status: true
            })
            .catch(callback)
            .then((result) => {
                log.debug('account/verify_credentials returned', [result.data, result.resp.statusCode])
                this.name = result.data.name
                this.screen_name = result.data.screen_name
                this.profile_image_url = result.data.profile_image_url_https
                this.data = result.data
                callback(null, this)
            })
    }

    loadConfig(config) {
        assert(this.screen_name, 'User has not been verified yet')
        var all_users = config.users || {}
        this.config = all_users[this.screen_name] || {}
        this.config.since_id = this.config.since_id || {}
        this.since_id = Object.assign({}, this.config.since_id)
    }

    saveConfig(config) {
        assert(this.screen_name, 'User has not been verified yet')
        config.users = config.users || {}
        config.users[this.screen_name] = this.config
    }

    start() {
        log.debug('user.start')
        assert(this.config)
        assert(!this._timeout)
        setTimeout(() => this._loadNewTweets(), 0)
        this._timeout = setInterval(() => this._loadNewTweets(), 90 * 1000)
        setTimeout(() => this.loadFriends(), 0)
    }

    stop() {
        assert(this._timeout)
        clearInterval(this._timeout)
        this._timeout = null
        this._stream.stop()
    }

    markAsRead(tl, id_str) {
        log.debug('user.markAsRead called with', [tl, id_str])
        this.config.since_id[tl] = id_str
        this.emit('config-changed', this)
    }

    postTweet(text, replyTo) {
        log.debug('user.postTweet called with', [text, replyTo])
        var args = {
            status: text
        }
        if (replyTo) {
            args.in_reply_to_status_id = replyTo
        }
        this.twit.post('statuses/update', args)
        .catch((err) => {
            log.debug('caught error', err)
            this.emit('post-tweet-error', err)
        }).then((result) => {
            if (result.resp.statusCode < 200 || result.resp.statusCode >= 300) {
                this.emit('post-tweet-error', result.data)
                return
            }
            this.emit('tweet-posted', this, result.data)
        })
    }

    retweet(id) {
        this.twit.post('statuses/retweet/:id', {id: id})
        .catch((err) => {
            log.debug('caught error', err)
            this.emit('retweet-error', err, id)
        }).then((result) => {
            if (result.resp.statusCode < 200 || result.resp.statusCode >= 300) {
                this.emit('retweet-error', result.data)
                return
            }
            this.emit('retweeted', this, id)
        })
    }

    like(id) {
        this.twit.post('favorites/create', {id: id})
        .catch((err) => {
            log.debug('caught error', err)
            this.emit('like-error', err, id)
        }).then((result) => {
            if (result.resp.statusCode < 200 || result.resp.statusCode >= 300) {
                log.debug('like error', result.data)
                this.emit('like-error', result.data)
                return
            }
            this.emit('liked', this, id)
        })
    }

    loadFriends() {
        this._loadFriends(null, '-1')
    }

    _loadNewTweets() {
        assert(this.config)
        for (let tl of ['home', 'mentions', 'dms']) {
            this._loadTweets(tl, this.since_id[tl], null, null, (err, all_tweets) => {
                log.debug('_loadTweets callback called with tweet count', all_tweets.length)
                if (all_tweets.length > 0) {
                    this.since_id[tl] = all_tweets[0].id_str
                    log.debug('Updated since_id', this.since_id[tl])
                }
            })
        }
    }

    _loadTweets(tl, since_id, max_id, all_tweets, callback) {
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
        let urls = {
            home: 'statuses/home_timeline',
            mentions: 'statuses/mentions_timeline',
            dms: 'direct_messages'
        }
        assert(urls[tl], 'Invalid tl argument :' + tl)
        log.debug('GET ' + urls[tl], args)
        this.twit.get(urls[tl], args)
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
                    this._loadTweets(tl, since_id, new_max_id, all_tweets, callback)
                } else {
                    if (callback) {
                        callback(null, all_tweets)
                    }
                    this.emit('tweets-loaded', this, tl, all_tweets)
                }
            })
    }

    _loadFriends(all_friends, cursor, callback) {
        if (!all_friends) {
            all_friends = []
        }
        var args = {
            count: 200,
            cursor: cursor
        }
        log.debug('GET friends/list', args)
        this.twit.get('friends/list', args)
            .catch((err) => {
                log.debug('caught error')
                if (callback) {
                    callback(err)
                }
                this.emit('load-friend-error', err)
            })
            .then((result) => {
                var friends = result.data.users
                if (result.resp.statusCode < 200 || result.resp.statusCode >= 300) {
                    this.emit('load-friend-error', result.data)
                    return
                }
                log.debug('Friends returned: ', friends.length)
                all_friends = all_friends.concat(friends)
                if (result.data.next_cursor_str != '0') {
                    this._loadFriends(all_friends, result.data.next_cursor_str, callback)
                } else {
                    if (callback) {
                        callback(null, all_friends)
                    }
                    this.emit('friends-loaded', this, all_friends)
                }
            })
    }
}

module.exports.User = User
