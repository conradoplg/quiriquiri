var log = require('winston')

log.level = 'debug'
log.add(new log.transports.Console({
    format: log.format.simple(),
}))
log.add(new log.transports.File({
    filename: 'quiriquiri.log',
    maxsize: 1024 * 1024,
    maxFiles: 5
}))

module.exports = log
