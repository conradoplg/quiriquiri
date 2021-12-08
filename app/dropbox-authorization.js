const assert = require('assert');
var Dropbox = require('dropbox').Dropbox
const log = require('./log')

var DropboxAuthorization = module.exports.DropboxAuthorization = function (oauthRedirectURL, clientId, refreshToken) {
    console.log(`DropboxAuthorization(${oauthRedirectURL}, ${clientId}, ${refreshToken})`)
    this.dbx = new Dropbox({
        clientId: clientId,
    })
    this.oauthRedirectURL = oauthRedirectURL
    if (refreshToken) {
        this.dbx.auth.setRefreshToken(refreshToken)
    }
}

DropboxAuthorization.prototype.getAuthenticationUrl = function (callback) {
    console.log(`DropboxAuthorization.getAuthenticationUrl() (${this.oauthRedirectURL})`)
    this.dbx.auth.getAuthenticationUrl(this.oauthRedirectURL, undefined, 'code', 'offline', undefined, undefined, true)
        .then((authUrl) => {
            this.codeVerifier = this.dbx.auth.codeVerifier
            console.log(`DropboxAuthorization.getAuthenticationUrl().callback(null, ${authUrl})`)
            callback(null, authUrl)
        })
        .catch((error) => {
            console.log(`DropboxAuthorization.getAuthenticationUrl().callback(${error})`)
            callback(error)
        })
}

DropboxAuthorization.prototype.authenticate = function (query, callback) {
    console.log(`DropboxAuthorization.authenticate(${query})`)
    this.dbx.auth.setCodeVerifier(this.codeVerifier)
    this.dbx.auth.getAccessTokenFromCode(this.oauthRedirectURL, query['code'])
        .then((token) => {
            this.dbx.auth.setRefreshToken(token.result.refresh_token);
            console.log(`DropboxAuthorization.authenticate().callback(null, ${token.result.refresh_token})`)
            callback(null, token.result.refresh_token)
        })
        .catch((error) => {
            console.log(`DropboxAuthorization.authenticate().callback(${error})`)
            callback(error)
        })
}
