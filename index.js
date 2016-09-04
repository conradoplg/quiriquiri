var secret = require('./secret')
var TwitterAuthorization = require('./app/authorization').TwitterAuthorization

var Twit = require('twit')

var T = new Twit({
    consumer_key: secret["consumer_key"],
    consumer_secret: secret["consumer_secret"],
    access_token: secret["access_token"],
    access_token_secret: secret["access_token_secret"],
    timeout_ms: 60 * 1000, // optional HTTP request timeout to apply to all requests.
})


//T.get('followers/ids', { screen_name: 'conradoplg' },  function (err, data, response) {
//  console.log(data)
//})


//var stream = T.stream('user', { track: '#apple', language: 'en' })
//
//stream.on('tweet', function (tweet) {
//  console.log(tweet)
//})

//var tdata
//
//T.get('statuses/home_timeline', { count: 10 },  function (err, data, response) {
////  console.log(data)
//  console.log(JSON.stringify(data, null, 4));
//  tdata = data
//})
var fs = require('fs');
var data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
//console.log(JSON.stringify(data[0], null, 4));

const {
    app,
    BrowserWindow,
    ipcMain,
    protocol
} = require('electron')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win

function createWindow() {
    // Create the browser window.
    win = new BrowserWindow({
        width: 800,
        height: 600
    })

    // and load the index.html of the app.
    win.loadURL(`file://${__dirname}/index.html`)

    win.webContents.openDevTools()

    // Emitted when the window is closed.
    win.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        win = null
    })

    protocol.registerFileProtocol('quiriquiri', (request, callback) => {
        const url = require('url').parse(request.url, true)
        console.log(JSON.stringify(url.query))
        console.log(url.hostname)
        callback()
        if (url.hostname == 'authorize') {
            twitterAuthorization.getAccessToken(url.query, function(error, token, secret) {
                if (error) {
                    console.log(JSON.stringify(error))
                } else {
                    console.log(`token ${token} secret ${secret}`)
                }
            })
        }
        win.loadURL(`file://${__dirname}/index.html`)
    }, (error) => {
        if (error) console.error('Failed to register protocol')
    })
}

//protocol.registerStandardSchemes(['quiriquiri'])

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
        createWindow()
    }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

ipcMain.on('asynchronous-message', (event, arg) => {
    console.log(arg) // prints "ping"
    event.sender.send('asynchronous-reply', data)
})

ipcMain.on('synchronous-message', (event, arg) => {
    console.log(arg) // prints "ping"
    event.returnValue = 'pong'
})


var secret = require('./secret')
var OAuth = require('mashape-oauth').OAuth;
var oa = new OAuth({
    requestUrl: 'https://api.twitter.com/oauth/request_token',
    accessUrl: 'https://api.twitter.com/oauth/access_token',
    callback: 'quiriquiri://authorize',
    consumerKey: secret['consumer_key'],
    consumerSecret: secret['consumer_secret'],
    version: "1.0",
    signatureMethod: 'HMAC-SHA1',
});

var twitterAuthorization = new TwitterAuthorization('quiriquiri://authorize/', secret['consumer_key'], secret['consumer_secret'])

ipcMain.on('add-user', () => {
    twitterAuthorization.getRequestToken((error, token, secret) => {
        if (error) {
            console.log(JSON.stringify(error))
        } else {
            win.loadURL(`https://api.twitter.com/oauth/authenticate?oauth_token=${token}`)
        }
    })
})
