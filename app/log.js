var log = require('winston')

log.level = 'debug'
log.add(log.transports.File, {filename: 'quiriquiri.log'});

module.exports = log
