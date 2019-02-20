const assert = require('assert');
var OAuth = require('mashape-oauth').OAuth;

var TwitterAuthorization = module.exports.TwitterAuthorization = function(oauthCallback, consumerKey, consumerSecret) {
    this.oa = new OAuth({
        requestUrl: 'https://api.twitter.com/oauth/request_token',
        accessUrl: 'https://api.twitter.com/oauth/access_token',
        callback: oauthCallback,
        consumerKey: consumerKey,
        consumerSecret: consumerSecret,
        version: "1.0",
        signatureMethod: 'HMAC-SHA1',
    })
}

TwitterAuthorization.prototype.getRequestToken = function(callback) {
    this.oa.getOAuthRequestToken((error, oauthToken, oauthTokenSecret, results) => {
        if (error && callback) {
            callback(error)
        } else {
            this.oauthToken = oauthToken
            this.oauthTokenSecret = oauthTokenSecret
            callback(null, oauthToken, oauthTokenSecret)
        }
    })
}

TwitterAuthorization.prototype.getAccessToken = function(oauthParams, callback) {
    oauthToken = oauthParams['oauth_token']
    oauthVerifier = oauthParams['oauth_verifier']
    assert.equal(this.oauthToken, oauthToken, "Returned oauth_token is different then requested.")
    this.oa.getOAuthAccessToken({
        oauth_verifier: oauthVerifier,
        oauth_token: oauthToken,
        oauth_secret: this.oauthTokenSecret
    }, (error, token, secret, result) => {
        if (error && callback) {
            callback(error)
        } else {
            callback(null, token, secret)
        }
    })
}
