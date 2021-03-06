"use strict"

const log = require('../app/log')

var assert = require('assert')
var sinon = require('sinon')
var fs = require('fs')
var User = require('../app/user').User

describe("User", function() {
    it("loads config", function() {
        let user = new User('dummykey', 'dummykey', 'dummykey', 'dummykey')
        user.screen_name = 'dummy'
        let config = {}
        user.loadConfig(config)
        assert.deepStrictEqual(user.config, {
            since_id: {}
        })

        user = new User('dummykey', 'dummykey', 'dummykey', 'dummykey')
        user.screen_name = 'dummy'
        config = {
            users: {
                dummy: {
                    'home_last_read': '1'
                }
            }
        }
        user.loadConfig(config)
        assert.deepStrictEqual(user.config, {
            home_last_read: '1',
            since_id: {}
        })
    });
    it("saves config", function() {
        let user = new User('dummykey', 'dummykey', 'dummykey', 'dummykey')
        user.screen_name = 'dummy'
        let config = {}
        user.saveConfig(config)
        assert.deepStrictEqual(config, {
            users: {
                dummy: {
                    since_id: {},
                    secret: 'dummykey',
                    token: 'dummykey'
                },
            }
        })

        user = new User('dummykey', 'dummykey', 'dummykey', 'dummykey')
        user.screen_name = 'dummy'
        user.config.home_last_read = '2'
        config = {
            users: {
                dummy: {
                    'home_last_read': '1'
                }
            }
        }
        user.saveConfig(config)
        assert.deepStrictEqual(config, {
            users: {
                dummy: {
                    home_last_read: '2',
                    since_id: {},
                    secret: 'dummykey',
                    token: 'dummykey'
                }
            }
        })
    })
    it('loads tweets', function(done) {
        this.timeout(1000)
        let user = new User('dummykey', 'dummykey', 'dummykey', 'dummykey')
        let stub = sinon.stub(user.twit, 'get')
        let data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
        stub.withArgs('statuses/home_timeline').onCall(0).returns(
            new Promise(function (resolve, reject) {
                resolve({data: data.slice(0, 1), resp: {statusCode: 200}})
        }))
        stub.withArgs('statuses/home_timeline').onCall(1).returns(
            new Promise(function (resolve, reject) {
                resolve({data: data.slice(0, 1), resp: {statusCode: 200}})
        }))
        stub.withArgs('statuses/mentions_timeline').onCall(0).returns(
            new Promise(function (resolve, reject) {
                resolve({data: data.slice(0, 1), resp: {statusCode: 200}})
        }))
        // stub.withArgs('direct_messages').onCall(0).returns(
        //     new Promise(function (resolve, reject) {
        //         resolve({data: data.slice(0, 1), resp: {statusCode: 200}})
        // }))
        var doneCount = 0
        user.on('tweets-loaded', (_user, tl, tweets) => {
            console.log(tl)
            if (tl == 'home') {
                assert.strictEqual(tweets.length, 1)
                assert.strictEqual(user.since_id[tl], data[0].id_str)
            }
            if (tl == 'mentions') {
                assert.strictEqual(tweets.length, 1)
            }
            if (tl == 'dms') {
                assert.strictEqual(tweets.length, 1)
            }
            doneCount++
            if (doneCount == 2) {
                done()
            }
        })
        user._loadNewTweets()
    })
    it('posts tweets', function(done) {
        this.timeout(1000)
        let user = new User('dummykey', 'dummykey', 'dummykey', 'dummykey')
        let data = JSON.parse(fs.readFileSync('data.json', 'utf8'))
        let stub = sinon.stub(user.twit, 'post')
        stub.withArgs('statuses/update').onCall(0).returns(
            new Promise(function (resolve, reject) {
                resolve({data: data[0], resp: {statusCode: 200}})
        }))
        user.on('tweet-posted', (user, tweet) => {
            done()
        })
        user.postTweet('test', null)
    })
    it('replies tweets', function(done) {
        this.timeout(1000)
        let user = new User('dummykey', 'dummykey', 'dummykey', 'dummykey')
        let data = JSON.parse(fs.readFileSync('data.json', 'utf8'))
        let stub = sinon.stub(user.twit, 'post')
        stub.withArgs('statuses/update').onCall(0).returns(
            new Promise(function (resolve, reject) {
                resolve({data: data[0], resp: {statusCode: 200}})
        }))
        user.on('tweet-posted', (user, tweet) => {
            done()
        })
        user.postTweet('test', '1')
    })
})
