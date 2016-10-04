"use strict"

const log = require('winston')
const fs = require('fs')


var replySvg = fs.readFileSync(`${__dirname}/../images/reply.svg`, 'utf8');
var retweetSvg = fs.readFileSync(`${__dirname}/../images/retweet.svg`, 'utf8');
var likeSvg = fs.readFileSync(`${__dirname}/../images/like.svg`, 'utf8');


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

function createTweetDiv($, tweet) {
    var t = tweet;
    var shownStatus = tweet;
    var retweeterUser;
    var mentions = []

    if (t.retweeted_status) {
        shownStatus = t.retweeted_status
        retweeterUser = tweet.user
    }
    var quotedStatus = shownStatus.quoted_status
    var text = shownStatus.text
    var user = shownStatus.user || shownStatus.sender
    var timestamp = new Date(tweet.created_at)
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

    var tweetDiv = $("<div></div>", {
        id: 'tweet_' + tweet.id_str,
        class: "tweet"
    })
    tweetDiv.append($("<div></div>", {
        class: "profile"
    }).append(
        $('<p></p>').append(
            $("<img>", {
                class: "profile-image",
                src: user.profile_image_url_https
            })
        )
    ))
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
    );
    if (retweeterUser !== undefined) {
        headerDiv.append(
            $("<span></span>", {
                class: 'retweeted-by'
            }).text(' retweeted by '),
            $("<span></span>", {
                class: 'name'
            }).text(retweeterUser["name"]),
            ' ',
            $("<a></a>", {
                class: 'username',
                href: 'https://twitter.com/' + retweeterUser.screen_name
            }).text("@" + retweeterUser.screen_name)
        )
    }
    headerDiv.append(' ', $("<a></a>", {
        class: 'timestamp',
        href: "https://twitter.com/" + user.screen_name + '/status/' + tweet.id_str,
        target: '_blank'
    }).text(timestampStr))
    var tweetP = $("<p></p>")
    createTextDiv($, tweetP, shownStatus)
    bodyDiv.append(tweetP);
    if (quotedStatus !== undefined) {
        var quotedStatusUser = quotedStatus["user"];
        var quotedDiv = $("<blockquote></blockquote>")
        bodyDiv.append(quotedDiv)
        quotedDiv.append($("<p></p>", {
            class: "user"
        }).append(
            $("<span></span>", {
                class: 'name'
            }).text(quotedStatusUser["name"]),
            $("<span></span>", {
                class: 'username'
            }).text(" @" + quotedStatusUser["screen_name"])
        ))
        tweetP = $("<p></p>")
        createTextDiv($, tweetP, quotedStatus)
        quotedDiv.append(tweetP);
    }
    var footerDiv = $('<div></div>', {
        class: 'footer'
    }).append(
        $('<a></a>', {
            id: 'reply-action-' + tweet.id_str,
            href: '#reply-' + tweet.id_str,
            class: 'action reply-action'
        }).append(
            $(replySvg, {}).toggleClass('action-icon')
        ),
        $('<a></a>', {
            id: 'retweet-action-' + tweet.id_str,
            href: '#retweet-' + tweet.id_str,
            class: 'action retweet-action' + (tweet.retweeted ? ' retweeted' : '')
        }).append(
            $(retweetSvg, {}).toggleClass('action-icon'),
            $('<span></span>', {
                id: 'retweet-count-' + tweet.id_str,
                class: 'count'
            }).text(
                tweet.retweet_count > 0 ? '' + tweet.retweet_count : ''
            )
        ),
        $('<a></a>', {
            id: 'like-action-' + tweet.id_str,
            href: '#like-' + tweet.id_str,
            class: 'action like-action' + (tweet.favorited ? ' liked' : '')
        }).append(
            $(likeSvg, {}).toggleClass('action-icon'),
            $('<span></span>', {
                id: 'like-count-' + tweet.id_str,
                class: 'count'
            }).text(
                tweet.favorite_count > 0 ? '' + tweet.favorite_count : ''
            )
        )
    )
    bodyDiv.append(footerDiv)
    return tweetDiv;
}

function createTextDiv($, tag, tweet) {
    var t = tweet
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

    var text = Array.from(tweet.full_text || tweet.text)
    var offset = 0
    var mediaDiv = null
    for (const e of ents) {
        let typ = e[1]
        let ent = e[2]
        let chunk = text.slice(offset, ent.indices[0]).join('')
        if (chunk.length > 0 && offset < ent.indices[0]) {
            _add_chunk($, tag, chunk)
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
                _add_chunk($, tag, '@')
                break
            case 'hashtags':
                url = 'https://twitter.com/search?q=' + ent.text
                chunk = chunk.substring(1)
                _add_chunk($, tag, '#')
                break
        }
        if (typ == 'media') {
            if (!mediaDiv) {
                mediaDiv = $("<div></div>", {
                    class: 'media-set'
                })
                tag.append(mediaDiv)
            }
            if (ent.video_info) {
                let video = $("<video></video>", {
                    class: 'media media-' + mediaCount,
                    controls: ''
                })
                mediaDiv.append(video)
                for (const variant of ent.video_info.variants) {
                    video.append($('<source></source>', {
                        src: variant.url,
                        type: variant.content_type
                    }))
                }
            } else {
                mediaDiv.append($("<a></a>", {
                    href: ent.media_url_https + ':large'
                }).append(
                    $("<img/>", {
                        class: 'media media-' + mediaCount,
                        src: ent.media_url_https + ':small'
                    })
                ))
            }
        } else {
            //don't include link to quoted status
            if (!tweet.quoted_status_id_str || url.indexOf(tweet.quoted_status_id_str) == -1) {
                tag.append($("<a></a>", {
                    href: url
                }).text(chunk))
            }
        }
    }
    _add_chunk($, tag, text.slice(offset).join(''))
}

function _add_chunk($, tag, text) {
    var i = 0
    for (const line of text.split('\n')) {
        if (i > 0) {
            tag.append($("<br/>"))
        }
        // Using tag[0].ownerDocument instead of just 'document' because the latter is not accessible in tests
        tag.append(tag[0].ownerDocument.createTextNode(line.replace(/\n*$/, "")))
        i++
    }
}


module.exports.createTextDiv = createTextDiv
module.exports.createTweetDiv = createTweetDiv
module.exports.getMentions = getMentions
