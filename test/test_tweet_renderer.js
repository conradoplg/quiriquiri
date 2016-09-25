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
            assert.strictEqual(div.html(), 'The @<a href="https://twitter.com/NASAJuno">NASAJuno</a> probe passed 3600 km above Jupiter at the perijove of its first complete Jovian orbit 1253 UTC Aug 27.  Next apojove is Sep 23')

            div = $("<div></div>")
            tweet = JSON.parse(fs.readFileSync('test/tweet_sample_02.json', 'utf8'));
            tr.createTextDiv($, div, tweet)
            assert.strictEqual(div.html().trim(), tweet.html)

            div = $("<div></div>")
            tweet = JSON.parse(fs.readFileSync('test/tweet_sample_03.json', 'utf8'));
            tr.createTextDiv($, div, tweet)
            assert.strictEqual(div.html().trim(), tweet.html)
        })
    })

});
