// In renderer process (web page).
const {
    ipcRenderer
} = nodeRequire('electron')
const log = nodeRequire('winston')
log.level = 'debug'
    //console.log(ipcRenderer.sendSync('synchronous-message', 'ping')) // prints "pong"

var tr = nodeRequire('./app/tweet_renderer')

function getTimelineId(user, tl) {
    return 'timeline_' + user.data.screen_name + '_' + tl
}

ipcRenderer.on('tweet-arrived', (event, user, tl, tweets) => {
    for (let i = tweets.length - 1; i >= 0; i--) {
        let tweet = tweets[i]
        let tweetDiv = tr.createTweetDiv($, tweet)
        $('#' + getTimelineId(user, tl)).append(tweetDiv)
    }
})

ipcRenderer.on('user-added', (event, user) => {
    log.debug('ipcRenderer user-added called with', user)
    let username = user.data.screen_name

    let divs = {}
    for (let tl of ['home', 'mentions', 'dms']) {
        let div = $('<div></div>', {id: getTimelineId(user, tl), class: 'timeline'})
        $('#timeline').append(div)
        divs[tl] = div
    }
    $('#timeline').children().hide()
    divs.home.show()

    let links = {}
    let linkNames = {home: 'Home', mentions: 'Mentions', dms: 'Direct Messages'}
    for (let tl of ['home', 'mentions', 'dms']) {
        let link = $('<a></a>', {href: '#' + username + '/' + tl}).text(linkNames[tl])
        link.click(function (event) {
            event.preventDefault()
            $('#timeline').children().hide()
            divs[tl].show()
        })
        links[tl] = link
    }
    $('#user_list').append(
        $('<li></li>').text(username),
        $('<ul></ul>').append(
            $('<li></li>').append(links.home),
            $('<li></li>').append(links.mentions),
            $('<li></li>').append(links.dms)
        )
    )
})

$(document).ready(() => {
    $('#add_user').click(function(event) {
        event.preventDefault()
        ipcRenderer.send('add-user')
    })
    ipcRenderer.send('main-ready')
})
