"use strict"

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
        assert.deepStrictEqual(user.config, {})

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
            home_last_read: '1'
        })
    });
    it("saves config", function() {
        let user = new User('dummykey', 'dummykey', 'dummykey', 'dummykey')
        user.screen_name = 'dummy'
        let config = {}
        user.saveConfig(config)
        assert.deepStrictEqual(config, {
            users: {
                dummy: {}
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
                    home_last_read: '2'
                }
            }
        })
    })
    it('loads tweets', function(done) {
        this.timeout(1000)
        let user = new User('dummykey', 'dummykey', 'dummykey', 'dummykey')
        let stub = sinon.stub(user.twit, 'get')
        let data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
        let promise0 = new Promise(function (resolve, reject) {
            resolve({data: data.slice(0, 200), resp: {statusCode: 200}})
        })
        let promise1 = new Promise(function (resolve, reject) {
            resolve({data: data.slice(199, 300), resp: {statusCode: 200}})
        })
        stub.withArgs('statuses/home_timeline').onCall(0).returns(promise0)
        stub.withArgs('statuses/home_timeline').onCall(1).returns(promise1)
        user.on('tweets-loaded', (tweets) => {
            assert.strictEqual(tweets.length, 300)
            assert.strictEqual(user.config.since_id, data[0].id_str)
            done()
        })
        user._loadNewTweets()
    })
})
