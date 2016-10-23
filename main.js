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


var usernameMap = {}
var arrivedTweetsMap = {}

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
            if (tl == 'home' && arrivedTweetsMap[user.data.screen_name].has(tweet.id_str)) {
                log.debug('Tweet already shown')
                continue
            }
            let tweetDiv = tr.createTweetDiv($, tweet)
            timelineDiv.append(tweetDiv)
            if (tl == 'home') {
                arrivedTweetsMap[user.data.screen_name].add(tweet.id_str)
            }
            tweetDiv.contextmenu(function(event) {
                event.preventDefault()
                let menu = event.originalEvent._menu = event.originalEvent._menu || new Menu()
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
            usernameMap[(tweet.user || tweet.sender).screen_name] = {
                value: tweet.user.screen_name, label: tweet.user.name, img: tweet.user.profile_image_url_https
            }
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
    arrivedTweetsMap[username] = new Set()
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

ipcRenderer.on('user-event', (event, user, eventMsg) => {
    let username = user.data.screen_name
    if (eventMsg.target.screen_name != username) {
        return
    }
    let timelineDiv = $('#' + getTimelineId(user, 'mentions'))
    let eventDiv = tr.createEventDiv($, eventMsg)
    if (eventDiv) {
        timelineDiv.append(eventDiv)
    }
})

ipcRenderer.on('friends-loaded', (event, user, friends) => {
    for (let f of friends) {
        usernameMap[f.screen_name] = {
            value: f.screen_name, label: f.name, img: f.profile_image_url_https
        }
    }
})

$(document).ready(() => {
    $('#add_user').click(function(event) {
        event.preventDefault()
        ipcRenderer.send('add-user')
    })
    //open links externally by default
    $(document).on('click', 'a[href^="http"]', function(event) {
        event.preventDefault();
        event.stopPropagation();
        shell.openExternal(this.href)
    })
    $(document).on('click', '*[data-href^="http"]', function(event) {
        event.preventDefault();
        event.stopPropagation();
        shell.openExternal(this.getAttribute('data-href'))
    })
    $(document).on('contextmenu', 'a[href^="http"]', function(event) {
        event.preventDefault();
        let menu = event.originalEvent._menu = event.originalEvent._menu || new Menu()
        menu.append(new MenuItem({
            label: 'Copy link',
            click: () => {
                clipboard.writeText(this.href)
            }
        }))
    })
    $(document).on('contextmenu', function(event) {
        event.preventDefault();
        let menu = event.originalEvent._menu = event.originalEvent._menu || new Menu()
        menu.popup(remote.getCurrentWindow())
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
    $("#tweet-dialog-text")
    .on( "keydown", function( event ) {
        // don't navigate away from the field on tab when selecting an item
        if (event.keyCode === $.ui.keyCode.TAB && $(this).autocomplete("instance").menu.active) {
            event.preventDefault();
        }
    }).autocomplete({
        minLength: 0,
        autoFocus: true,
        delay: 0,
        position: { my : "right top", at: "right bottom" },
        source: function(request, response) {
            var txt = request.term.substring(0, $("#tweet-dialog-text")[0].selectionStart)
            var matches = /@[\S]+$/.exec(txt)
            if (matches) {
                arr = []
                var search = matches[0].substring(1)
                for (let u in usernameMap) {
                    if (usernameMap[u].value.indexOf(search) != -1
                       || usernameMap[u].value.toLowerCase().indexOf(search) != -1
                       || usernameMap[u].label.indexOf(search) != -1
                       || usernameMap[u].label.toLowerCase().indexOf(search) != -1) {
                        arr.push(usernameMap[u])
                    }
                }
                response(arr)
            } else {
                response([])
            }
        },
        focus: function() {
            // prevent value inserted on focus
            return false
        },
        select: function(event, ui) {
            var before = this.value.substring(0, $("#tweet-dialog-text")[0].selectionStart)
            var after = this.value.substring($("#tweet-dialog-text")[0].selectionStart)
            var newBefore = before.replace(/@[\S]+$/, '@' + ui.item.value)
            this.value = newBefore + ' ' + after
            this.setSelectionRange(newBefore.length + 1, newBefore.length + 1);
            $(this).autocomplete('close')
            return false;
        }
    }).autocomplete('instance')._renderItem = function(ul, item) {
        return $('<li>', {class: 'user-item'}).append(
            $('<img>', {src: usernameMap[item.value].img}),
            $("<span></span>", {
                class: 'name'
            }).text(item.label),
            ' ',
            $("<span></span>", {
                class: 'username'
            }).text("@" + item.value)
        ).appendTo(ul)
    }
    ipcRenderer.send('main-ready')
})
