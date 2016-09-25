const log = require('winston')
log.level = 'debug'

var secret = require('./secret')
var QuiriQuiriApp = require('./app/app').QuiriQuiriApp
var TwitterAuthorization = require('./app/authorization').TwitterAuthorization
var quiri = new QuiriQuiriApp()

var fs = require('fs');
var data = JSON.parse(fs.readFileSync('data.json', 'utf8'));

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
        width: 1600,
        height: 800
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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

var secret = require('./secret')
var twitterAuthorization = new TwitterAuthorization('quiriquiri://authorize/', secret['consumer_key'], secret['consumer_secret'])
var addUserWin = null

ipcMain.on('add-user', () => {
    twitterAuthorization.getRequestToken((error, token, secret) => {
        if (error) {
            console.log(JSON.stringify(error))
        } else {
            addUserWin = new BrowserWindow({parent: win})
            addUserWin.loadURL(`https://api.twitter.com/oauth/authorize?oauth_token=${token}`)
            addUserWin.show()
        }
    })
})

ipcMain.on('main-ready', () => {
    quiri.loadConfig({users: {conradoplg: {token: 'token', secret: 'secret'}}})
})

quiri.on('user-added', (user) => {
    log.debug('quiri.on user-added called with', user)
    win.webContents.send('user-added', user)
    user.on('load-error', function(err) {
        console.log(err)
    })
    user.on('tweets-loaded', function(tweets) {
        win.webContents.send('tweet-arrived', tweets)
    })
    user.start()
})