"use strict"

const log = require('./log')
const fs = require('fs')
const twemoji = require('twemoji')

const REPLY_SVG = fs.readFileSync(`${__dirname}/../images/reply.svg`, 'utf8')
const RETWEET_SVG = fs.readFileSync(`${__dirname}/../images/retweet.svg`, 'utf8')
const LIKE_SVG = fs.readFileSync(`${__dirname}/../images/like.svg`, 'utf8')


// Get which users should be mentioned when replying a tweet.
function getMentions(user, tweet) {
    var m = []
    var shownStatus = tweet

    if (tweet.retweeted_status) {
        m.push(tweet.retweeted_status.user.screen_name)
        shownStatus = tweet.retweeted_status
    }
    m.push(tweet.user.screen_name)
    if (shownStatus.entities && shownStatus.entities.user_mentions) {
        for (let mention of shownStatus.entities.user_mentions) {
            if (m.indexOf(mention.screen_name) == -1) {
                m.push(mention.screen_name)
            }
        }
    }
    return m.filter((screen_name) => screen_name != user.screen_name)
}

// Convert a Twitter date into a string timestamp.
function getTimestamp(created_at) {
    var timestamp = new Date(created_at)
    var now = new Date()
    var options = {
        hour: "2-digit",
        minute: "2-digit"
    }
    if (timestamp.getMonth() != now.getMonth() || timestamp.getDate() != now.getDate()) {
        options.day = '2-digit'
        options.month = '2-digit'
        options.weekday = 'short'
    }
    if (timestamp.getFullYear() != now.getFullYear()) {
        options.year = '2-digit'
    }
    var timestampStr = timestamp.toLocaleString(undefined, options)
    return timestampStr
}

// Create a profile div for the specified user.
function createProfileDiv($, user) {
    return $("<div></div>", {
        class: "profile"
    }).append(
        $('<p></p>').append(
            $("<img>", {
                class: "profile-image",
                src: user.profile_image_url_https
            })
        )
    )
}

function createHeaderDiv($, user, retweeterUser, tweet, withTimestamp=true) {
    var timestampStr = getTimestamp(tweet.created_at)
    var headerDiv = $("<p></p>", {
        class: "header"
    })
    headerDiv.append(
        $("<span></span>", {
            class: 'name'
        }).text(user.name),
        ' ',
        $("<a></a>", {
            class: 'username',
            href: 'https://twitter.com/' + user.screen_name
        }).text("@" + user.screen_name)
    );
    if (retweeterUser) {
        headerDiv.append(
            $("<span></span>", {
                class: 'retweeted-by'
            }).text(' retweeted by '),
            $("<span></span>", {
                class: 'name'
            }).text(retweeterUser.name),
            ' ',
            $("<a></a>", {
                class: 'username',
                href: 'https://twitter.com/' + retweeterUser.screen_name
            }).text("@" + retweeterUser.screen_name)
        )
    }
    if (withTimestamp) {
        headerDiv.append(' ', $("<a></a>", {
            class: 'timestamp',
            href: "https://twitter.com/" + user.screen_name + '/status/' + tweet.id_str,
            target: '_blank'
        }).text(timestampStr))
    }
    return headerDiv
}

function createQuotedDiv($, quotedStatus) {
    return $("<blockquote></blockquote>", {
        class: 'quoted-tweet',
        'data-href': "https://twitter.com/" + quotedStatus.user.screen_name + '/status/' + quotedStatus.id_str,
    }).append(
        createHeaderDiv($, quotedStatus.user, null, quotedStatus, false),
        createTextP($, quotedStatus)
    )
}

function createFooterDiv($, tl, tweet) {
    return $('<div></div>', {
        class: 'footer'
    }).append(
        $('<a></a>', {
            id: 'reply-action-' + tl + '-' + tweet.id_str,
            href: '#reply-' + tweet.id_str,
            class: 'action reply-action'
        }).append(
            $(REPLY_SVG, {}).toggleClass('action-icon')
        ),
        $('<a></a>', {
            id: 'retweet-action-' + tl + '-' + tweet.id_str,
            href: '#retweet-' + tweet.id_str,
            class: 'action retweet-action' + (tweet.retweeted ? ' retweeted' : '')
        }).append(
            $(RETWEET_SVG, {}).toggleClass('action-icon'),
            $('<span></span>', {
                id: 'retweet-count-' + tl + '-' + tweet.id_str,
                class: 'count'
            }).text(
                tweet.retweet_count > 0 ? '' + tweet.retweet_count : ''
            )
        ),
        $('<a></a>', {
            id: 'like-action-' + tl + '-' + tweet.id_str,
            href: '#like-' + tweet.id_str,
            class: 'action like-action' + (tweet.favorited ? ' liked' : '')
        }).append(
            $(LIKE_SVG, {}).toggleClass('action-icon'),
            $('<span></span>', {
                id: 'like-count-' + tweet.id_str,
                class: 'count'
            }).text(
                tweet.favorite_count > 0 ? '' + tweet.favorite_count : ''
            )
        )
    )
}

// Create a div with the specifid tweet rendered on it.
function createTweetDiv($, tl, tweet) {
    var shownStatus = tweet
    var retweeterUser
    if (tweet.retweeted_status) {
        shownStatus = tweet.retweeted_status
        retweeterUser = tweet.user
    }
    var quotedStatus = shownStatus.quoted_status
    var user = shownStatus.user || shownStatus.sender

    let div = $("<div></div>", {
        id: 'tweet_' + tl + '_' + tweet.id_str,
        class: "tweet"
    }).append(
        createProfileDiv($, user),
        $("<div></div>", {
            class: 'body'
        }).append(
            createHeaderDiv($, user, retweeterUser, tweet),
            createTextP($, shownStatus),
            (quotedStatus ? createQuotedDiv($, quotedStatus) : ''),
            createFooterDiv($, tl, tweet)
        )
    )
    twemoji.parse(div[0])
    return div
}

function createEventDiv($, event) {
    var timestampStr = getTimestamp(event.created_at)
    var user = event.source
    var eventDescription = {
        favorite: 'favorited your tweet',
        follow: 'is following you',
        quoted_tweet: 'quoted your tweet'
    }
    if (!eventDescription[event.event]) {
        return null
    }

    var tweetDiv = $("<div></div>", {
        class: "tweet event"
    })
    var profileDiv = $("<div></div>", {
        class: "profile"
    })
    tweetDiv.append(profileDiv)
    if (['favorite', 'quoted_tweet'].indexOf(event.event) != -1) {
        profileDiv.append(
            $('<p></p>').append(
                (event.event == 'favorite' ?
                    $(LIKE_SVG, {}).toggleClass('action-icon like-action') :
                    $(RETWEET_SVG, {}).toggleClass('action-icon retweet-action')
                )
            )
        )
    }
    var bodyDiv = $("<div></div>", {
        class: 'body'
    })
    tweetDiv.append(bodyDiv)
    var headerDiv = $("<p></p>", {
        class: "header"
    })
    bodyDiv.append(headerDiv)
    headerDiv.append(
        $("<span></span>", {
            class: 'name'
        }).text(user["name"]),
        ' ',
        $("<a></a>", {
            class: 'username',
            href: 'https://twitter.com/' + user.screen_name
        }).text("@" + user.screen_name)
    )
    headerDiv.append(
        $("<span></span>", {
            class: 'event-description'
        }).text(' ' + eventDescription[event.event])
    )
    headerDiv.append(' ', $("<a></a>", {
        class: 'timestamp'
    }).text(timestampStr))
    if (event.target_object) {
        var tweetP = createTextP($, event.target_object, true)
        bodyDiv.append(tweetP);
    }
    twemoji.parse(tweetDiv[0])
    return tweetDiv;
}

function createTextP($, tweet, isEvent = false) {
    var tag = $("<p></p>", {class: 'tweet-text'})
    var t = tweet.extended_tweet || tweet
    var ents = []
    var ent_indinces = {}
    var mediaCount = 0
    const types = ['media', 'urls', 'user_mentions', 'hashtags', 'symbols', 'extended_entities']
    for (const typ of types) {
        let ent_key = (typ == 'media' ? 'extended_entities' : 'entities')
        if (t[ent_key] && t[ent_key][typ]) {
            let nents = t[ent_key][typ].map(e => [e.indices[0], typ, e])
            ents = ents.concat(nents)
            if (typ == 'media') {
                mediaCount += nents.length
            }
        }
    }
    ents.sort((a, b) => a[0] - b[0])

    var text = Array.from(t.full_text || t.text)
    var offset = 0
    var mediaDiv = null
    for (const e of ents) {
        let typ = e[1]
        let ent = e[2]
        let chunk = text.slice(offset, ent.indices[0]).join('')
        if (chunk.length > 0 && offset < ent.indices[0]) {
            addTextChunk($, tag, chunk)
        }
        chunk = text.slice(ent.indices[0], ent.indices[1]).join('')
        offset = ent.indices[1]
        let url
        switch (typ) {
            case 'urls':
                url = ent.expanded_url || ent.url
                chunk = ent.display_url || ent.url
                break
            case 'user_mentions':
                url = 'https://twitter.com/' + ent.screen_name
                chunk = chunk.substring(1)
                addTextChunk($, tag, '@')
                break
            case 'hashtags':
                url = 'https://twitter.com/search?q=' + ent.text
                chunk = chunk.substring(1)
                addTextChunk($, tag, '#')
                break
        }
        if (typ == 'media' && !isEvent) {
            if (!mediaDiv) {
                mediaDiv = $("<div></div>", {
                    class: 'media-set',
                    'data-featherlight-gallery': '',
                    'data-featherlight-filter': 'a',
                })
                tag.append(mediaDiv)
            }
            if (ent.video_info) {
                let videoOptions = {
                    class: 'media media-' + mediaCount,
                }
                if (ent.type == 'animated_gif') {
                    videoOptions.loop = ''
                    videoOptions.class += ' autoplay'
                } else {
                    videoOptions.controls = ''
                }
                let video = $("<video></video>", videoOptions)
                mediaDiv.append(video)
                for (const variant of ent.video_info.variants) {
                    video.append($('<source></source>', {
                        src: variant.url,
                        type: variant.content_type
                    }))
                }
            } else {
                mediaDiv.append($("<a></a>", {
                    href: ent.media_url_https + ':large',
                    'data-featherlight': 'image',
                }).append($("<img/>", {
                    class: 'media media-' + mediaCount,
                    src: ent.media_url_https + ':small'
                })))
            }
        } else {
            //TODO: use metadata to decide this
            //don't include link to quoted status
            if (!tweet.quoted_status || !url || url.indexOf(tweet.quoted_status_id_str) == -1) {
                tag.append($("<a></a>", {
                    href: url
                }).text(chunk))
            }
        }
    }
    addTextChunk($, tag, text.slice(offset).join(''))
    return tag
}

function addTextChunk($, tag, text) {
    text = text.replace(/&gt;/g, '>')
    text = text.replace(/&lt;/g, '<')
    text = text.replace(/&amp;/g, '&')
    // Using tag[0].ownerDocument instead of just 'document' because the latter is not accessible in tests
    tag.append(tag[0].ownerDocument.createTextNode(text.replace(/\n*$/, "")))
}


module.exports.createTextP = createTextP
module.exports.createTweetDiv = createTweetDiv
module.exports.createEventDiv = createEventDiv
module.exports.getMentions = getMentions
