/*
Co dopisać:
- error.log
- offset
- sprawdzanie czy inne boty zagłosowały



 * MySQL (Database structure)
 * USERS (users whose articles should be upvoted):
 * id
 * account (steem account name),
 * upvote_strength (1-100)
 * upvote_time_offset (difference in seconds from 30 minutes delay to upvote)
 * 
 * ARTICLES (articles which should be upvoted):
 * id
 * permlink (steem article permlink)
 * account_name (account which authored artice)
 * upvote_strength (1-100)
 * done (if article was upvoted)
 * 
 * BOTS (bots before which should be applied upvote_time_offset in order to vote before):
 * id
 * account_name
 * 
 * 
 * 
 * 
 * 
 * 
 * 
*/

const express = require('express');
//const path = require('path');
var CronJob = require('cron').CronJob;
var SteemBot = require('./steembot');


// Co 5 minut skanuj (zmień, teraz minuta)

// Scan Blockchain every 5 minutes in order to find new articles to upvote
//var articles_search = new CronJob('0 */1 * * * *', function(){
//    SteemBot.scan();
//}, null, true, null, null, true);



/*
var MongoClient = require('mongodb').MongoClient;
const mongo_db_url = 'mongodb://admin:admin@localhost:27017/';
const mongo_db_name = 'steemit'

MongoClient.connect(mongo_db_url, {}, function (err, db) {

    steemit_db = db.db(mongo_db_name);
    
    steemit_db.collection('articles').aggregate([
        //{ $match: { done: false }},
        { 
            $group: { 
                _id: '$account', 
                upvote_sum: {
                    $avg: {
                        $multiply: ['$upvote_strength', 100]
                    }
                } 
            }
        },
        {
            $project: {
                upvote_sum: {
                    $divide: ['$upvote_sum', 100],
                    
                }
            }
        }
        
    ]).toArray(function(err, result){
        console.log(err)
        console.log(result)
    });
    
    
    //steemit_db.collection('articles').find({}).toArray(function(err, results){
    //    console.log(results)
    //});
    
    
});
*/


const app = express();

module.exports = app;