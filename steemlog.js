var fs = require('fs');

function writeLogMessage(message){
    var log_stream = fs.createWriteStream('log.txt', {encoding: 'utf8', flags: 'a'});
    log_stream.write(new Date() + ' | ' + message + '\r\n');
    log_stream.end();
}

exports.log = function(message){
    writeLogMessage(message);
}

exports.logUserAction = function(account_name, action) {
    writeLogMessage('User: ' + account_name.toUpperCase() + ' ' + action);
}

exports.logArticleAction = function(account_name, permlink, action) {
    writeLogMessage('Article: ' + account_name.toUpperCase() + ' /  ' + permlink + action);
}

exports.logError = function(error, place) {
    writeLogMessage('[' + place + '] Error: ' + error);
}