// In renderer process (web page).
const {
    ipcRenderer
} = nodeRequire('electron')
    //console.log(ipcRenderer.sendSync('synchronous-message', 'ping')) // prints "pong"

var tr = nodeRequire('./app/tweet_renderer')

ipcRenderer.on('asynchronous-reply', (event, arg) => {
    for (const tweet of arg) {
        var tweetDiv = tr.createTweetDiv($, tweet)
        $("#home_timeline").append(tweetDiv)
    }
})

$(document).ready(() => {
    ipcRenderer.send('asynchronous-message', 'ping')
    $('#add_user').click(function(event) {
        event.preventDefault()
        ipcRenderer.send('add-user')
    })
});
