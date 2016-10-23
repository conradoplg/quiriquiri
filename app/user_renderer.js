function addUserDoms(user, timelineDiv, userListDiv) {
    let username = user.data.screen_name
    let divs = {}
    for (let tl of['home', 'mentions', 'dms']) {
        let div = $('<div></div>', {
            id: getTimelineId(user, tl),
            class: 'timeline'
        })
        timelineDiv.append(div)
        divs[tl] = div
    }
    timelineDiv.children().hide()
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
        link.click(function (event) {
            event.preventDefault()
            $('#timeline').children().hide()
            divs[tl].show()
        })
        links[tl] = link
    }
    let postLink = $('<a></a>', {
        href: '#' + username + '/post'
    }).text('Post')
    postLink.click(function (event) {
        event.preventDefault()
        showTweetDialog('', username, '')
    })
    userListDiv.append(
        $('<li></li>').text(username),
        $('<ul></ul>').append(
            $('<li></li>').append(postLink),
            $('<li></li>').append(links.home),
            $('<li></li>').append(links.mentions),
            $('<li></li>').append(links.dms)
        )
    )
}

module.exports.addUserDoms = addUserDoms
