const log = require('./app/log')

var secret = require('./secret')
var QuiriQuiriApp = require('./app/app').QuiriQuiriApp
var TwitterAuthorization = require('./app/authorization').TwitterAuthorization
var quiri = new QuiriQuiriApp()

var fs = require('fs');

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
    win = new BrowserWindow({
        width: 1600,
        height: 800,
        title: 'QuiriQuiri',
        icon: `${__dirname}/resources/icons/64x64/quiriquiri.png`
    })

    win.loadURL(`file://${__dirname}/index.html`)
    win.webContents.openDevTools()

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
                    log.error(JSON.stringify(error))
                } else {
                    log.debug(`token ${token} secret ${secret}`)
                    quiri.addUser(token, secret)
                }
            })
        }
        addUserWin.close()
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

var twitterAuthorization = new TwitterAuthorization('quiriquiri://authorize/', secret['consumer_key'], secret['consumer_secret'])
var addUserWin = null

ipcMain.on('add-user', () => {
    twitterAuthorization.getRequestToken((error, token, secret) => {
        if (error) {
            console.log(JSON.stringify(error))
        } else {
            addUserWin = new BrowserWindow({
                parent: win
            })
            addUserWin.loadURL(`https://api.twitter.com/oauth/authorize?oauth_token=${token}`)
            addUserWin.show()
        }
    })
})

ipcMain.on('main-ready', () => {
    quiri.on('config-changed', () => {
        log.debug('quiri.on config-changed called')
        let config = {}
        log.debug('saving config...')
        quiri.saveConfig(config)
        log.debug('writing to file...')
        fs.writeFileSync('config.json', JSON.stringify(config, null, 4))
    })

    let config
    try {
        config = JSON.parse(fs.readFileSync('config.json', 'utf8'))
    } catch (err) {
        if (err.code === 'ENOENT') {
            log.info('Config file not found, loading empty config')
            config = {}
        } else {
            throw err;
        }
    }
    quiri.loadConfig(config)
})

ipcMain.on('mark-as-read', (event, user, tl, id_str) => {
    //XXX: 'user' does not work here, why?
    quiri.users[user.data.screen_name].markAsRead(tl, id_str)
})

quiri.on('user-added', (user) => {
    log.debug('quiri.on user-added called with', user)
    win.webContents.send('user-added', user)
    user.on('tweets-loaded', function(user, tl, tweets) {
        win.webContents.send('tweet-arrived', user, tl, tweets)
    })
    user.on('load-error', function(err) {
        console.log(err)
    })
    user.on('friends-loaded', function(user, friends) {
        win.webContents.send('friends-loaded', user, friends)
    })
    user.on('load-friend-error', function(err) {
        console.log(err)
    })
    user.on('tweet-posted', (user, tweet) => {
        win.webContents.send('tweet-posted', user, tweet)
    })
    user.on('post-tweet-error', (err) => {
        win.webContents.send('post-tweet-error', err)
    })
    user.on('liked', (user, tweetId) => {
        win.webContents.send('liked', user, tweetId)
    })
    user.on('like-error', (err, tweetId) => {
        win.webContents.send('like-error', err, tweetId)
    })
    user.on('retweeted', (user, tweetId) => {
        win.webContents.send('retweeted', user, tweetId)
    })
    user.on('retweet-error', (err, tweetId) => {
        win.webContents.send('retweet-error', err, tweetId)
    })
    user.on('user-event', (user, event) => {
        win.webContents.send('user-event', user, event)
    })
    user.start()
})

ipcMain.on('post-tweet', (event, text, author, replyTo) => {
    quiri.users[author].postTweet(text, replyTo)
})

ipcMain.on('retweet', (event, user, id) => {
    quiri.users[user.data.screen_name].retweet(id)
})

ipcMain.on('like', (event, user, id) => {
    quiri.users[user.data.screen_name].like(id)
})

process.on('uncaughtException', function (error) {
    log.error(error, error.stack)
})
