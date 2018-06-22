/*
Co dopisać:
- dodaj weryfikacje configa

Sprawdź: getLastArticleBefore30Min


 * MySQL (Database structure)
 * USERS (users whose articles should be upvoted):
 * id
 * account_name (Steem Blockchain account name),
 * upvote_strength (1-100)
 * upvote_time_offset (difference in seconds from 30 minutes delay to upvote - aplying when other bots also upvoting same user)
 * 
 * ARTICLES (articles which should be upvoted):
 * id
 * added (current date when article added)
 * published (Steem Blockchain article published - UTC)
 * permlink (steem article permlink)
 * account_name (account which authored artice)
 * upvote_strength (1-100)
 * upvote_when (when article should be upvoted: UTC)
 * done (if article was upvoted)
 * done_when (when article was upvoted: UTC)
 * real_upvote_strength (upvote strength after applying modifiers to it)
 * 
 * BOTS (bots before which should be applied upvote_time_offset in order to vote before):
 * id
 * account_name (Steem Blockchain account name)
 * 
 * 
*/


const express = require('express');
var CronJob = require('cron').CronJob;


// scanUsers: every 5 minutes: 0 */5 * * * *
// scanBots: every 24 hours: 0 0 0 * * *
// scanRewards: every 6 hours: 0 0 */6 * * *

const SteemBot = require('./steembot')({
    scan_users_interval: '0 */5 * * * *',
    scan_bots_interval: '0 0 0 * * *',
    redeem_rewards_interval: '0 0 */6 * * *'
}, () => {});



/*
SteemBot.getLastArticleBefore30Min('nero12', '', (article) => {

    
});


var fs = require('fs');
fs.readFile('article.json', {encoding: 'utf8'}, (error, content) => {
    var article = JSON.parse(content);

    SteemBot.checkUserArticleForBots({account_name: 'nero12'}, article);
});
*/



const app = express();

module.exports = app;