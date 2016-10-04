// In renderer process (web page).
const {
    ipcRenderer,
    remote,
    clipboard
} = nodeRequire('electron')
const {
    Menu,
    MenuItem
} = remote
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

function showTweetDialog(initialText, author, replyTo) {
    $('#modal').show()
    $('#tweet-dialog-post').prop('disabled', false)
    $('#tweet-dialog-text').prop('disabled', false)
    $('#tweet-dialog-text').val(initialText)
    $('#tweet-dialog-text').focus()
    $('#tweet-dialog-author').val(author)
    $('#tweet-dialog-reply-to').val(replyTo)
}

ipcRenderer.on('tweet-arrived', (event, user, tl, tweets) => {
    let timelineDiv = $('#' + getTimelineId(user, tl))
    for (let i = tweets.length - 1; i >= 0; i--) {
        try {
            let tweet = tweets[i]
            let tweetDiv = tr.createTweetDiv($, tweet)
            timelineDiv.append(tweetDiv)
            tweetDiv.contextmenu(function(event) {
                event.preventDefault()
                const menu = new Menu()
                menu.append(new MenuItem({
                    label: 'Mark this and previous and read',
                    click() {
                        ipcRenderer.send('mark-as-read', user, tl, tweet.id_str)
                        timelineDiv.children().each(function(i, elem) {
                            elem.remove()
                            if (elem.id == 'tweet_' + tweet.id_str) {
                                return false
                            }
                        })
                        $('body').scrollTop(0)
                        updateUnreadCount(user, tl)
                    }
                }))
                menu.append(new MenuItem({
                    label: 'Copy JSON',
                    click() {
                        clipboard.writeText(JSON.stringify(tweet, null, 4))
                    }
                }))
                menu.popup(remote.getCurrentWindow())
            })
            $('#reply-action-' + tweet.id_str).click(function(event) {
                event.preventDefault()
                var mentions = tr.getMentions(user.data, tweet).map((username) => '@' + username).join(' ') + ' '
                showTweetDialog(mentions, user.data.screen_name, tweet.id_str)
            })
            $('#retweet-action-' + tweet.id_str).click(function(event) {
                event.preventDefault()
                ipcRenderer.send('retweet', user, tweet.id_str)
            })
            $('#like-action-' + tweet.id_str).click(function(event) {
                event.preventDefault()
                ipcRenderer.send('like', user, tweet.id_str)
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
    for (let tl of['home', 'mentions', 'dms']) {
        let div = $('<div></div>', {
            id: getTimelineId(user, tl),
            class: 'timeline'
        })
        $('#timeline').append(div)
        divs[tl] = div
    }
    $('#timeline').children().hide()
    divs.home.show()

    let links = {}
    let linkNames = {
        home: 'Home',
        mentions: 'Mentions',
        dms: 'Direct Messages'
    }
    for (let tl of ['home', 'mentions', 'dms']) {
        let link = $('<a></a>', {
            href: '#' + username + '/' + tl
        }).append(
            linkNames[tl],
            $('<span></span>', {
                id: 'counter_' + username + '_' + tl
            })
        )
        link.click(function(event) {
            event.preventDefault()
            $('#timeline').children().hide()
            divs[tl].show()
        })
        links[tl] = link
    }
    let postLink = $('<a></a>', {
        href: '#' + username + '/post'
    }).text('Post')
    postLink.click(function(event) {
        event.preventDefault()
        showTweetDialog('', username, '')
    })
    $('#user_list').append(
        $('<li></li>').text(username),
        $('<ul></ul>').append(
            $('<li></li>').append(postLink),
            $('<li></li>').append(links.home),
            $('<li></li>').append(links.mentions),
            $('<li></li>').append(links.dms)
        )
    )
})

function defaultErrorHandler(event, err) {
    $('#modal').hide()
    $("#error-text").empty().append(document.createTextNode(JSON.stringify(err)))
    $("#error").show().delay(5000).fadeOut()
}

ipcRenderer.on('tweet-posted', (event, user, tweet) => {
    $('#modal').hide()
})

ipcRenderer.on('post-tweet-error', defaultErrorHandler)

ipcRenderer.on('liked', (event, user, tweetId) => {
    $('#like-action-' + tweetId).toggleClass('liked')
})

ipcRenderer.on('like-error', defaultErrorHandler)

ipcRenderer.on('retweeted', (event, user, tweetId) => {
    $('#retweet-action-' + tweetId).toggleClass('retweeted')
})

ipcRenderer.on('retweet-error', defaultErrorHandler)

$(document).ready(() => {
    $('#add_user').click(function(event) {
        event.preventDefault()
        ipcRenderer.send('add-user')
    })
    //open links externally by default
    $(document).on('click', 'a[href^="http"]', function(event) {
        event.preventDefault()
        shell.openExternal(this.href)
    })
    $(window).on('click', function(event) {
        event.preventDefault()
        if (event.target == document.getElementById('modal')) {
            $('#modal').hide()
        }
    })
    $('#tweet-dialog-post').on('click', function(event) {
        event.preventDefault()
        $('#tweet-dialog-post').prop('disabled', true)
        $('#tweet-dialog-text').prop('disabled', true)
        setTimeout(() => {
            ipcRenderer.send('post-tweet', $('#tweet-dialog-text').val(), $('#tweet-dialog-author').val(), $('#tweet-dialog-reply-to').val())
        }, 2000)
    })
    ipcRenderer.send('main-ready')
})
