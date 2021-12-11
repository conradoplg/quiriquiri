"use strict"

var Twit = require('twit')
const EventEmitter = require('events');
var zpad = require('zpad');
const log = require('./log')
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
        this.config = { since_id: {} }
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
                // log.debug('account/verify_credentials returned', [result.data, result.resp.statusCode])
                this.name = result.data.name
                this.screen_name = result.data.screen_name
                this.profile_image_url = result.data.profile_image_url_https
                this.data = result.data
                this.id_str = result.id_str
                callback(null, this)
            })
    }

    loadConfig(config) {
        assert(this.screen_name, 'User has not been verified yet')
        var all_users = config.users || {}
        this.config = all_users[this.screen_name] || {}
        this.config.since_id = this.config.since_id || {}
        this.since_id = Object.assign({}, this.config.since_id)
        log.debug(["Loaded config for user", this.screen_name, JSON.stringify(this.config.since_id)])
    }

    loadCloudConfig(userCloudConfig) {
        log.debug(['loadCloudConfig', this.screen_name, JSON.stringify(this.config), JSON.stringify(userCloudConfig)])
        for (let tl in (userCloudConfig.since_id || {})) {
            let original_id = this.config.since_id[tl] || "0"
            let cloud_id = userCloudConfig.since_id[tl] || "0"
            log.debug(["Updating since_id", this.screen_name, tl, original_id, cloud_id])
            // This should take into account that these are strings, but it shouldn't matter
            // until IDs have one additional digit...
            if (cloud_id > original_id) {
                this.config.since_id[tl] = cloud_id
            } else {
                this.config.since_id[tl] = original_id
            }
            log.debug(["New since_id: ", this.config.since_id[tl]])
        }
    }

    saveConfig(config) {
        assert(this.screen_name, 'User has not been verified yet')
        config.users = config.users || {}
        config.users[this.screen_name] = Object.assign({}, this.config)
    }

    start() {
        log.debug('user.start')
        assert(this.config)
        assert(!this._timeout)
        setTimeout(() => this._loadNewTweets(), 0)
        this._timeout = setInterval(() => this._loadNewTweets(), 90 * 1000)
        setTimeout(() => this.loadFriends(), 0)

        // this._stream = this.twit.stream('user', {follow: this.id_str})
        // this._stream.on('error', (err) => {
        //     log.debug('twit.stream on error', JSON.stringify([this.screen_name, err]))
        // })
        // this._stream.on('message', (tweet) => {
        //     //log.debug('message from stream: ', JSON.stringify([this.screen_name, tweet]))
        // })
        // this._stream.on('tweet', (tweet) => {
        //     //log.debug('tweet from stream: ', JSON.stringify([this.screen_name, tweet.text]))
        //     this.emit('tweets-loaded', this, 'home', [tweet])
        // })
        // this._stream.on('user_event', (eventMsg) => {
        //     log.debug('user_event: ', JSON.stringify([this.screen_name, eventMsg]))
        //     this.emit('user-event', this, eventMsg)
        // })
    }

    stop() {
        assert(this._timeout)
        clearInterval(this._timeout)
        this._timeout = null
        // this._stream.stop()
    }

    markAsRead(tl, id_str) {
        log.debug(['user.markAsRead called with', tl, id_str])
        this.config.since_id[tl] = id_str
        this.emit('config-changed', this)
    }

    postTweet(text, replyTo) {
        log.debug('user.postTweet called with', [text, replyTo])
        var args = {
            status: text,
            enable_dm_commands: false,
            weighted_character_count: true,
        }
        if (replyTo) {
            args.in_reply_to_status_id = replyTo
            args.auto_populate_reply_metadata = true
        }
        this.twit.post('statuses/update', args)
            .catch((err) => {
                log.debug('caught error postTweet', err)
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
        this.twit.post('statuses/retweet/:id', { id: id })
            .catch((err) => {
                log.debug('caught error retweet', err)
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
        this.twit.post('favorites/create', { id: id })
            .catch((err) => {
                log.debug('caught error like', err)
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
        for (let tl of ['home', 'mentions']) {
            this._loadTweets(tl, this.since_id[tl], null, null, (err, all_tweets) => {
                if (err) {
                    log.debug(err)
                }
                if (all_tweets) {
                    log.debug('_loadTweets callback called with tweet count', all_tweets.length)
                    if (all_tweets.length > 0) {
                        this.since_id[tl] = all_tweets[0].id_str
                        log.debug('Updated since_id', this.since_id[tl])
                    }
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
            // TODO: DMs changed format
            // dms: 'direct_messages/events/list'
        }
        assert(urls[tl], 'Invalid tl argument :' + tl)
        log.debug('GET ' + urls[tl], args)
        this.twit.get(urls[tl], args)
            .catch((err) => {
                log.debug('caught error ' + urls[tl])
                if (callback) {
                    callback(err)
                }
                this.emit('load-error', err)
            })
            .then((result) => {
                if (!result || !result.resp || result.resp.statusCode < 200 || result.resp.statusCode >= 300) {
                    this.emit('load-error', result)
                    return
                }
                var tweets = result.data
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
                if (!result.resp || result.resp.statusCode < 200 || result.resp.statusCode >= 300) {
                    this.emit('load-friend-error', result.data)
                    return
                }
                log.debug('Friends returned: ', JSON.stringify(friends))
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
