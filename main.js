// In renderer process (web page).
const {ipcRenderer} = nodeRequire('electron')
//console.log(ipcRenderer.sendSync('synchronous-message', 'ping')) // prints "pong"

function createTweetDiv(tweet) {
    var t = tweet;
    var shownStatus = tweet;
    var retweeterUser;

    if (t["retweeted_status"] !== undefined) {
        shownStatus = t["retweeted_status"];
        retweeterUser = tweet["user"];
    }
    var quotedStatus = shownStatus["quoted_status"];
    var text = shownStatus["text"];
    var user = shownStatus["user"]

    var tweetDiv = $("<div></div>", {class: "tweet"});
    tweetDiv.append($("<img>", {class: "profile-image", src: user["profile_image_url_https"]}));
    tweetDiv.append($("<p></p>", {class: "user"}).append(
        $("<span></span>").text(user["name"]),
        $("<span></span>").text(" @" + user["screen_name"])
    ));
    if (retweeterUser !== undefined) {
        tweetDiv.append($("<p></p>", {class: "retweeter-user"}).append(
            $("<span></span>").text(retweeterUser["name"]),
            $("<span></span>").text(" @" + retweeterUser["screen_name"])
        ));
    }
    tweetDiv.append($("<p></p>").text(text));
    if (quotedStatus !== undefined) {
        var quotedStatusUser = quotedStatus["user"];
        tweetDiv.append($("<p></p>", {class: "user"}).append(
                $("<span></span>").text(quotedStatusUser["name"]),
                $("<span></span>").text(" @" + quotedStatusUser["screen_name"])
        ));
        tweetDiv.append($("<p></p>").text(quotedStatus["text"]));
    }
    return tweetDiv;
}

ipcRenderer.on('asynchronous-reply', (event, arg) => {
  console.log(arg) // prints "pong"
  for (const tweet of arg) {
    var tweetDiv = createTweetDiv(tweet);
    $("#home_timeline").prepend(tweetDiv);
  }
})

$(document).ready(() => {
    ipcRenderer.send('asynchronous-message', 'ping')
    $('#add_user').click(function (event) {
        event.preventDefault()
        ipcRenderer.send('add-user')
    })
});
