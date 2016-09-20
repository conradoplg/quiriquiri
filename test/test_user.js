var assert = require('assert')
var User = require('../app/user').User

describe("User", function() {
    it("loads config", function() {
        user = new User('dummykey', 'dummykey', 'dummykey', 'dummykey')
        user.screen_name = 'dummy'
        config = {}
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
        user = new User('dummykey', 'dummykey', 'dummykey', 'dummykey')
        user.screen_name = 'dummy'
        config = {}
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
    });
});
