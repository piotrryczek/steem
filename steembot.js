var steem = require('steem');
var mysql = require('mysql');
var CronJob = require('cron').CronJob;
var fs = require('fs');

fs.readFile('confg.json', (error, data) => {

    if(error){
        throw error;
    }

    const config = JSON.parse(data.toString());

    var connection = mysql.createConnection({
        user: config.mysql.user,
        password: config.mysql.password,
        database: config.mysql.db
    });

    connection.connect((err) => {
        if(err){
            console.log(err);
        }
    });

    connection.query('INSERT INTO articles SET ?', {
        permlink: 'a',
        account_name: 'b',
        upvote_strength: 'c',
        done: 0
    }, 
    (error, results, fields) => {
        if(error){
            throw error;
        }
        console.log(results);
    });
});


var cron_upvotes = [];

//const mongo_db_url = 'mongodb://localhost:27017/';
//const mongo_db_name = 'steemit'

// 30 minutes
const time_to_add_to_upvote = 30 * 60 * 60 * 10;
// 5 sekund
//const time_to_add_to_upvote = 5 * 60 * 10;

// 4 seconds
// Steem Blockchain allows to upvote once per 3 seconds
const difference_between_upvotes = 4 * 60 * 10;

var steemit_db;


/*
const mongo_db_url = 'mongodb://localhost:27017/';
const mongo_db_name = 'steemit';
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
exports.scan = function(){

    
    MongoClient.connect(mongo_db_url, {}, function (err, db) {     
        
        steemit_db = db.db(mongo_db_name);
        
        // Pobieramy użytkowników
        steemit_db.collection('users').find({}).toArray(function(err, results){
            
            var upvote_index = 0;
            
            // Iterujemy po użytkownikach
            for(let user of results){
                
                // Pobieramy wpisy użytkownika
                steem.api.getDiscussionsByBlog(
                    {
                        tag: user.account,
                        limit: 1
                    },
                    (err, result) => {
                        var permlink = result[0].permlink;
                        var account = user.account;
                        var upvote_strength = user.upvote_strength;
                        
                        console.log('Pobrano ostatni artykuł dla: ' + account);
                        
                        // Szukamy czy już istnieje artykuł dodany w bazie danych
                        steemit_db.collection('articles').findOne({
                            permlink: permlink,
                            account: account
                        }, function(err, result){
                            
                            // Jeśli nie dodajemy go
                            if(!result){
                                
                                console.log('Dodaje artykuł dla: ' + account + ' / ' + permlink);
                                
                                
                                // Po dodaniu dodajemy zadanie CRON-a
                                steemit_db.collection('articles').insertOne(
                                    {
                                        permlink: permlink,
                                        account: account,
                                        upvote_strength: upvote_strength,
                                        done: false
                                    },
                                    function(err, result){
                                        
                                        var base_time = new Date().getTime() + time_to_add_to_upvote;
                                        var time_to_add = difference_between_upvotes * upvote_index;
                                        var final_time = base_time + time_to_add;
                                        
                                        var date_to_fire = new Date(final_time);

                                        cron_upvotes.push(
                                            new CronJob(date_to_fire, function(){
                                                upvote(account, permlink, upvote_strength);
                                            }, null, true)
                                        );
                                
                                        console.log('Ustanawiam zadanie dla ' + account + ' / ' + permlink + ' | z opóźnieniem: ' + upvote_index * 4 + 'sekund');
                                
                                        upvote_index += 1;
                                    }
                                );
                            }
                            else {
                                console.log('Artykuł istnieje już: ' + account + ' / ' + permlink);
                            }
                        });
                    
                    }
                );
            }
        });
        
    });
}

function upvote(account, permlink, upvote_strength){
    
    steem.broadcast.vote(
        posting_key, 
        author, 
        account, 
        permlink,
        upvote_strength * 10000,
        function (err, result) {
            
            console.log('Nastąpił upvote dla: ' + account + ' / ' + permlink);
            
            steemit_db.collection('articles').update({
                account: account,
                permlink: permlink
            },
            {
                done: true,
                done_when: new Date()
            });
        }
    );
};
*/