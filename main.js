// In renderer process (web page).
const {
    ipcRenderer
} = nodeRequire('electron')
const log = nodeRequire('winston')
log.level = 'debug'
    //console.log(ipcRenderer.sendSync('synchronous-message', 'ping')) // prints "pong"

var tr = nodeRequire('./app/tweet_renderer')

ipcRenderer.on('tweet-arrived', (event, arg) => {
    for (let i = arg.length - 1; i >= 0; i--) {
        let tweet = arg[i]
        let tweetDiv = tr.createTweetDiv($, tweet)
        $(".timeline").append(tweetDiv)
    }
})

ipcRenderer.on('user-added', (event, user) => {
    log.debug('ipcRenderer user-added called with', user)
    let username = user.data.screen_name

    let homeLink = $('<a></a>', {href: '#' + username + '/home'}).text('Home')
    let mentionLink = $('<a></a>', {href: '#' + username + '/mentions'}).text('Mentions')
    let dmLink = $('<a></a>', {href: '#' + username + '/dms'}).text('Direct Messages')
    $('#user_list').append(
        $('<li></li>').text(username),
        $('<ul></ul>').append(
            $('<li></li>').append(homeLink),
            $('<li></li>').append(mentionLink),
            $('<li></li>').append(dmLink)
        )
    )

    for (let typ of ['home', 'mentions', 'dms']) {
        let div = $('<div></div>', {id: 'timeline_' + username + '_' + typ, class: 'timeline'})
        $('#timeline').append(div)
    }
})

$(document).ready(() => {
    $('#add_user').click(function(event) {
        event.preventDefault()
        ipcRenderer.send('add-user')
    })
    ipcRenderer.send('main-ready')
})
