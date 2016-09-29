// In renderer process (web page).
const {
    ipcRenderer,
    remote
} = nodeRequire('electron')
const {Menu, MenuItem} = remote
const log = nodeRequire('winston')
log.level = 'debug'
var shell = nodeRequire('electron').shell

var tr = nodeRequire('./app/tweet_renderer')

function getTimelineId(user, tl) {
    return 'timeline_' + user.data.screen_name + '_' + tl
}

function updateUnreadCount(user, tl) {
    let timelineDiv = $('#' + getTimelineId(user, tl))
    let username = user.data.screen_name
    let count = timelineDiv.children().length
    let counterStr = ' (' + count + ')'
    $('#counter_' + username + '_' + tl).text(count == 0 ? '' : counterStr)
}

ipcRenderer.on('tweet-arrived', (event, user, tl, tweets) => {
    let timelineDiv = $('#' + getTimelineId(user, tl))
    for (let i = tweets.length - 1; i >= 0; i--) {
        try {
            let tweet = tweets[i]
            let tweetDiv = tr.createTweetDiv($, tweet)
            timelineDiv.append(tweetDiv)
            tweetDiv.contextmenu(function (event) {
                event.preventDefault()
                const menu = new Menu()
                menu.append(new MenuItem({label: 'Mark this and previous and read', click() {
                    ipcRenderer.send('mark-as-read', user, tl, tweet.id_str)
                    timelineDiv.children().each(function (i, elem) {
                        elem.remove()
                        if (elem.id == 'tweet_' + tweet.id_str) {
                            return false
                        }
                    })
                    $('body').scrollTop(0)
                    updateUnreadCount(user, tl)
                }}))
                menu.popup(remote.getCurrentWindow())
            })
        } catch (err) {
            console.error(err.stack)
        }
    }
    updateUnreadCount(user, tl)
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
        let link = $('<a></a>', {href: '#' + username + '/' + tl}).append(
            linkNames[tl],
            $('<span></span>', {id: 'counter_' + username + '_' + tl})
        )
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
    //open links externally by default
    $(document).on('click', 'a[href^="http"]', function(event) {
        event.preventDefault();
        shell.openExternal(this.href);
    });
    ipcRenderer.send('main-ready')
})
