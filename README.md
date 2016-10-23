# QuiriQuiri

This is a Twitter client written with Electron / node.js.

Its main goal is to make it easy to start reading tweets from
where you left off.

Twitter discourages the development of clients which reproduce
the "core Twitter experience"; also, OAuth doesn't work very
 well with desktop applications. (I'm developing this mainly
 for myself.) For this reason, in order to
run this, you will need to register an application with
Twitter and add its credentials in a `secret.js` file at the
project root, e.g.

```javascript
module.exports = {
    consumer_key: '...',
    consumer_secret: '...'
}
```

## Running

`npm install && npm start` should work.

## Packaging

`npm run dist` will generate Linux and Windows packages.