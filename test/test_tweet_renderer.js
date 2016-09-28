var assert = require('assert')
var tr = require('../app/tweet_renderer')
var fs = require('fs')
const log = require('winston')
log.level = 'debug'

require("jsdom").env("", function(err, window) {
    if (err) {
        console.error(err)
        return
    }
    var $ = require("jquery")(window)

    describe("Tweet Renderer", function() {
        it("renders the tweet text", function() {
            var div
            var tweet

            div = $("<div></div>")
            tweet = JSON.parse(fs.readFileSync('test/tweet_sample_01.json', 'utf8'));
            tr.createTextDiv($, div, tweet)
            assert.strictEqual(div.html(), tweet.html)

            div = $("<div></div>")
            tweet = JSON.parse(fs.readFileSync('test/tweet_sample_02.json', 'utf8'));
            tr.createTextDiv($, div, tweet)
            assert.strictEqual(div.html().trim(), tweet.html)

            div = $("<div></div>")
            tweet = JSON.parse(fs.readFileSync('test/tweet_sample_03.json', 'utf8'));
            tr.createTextDiv($, div, tweet)
            assert.strictEqual(div.html().trim(), tweet.html)

            div = $("<div></div>")
            tweet = JSON.parse(fs.readFileSync('test/tweet_sample_04.json', 'utf8'));
            tr.createTextDiv($, div, tweet)
            assert.strictEqual(div.html().trim(), tweet.html)
        })
    })

});
