"use strict"

function createTweetDiv($, tweet) {
    var t = tweet;
    var shownStatus = tweet;
    var retweeterUser;

    if (t.retweeted_status) {
        shownStatus = t.retweeted_status
        retweeterUser = tweet["user"]
    }
    var quotedStatus = shownStatus.quoted_status
    var text = shownStatus.text
    var user = shownStatus.user

    var tweetDiv = $("<div></div>", {
        class: "tweet"
    })
    tweetDiv.append($("<div></div>", {
        class: "profile"
    }).append(
        $('<p></p>').append(
            $("<img>", {
                class: "profile-image",
                src: user["profile_image_url_https"]
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
        $("<span></span>", {class: 'name'}).text(user["name"]),
        $("<span></span>", {class: 'username'}).text(" @" + user["screen_name"])
    );
    if (retweeterUser !== undefined) {
        headerDiv.append(
            $("<span></span>", {class: 'retweeted-by'}).text(' retweeted by '),
            $("<span></span>", {class: 'name'}).text(retweeterUser["name"]),
            $("<span></span>", {class: 'username'}).text(" @" + retweeterUser["screen_name"])
        )
    }
    headerDiv.append($("<a></a>", {
        href: "https://twitter.com/" + user['scree_name'] + '/status/' + shownStatus.id_str,
        target: '_blank'
    }).text('#'))
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
            $("<span></span>", {class: 'name'}).text(quotedStatusUser["name"]),
            $("<span></span>", {class: 'username'}).text(" @" + quotedStatusUser["screen_name"])
        ))
        tweetP = $("<p></p>")
        createTextDiv($, tweetP, quotedStatus)
        quotedDiv.append(tweetP);
    }
    return tweetDiv;
}

function createTextDiv($, tag, tweet) {
    var t = tweet
    var ents = []
    if (t.entities) {
        const types = ['media', 'urls', 'user_mentions', 'hashtags', 'symbols', 'extended_entities']
        for (const typ of types)
            if (t.entities[typ]) {
                let nents = t.entities[typ].map(e => [e.indices[0], typ, e])
                ents = ents.concat(nents)
            }
    }
    ents.sort((a, b) => a[0] - b[0])

    var text = tweet.text
    var offset = 0
    for (const e of ents) {
        let typ = e[1]
        let ent = e[2]
        let chunk = text.substring(offset, ent.indices[0])
        _add_chunk($, tag, chunk)
        chunk = text.substring(ent.indices[0], ent.indices[1])
        offset = ent.indices[1]
        let url
        let line_broken = false
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
            if (!line_broken) {
                tag.append($("<br/>"))
                tag.append($("<br/>"))
                line_broken = true
            }
            tag.append($("<a></a>", {
                href: ent.media_url_https + ':large'
            }).append(
                $("<img/>", {
                    src: ent.media_url_https + ':small'
                })
            ));
            _add_chunk($, tag, ' ')
        } else {
            tag.append($("<a></a>", {
                href: url
            }).text(chunk))
        }
    }
    _add_chunk($, tag, text.substring(offset))
}

function _add_chunk($, tag, text) {
    text = text.replace('&gt;', '>')
    text = text.replace('&lt;', '<')
    text = text.replace('&amp;', '&')
    var i = 0
    for (const line of text.split('\n')) {
        if (i > 0) {
            tag.append($("<br/>"))
        }
        tag.append(line.replace(/\n*$/, ""))
        i++
    }
}


module.exports.createTextDiv = createTextDiv
module.exports.createTweetDiv = createTweetDiv
