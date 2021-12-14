// In renderer process (web page).
const {
    ipcRenderer,
    clipboard
} = nodeRequire('electron')
const remote = nodeRequire('@electron/remote')
const {
    Menu,
    MenuItem,
    BrowserWindow
} = remote
var fs = nodeRequire('fs');

var secret = nodeRequire('./secret')
var QuiriQuiriApp = nodeRequire('./app/app').QuiriQuiriApp
var TwitterAuthorization = nodeRequire('./app/authorization').TwitterAuthorization
var DropboxAuthorization = nodeRequire('./app/dropbox-authorization').DropboxAuthorization
var quiri = new QuiriQuiriApp()

var shell = nodeRequire('electron').shell
var twitterText = nodeRequire('twitter-text')

const log = nodeRequire('./app/log')
var tweetRenderer = nodeRequire('./app/tweet_renderer')
var userRenderer = nodeRequire('./app/user_renderer')


var usernameMap = {}
var arrivedTweetsMap = {}

function getTimelineId(user, tl) {
    return 'timeline_' + user.data.screen_name + '_' + tl
}

function updateUnreadCount(user, tl) {
    let timelineDiv = $('#' + getTimelineId(user, tl))
    let username = user.data.screen_name
    let count = timelineDiv.children().not('.read').length
    let counterStr = ' (' + count + ')'
    $('#counter_' + username + '_' + tl).text(count == 0 ? '' : counterStr)
}

function showTweetDialog(initialText, author, replyTo) {
    $('#modal').show()
    $('#tweet-dialog-post').prop('disabled', false)
    $('#tweet-dialog-text').prop('disabled', false)
    $('#tweet-dialog-text').focus()
    $('#tweet-dialog-author').val(author)
    $('#tweet-dialog-reply-to').val(replyTo)
}

function getOnTweetContextMenu(timelineDiv, user, tl, tweet) {
    return function (event) {
        event.preventDefault()
        let menu = event.originalEvent._menu = event.originalEvent._menu || new Menu()
        menu.append(new MenuItem({
            label: 'Mark this and previous and read',
            click() {
                user.markAsRead(tl, tweet.id_str)
                // let found = 0
                // timelineDiv.children().reverse().each(function (i, elem) {
                //     if (elem.id == 'tweet_' + tl + '_' + tweet.id_str) {
                //         found = 1
                //     } else if (found > 0) {
                //         found++
                //     }
                //     if (found > 50) {
                //         $(elem).remove()
                //     } else if (found > 0) {
                //         $(elem).addClass('read')
                //     }
                // })
                // setInterval(() => { $('body').scrollTop(0) }, 0)
                // updateUnreadCount(user, tl)
            }
        }))
        menu.append(new MenuItem({
            label: 'Copy JSON',
            click() {
                clipboard.writeText(JSON.stringify(tweet, null, 4))
            }
        }))
    }
}

function onLinkContextMenu(event) {
    event.preventDefault();
    let menu = event.originalEvent._menu = event.originalEvent._menu || new Menu()
    menu.append(new MenuItem({
        label: 'Copy link',
        click: () => {
            clipboard.writeText(this.href)
        }
    }))
}

function defaultErrorHandler(event, err) {
    $('#modal').hide()
    $("#error-text").empty().append(document.createTextNode(JSON.stringify(err)))
    $("#error").show().delay(5000).fadeOut()
}

function setupPostDialog() {
    $('#tweet-dialog-post').on('click', function (event) {
        event.preventDefault()
        $('#tweet-dialog-post').prop('disabled', true)
        $('#tweet-dialog-text').prop('disabled', true)
        setTimeout(() => {
            let author = $('#tweet-dialog-author').val()
            let text = $('#tweet-dialog-text').val()
            let replyTo = $('#tweet-dialog-reply-to').val()
            quiri.users[author].postTweet(text, replyTo)
        }, 2000)
    })
    let tweetDialogText = $('#tweet-dialog-text')
    let updateTweetLength = function () {
        let len = 140 - twitterText.getTweetLength(tweetDialogText.val())
        $('#tweet-dialog-remaining-length').text("" + len)
    }
    tweetDialogText.keypress(updateTweetLength)
    tweetDialogText.keyup(updateTweetLength)
    tweetDialogText.on("keydown", function (event) {
        // don't navigate away from the field on tab when selecting an item
        if (event.keyCode === $.ui.keyCode.TAB && $(this).autocomplete("instance").menu.active) {
            event.preventDefault();
        }
    }).autocomplete({
        minLength: 0,
        autoFocus: true,
        delay: 0,
        position: { my: "right top", at: "right bottom" },
        source: function (request, response) {
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
        focus: function () {
            // prevent value inserted on focus
            return false
        },
        select: function (event, ui) {
            var before = this.value.substring(0, $("#tweet-dialog-text")[0].selectionStart)
            var after = this.value.substring($("#tweet-dialog-text")[0].selectionStart)
            var newBefore = before.replace(/@[\S]+$/, '@' + ui.item.value)
            this.value = newBefore + ' ' + after
            this.setSelectionRange(newBefore.length + 1, newBefore.length + 1);
            $(this).autocomplete('close')
            return false;
        }
    }).autocomplete('instance')._renderItem = function (ul, item) {
        return $('<li>', { class: 'user-item' }).append(
            $('<img>', { src: usernameMap[item.value].img }),
            $("<span></span>", {
                class: 'name'
            }).text(item.label),
            ' ',
            $("<span></span>", {
                class: 'username'
            }).text("@" + item.value)
        ).appendTo(ul)
    }
}

function onTweetArrived(event, user, tl, tweets) {
    let timelineDiv = $('#' + getTimelineId(user, tl))
    for (let i = tweets.length - 1; i >= 0; i--) {
        try {
            let tweet = tweets[i]
            let id = tweet.retweeted_status ? tweet.retweeted_status.id_str : tweet.id_str
            if (tl == 'home' && arrivedTweetsMap[user.data.screen_name].has(id)) {
                log.debug('Tweet already shown')
                continue
            }
            let tweetDiv = tweetRenderer.createTweetDiv($, tl, tweet)
            timelineDiv.append(tweetDiv)
            if (tl == 'home') {
                arrivedTweetsMap[user.data.screen_name].add(id)
            }
            tweetDiv.contextmenu(getOnTweetContextMenu(timelineDiv, user, tl, tweet))
            $('#reply-action-' + tl + '-' + tweet.id_str).click(function (event) {
                event.preventDefault()
                var mentions = tweetRenderer.getMentions(user.data, tweet).map((username) => '@' + username).join(' ') + ' '
                //no need to include mentions anymore.
                //TODO: show who is being mentioning in the GUI?
                mentions = ''
                showTweetDialog(mentions, user.data.screen_name, tweet.id_str)
            })
            $('#retweet-action-' + tl + '-' + id).click(function (event) {
                event.preventDefault()
                quiri.users[user.data.screen_name].retweet(id)
            })
            $('#like-action-' + tl + '-' + id).click(function (event) {
                event.preventDefault()
                log.debug('onTweetArrived: ', { tl: tl, id_str: id })
                quiri.users[user.data.screen_name].like(id)
            })
            let mediaDiv = tweetDiv.find('.media-set')
            if (mediaDiv) {
                if (mediaDiv.children().length == 1) {
                    mediaDiv.first().featherlight({ openSpeed: 0 })
                } else {
                    mediaDiv.featherlightGallery({ openSpeed: 0, galleryFadeIn: 0, galleryFadeOut: 0 })
                }
            }
            let sender = (tweet.user || tweet.sender)
            usernameMap[sender.screen_name] = {
                value: sender.screen_name, label: sender.name, img: sender.profile_image_url_https
            }
        } catch (err) {
            console.error(err.stack)
        }
    }
    updateUnreadCount(user, tl)
}

function onUserAdded(event, user) {
    // log.debug('ipcRenderer user-added called with', user)
    userRenderer.addUserDoms(user, $('#timeline'), $('#user_list'))
    arrivedTweetsMap[user.data.screen_name] = new Set()
}

function onUserEvent(event, user, eventMsg) {
    let username = user.data.screen_name
    if (eventMsg.target.screen_name != username) {
        return
    }
    let timelineDiv = $('#' + getTimelineId(user, 'mentions'))
    let eventDiv = tweetRenderer.createEventDiv($, eventMsg)
    if (eventDiv) {
        timelineDiv.append(eventDiv)
        updateUnreadCount(user, 'mentions')
    }
}

var showRead = false

function onDocumentReady() {
    jQuery.fn.reverse = function () {
        return this.pushStack(this.get().reverse(), arguments);
    }
    $('#add_user').click(function (event) {
        event.preventDefault()
        addUser()
    })
    $('#link_dropbox').click(function (event) {
        event.preventDefault()
        linkDropbox()
    })
    $('head').append("<style id='showReadStyle' type='text/css'></style>");
    let showStyle = '.tweet.read { display: block; opacity: 0.6; }'
    let hideStyle = '.tweet.read { display: none; opacity: 1; }'
    $('#showReadStyle').text(hideStyle)
    $('#show_read').click(function (event) {
        event.preventDefault()
        showRead = !showRead
        $('#showReadStyle').text(showRead ? showStyle : hideStyle)
    })
    //open links externally by default
    $(document).on('click', 'a[href^="http"]', function (event) {
        if ($(event.target).parent().attr('data-featherlight')) {
            return
        }
        event.preventDefault();
        event.stopPropagation();
        shell.openExternal(this.href)
    })
    $(document).on('click', '*[data-href^="http"]', function (event) {
        if ($(event.target).parent().attr('data-featherlight')) {
            return
        }
        event.preventDefault();
        event.stopPropagation();
        shell.openExternal(this.getAttribute('data-href'))
    })
    $(document).on('contextmenu', 'a[href^="http"]', onLinkContextMenu)
    $(document).on('contextmenu', function (event) {
        event.preventDefault();
        let menu = event.originalEvent._menu = event.originalEvent._menu || new Menu()
        menu.popup(remote.getCurrentWindow())
    })
    $(window).on('click', function (event) {
        event.preventDefault()
        if (event.target == document.getElementById('modal')) {
            $('#modal').hide()
        }
    })
    var didScroll = false
    $(window).scroll(function () {
        didScroll = true
    })
    setInterval(function () {
        if (didScroll) {
            didScroll = false
            $('video.autoplay').each(function () {
                if ($(this).is(":in-viewport")) {
                    $(this)[0].play();
                } else {
                    $(this)[0].pause();
                }
            })
        }
    }, 500)
    setupPostDialog()
    mainReady()
}

function mainReady() {
    quiri.on('config-changed', () => {
        log.debug('quiri.on config-changed called')
        let config = {}
        log.debug('saving config...')
        quiri.saveConfig(config)
        log.debug('writing to file...')
        fs.writeFileSync('config.json', JSON.stringify(config, null, 4))
        if (quiri.dropboxAuthorization) {
            // Scrub secret data.
            // TODO: this logic should be elsewhere...
            delete config.dropbox_refresh_token
            for (let user in config.users) {
                delete config.users[user]['token']
                delete config.users[user]['secret']
            }
            quiri.dropboxAuthorization.dbx.filesUpload({
                contents: JSON.stringify(config, null, 4),
                path: '/config.json',
                mode: { ".tag": "overwrite" },
                autorename: false,
                mute: true
            })
                .then(function (response) {
                    log.debug('response', response)
                })
                .catch(function (error) {
                    log.error(error)
                })
        }
    })

    let config
    try {
        log.debug(['Reading config from', process.cwd()])
        let content = fs.readFileSync('config.json', 'utf8')
        log.debug(['Config read', content])
        config = JSON.parse(content)
        log.debug(['Loading config...', JSON.stringify(config)])
    } catch (err) {
        if (err.code === 'ENOENT') {
            log.info('Config file not found, loading empty config')
            config = {}
        } else {
            throw err;
        }
    }
    quiri.loadConfig(config)
    log.info('Loaded config')
    log.info(['quiri.dropboxAuthorization', quiri.dropboxAuthorization])
    if (quiri.dropboxAuthorization) {
        setInterval(() => {
            quiri.dropboxAuthorization.dbx.filesDownload({ path: '/config.json' })
                .then(function (response) {
                    log.info(['filesDownload returned success', response.result])
                    let rev = response.result.rev
                    response.result.fileBlob.text().then(
                        text => {
                            log.debug(['loaded Dropbox raw config', text])
                            let cloudConfig = JSON.parse(text)
                            log.debug(['loaded Dropbox config', JSON.stringify(cloudConfig)])
                            quiri.loadCloudConfig(cloudConfig)
                            updateShownTweets()
                        }
                    )
                })
                .catch(function (error) {
                    log.error(['error in filesDownload', error])
                })
        }, 30000)
    }
}

function updateShownTweets(user) {
    if (!user) {
        for (let username in quiri.users) {
            updateShownTweets(quiri.users[username])
        }
        return
    }
    let config = user.config
    for (let tl in config.since_id) {
        let id_str = config.since_id[tl]
        console.log('updateShownTweets', [user.screen_name, tl, id_str])
        let timelineDiv = $('#' + getTimelineId(user, tl))
        let found = 0
        timelineDiv.children().reverse().each((i, elem) => {
            if (elem.id == 'tweet_' + tl + '_' + id_str) {
                found = 1
            } else if (found > 0) {
                found++
            }
            if (found > 50) {
                $(elem).remove()
            } else if (found > 0) {
                $(elem).addClass('read')
            }
        })
        if (found) {
            setInterval(() => { $('body').scrollTop(0) }, 0)
            updateUnreadCount(user, tl)
        }
    }
}

quiri.on('user-added', (user) => {
    // log.debug('quiri.on user-added called with', user)
    onUserAdded(null, user)
    user.on('tweets-loaded', function (user, tl, tweets) {
        onTweetArrived(null, user, tl, tweets)
    })
    user.on('load-error', function (err) {
        console.log(err)
    })
    user.on('friends-loaded', function (user, friends) {
        for (let f of friends) {
            usernameMap[f.screen_name] = {
                value: f.screen_name, label: f.name, img: f.profile_image_url_https
            }
        }
    })
    user.on('load-friend-error', function (err) {
        console.log(err)
    })
    user.on('tweet-posted', (user, tweet) => {
        $('#modal').hide()
    })
    user.on('post-tweet-error', (err) => {
        defaultErrorHandler(null, err)
    })
    user.on('liked', (user, tweetId) => {
        $('#like-action-home-' + tweetId).toggleClass('liked')
        $('#like-action-mentions-' + tweetId).toggleClass('liked')
    })
    user.on('like-error', (err, tweetId) => {
        defaultErrorHandler(null, err)
    })
    user.on('retweeted', (user, tweetId) => {
        $('#retweet-action-home-' + tweetId).toggleClass('retweeted')
        $('#retweet-action-mentions-' + tweetId).toggleClass('retweeted')
    })
    user.on('retweet-error', (err, tweetId) => {
        defaultErrorHandler(null, err)
    })
    user.on('user-event', (user, event) => {
        onUserEvent(null, user, event)
    })
    user.on('config-changed', (user) => {
        updateShownTweets(user)
    })
    user.start()
})

$(document).ready(onDocumentReady)

window.onerror = function (error, url, line) {
    log.error(error, JSON.stringify([url, line]))
}

var twitterAuthorization = new TwitterAuthorization('quiriquiri://authorize/', secret['consumer_key'], secret['consumer_secret'])
var addUserWin = null

function addUser() {
    twitterAuthorization.getRequestToken((error, token, secret) => {
        if (error) {
            console.log(JSON.stringify(error))
        } else {
            addUserWin = window.open(`https://api.twitter.com/oauth/authorize?oauth_token=${token}`, 'addUser')
        }
    })
}

ipcRenderer.on('authorized', (event, query) => {
    addUserWin.close()
    twitterAuthorization.getAccessToken(query, function (error, token, secret) {
        if (error) {
            log.error(JSON.stringify(error))
        } else {
            log.debug(`token ${token} secret ${secret}`)
            quiri.addUser(token, secret)
        }
    })
})


var dropboxAuthorization = new DropboxAuthorization('quiriquiri://dropbox-authorize/', secret['dropbox_client_id'])

function linkDropbox() {
    dropboxAuthorization.getAuthenticationUrl((error, authUrl) => {
        if (error) {
            console.log(JSON.stringify(error))
        } else {
            console.log(`Opening ${authUrl}`)
            addUserWin = window.open(authUrl, 'linkDropbox')
        }
    })
}

ipcRenderer.on('dropbox-authorized', (event, code) => {
    addUserWin.close()
    dropboxAuthorization.authenticate(code, function (error, refresh_token) {
        if (error) {
            log.error(JSON.stringify(error))
        } else {
            log.debug(`refresh_token ${refresh_token}`)
            quiri.linkDropbox(refresh_token)
        }
    })
})
