const log = require('./app/log')

const windowStateKeeper = require('electron-window-state');

const {
    app,
    BrowserWindow,
    ipcMain,
    protocol,
} = require('electron')

const debug = require('electron-debug');

debug({
    enabled: true,
    devToolsMode: 'right',
    showDevTools: false,
});

process.on('unhandledRejection', r => console.log(r));

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win
let addUserWin

function createWindow() {
    let mainWindowState = windowStateKeeper({
        defaultWidth: 1000,
        defaultHeight: 800
    })

    win = new BrowserWindow({
        'x': mainWindowState.x,
        'y': mainWindowState.y,
        'width': mainWindowState.width,
        'height': mainWindowState.height,
        title: 'QuiriQuiri',
        icon: `${__dirname}/resources/icons/64x64/quiriquiri.png`,
        webPreferences: {
            // TODO: fix?
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            nativeWindowOpen: true,
        }
    })

    mainWindowState.manage(win);

    win.loadURL(`file://${__dirname}/index.html`)
    // win.webContents.openDevTools()

    win.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        quiri.close()
        win = null
    })

    win.webContents.on('new-window', (event, url, frameName, disposition, options, additionalFeatures) => {
        if (frameName === 'addUser') {
            // open window as modal
            event.preventDefault()
            Object.assign(options, {
                modal: true,
                parent: win,
            })
            event.newGuest = addUserWin = new BrowserWindow(options)
        }
    })

    protocol.registerFileProtocol('quiriquiri', (request, callback) => {
        const url = require('url').parse(request.url, true)
        log.debug(JSON.stringify(url.query))
        log.debug(url.hostname)
        callback()
        if (url.hostname == 'authorize') {
            win.webContents.send('authorized', url.query)
        }
        addUserWin.close()
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

process.on('uncaughtException', function (error) {
    log.error(error, error.stack)
})
