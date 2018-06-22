const steem = require('steem');
const mysql = require('mysql');
const CronJob = require('cron').CronJob;
const fs = require('fs');
const UpvoteTasks = require('./upvote_tasks');
const logger = require('./steemlog');

class SteemBot {

    constructor(options, next = function(){}) {

        let default_options = {
            time_to_add_to_upvote: 30 * 60 * 1000, // After 30 minutes from publishing post 100% of curation reward goes to upvoter
            twelve_hours: 12 * 60 * 60 * 1000, // Steem Blockchain allows to upvote maximum 12 hours before cashout (means upvote can be done up to 6 days and 12 hours after publishing article) (cashout is 7 days after publishing article),
            six_days_and_twelve_hours: (6 * 24 + 12) * 60 * 60 * 1000, // As above, reverse in relation to week
            upvote_offset: -30 // 30 seconds before 30 minutes after publishing to vote before other bots
        }

        this.options = Object.assign({}, default_options, options);

        this.readConfig(() => {
            this.setDatabaseConnection();
            this.setCrons();

            UpvoteTasks.setData(
                this.options.steem.posting_key, 
                this.options.steem.account_name, 
                this.connection
            );

            UpvoteTasks.init();

            next();
        });
    }

    /**
     * Reading configuration JSON file and after saving settings
     * @param {function()} next - callback after saving settings
     */
    readConfig(next) {
        fs.readFile('config.json', (error, data) => {

            if(error){
                logger.log(error);
            }
    
            this.options = Object.assign(this.options, JSON.parse(data.toString()));
            
            next();
        });
    }

    /**
     * Setting up mysql connection
     */
    setDatabaseConnection() {

        this.connection = mysql.createConnection({
            user: this.options.mysql.user,
            password: this.options.mysql.password,
            database: this.options.mysql.db
        });
    
        this.connection.connect(error => {
            if(error){
                logger.log(error);
            }
        });
    }

    /**
     * Setting up CRON Jobs
     */
    setCrons() {
        // Setting Cron Job for scanning Users for Articles
        if(this.options.scan_users_interval) {
            logger.log('CRON JOB: Scanning Users for articles to upvote is active');

            new CronJob(this.options.scan_users_interval, () => {
                this.scanUsers();
            }, null, true, null, null, true);
        }
        

        // Setting Cron Job for scanning other Bots actions 
        if(this.options.scan_bots_interval) {
            logger.log('CRON JOB: Scanning Articles for Bots is active');

            new CronJob(this.options.scan_bots_interval, () => {
                this.scanUserArticlesForBots();
            }, null, true, null, null, true);
        }
        

        // Setting Cron Job for redeeming rewards
        if(this.options.redeem_rewards_interval) {
            logger.log('CRON JOB: Redeeming rewards is active');

            new CronJob(this.options.redeem_rewards_interval, () => {
                this.redeemRewards();
            }, null, true, null, null, true);
        }
        
    }

    /**
     * Main function for Cron Job
     * Scanning users and then its articles in order to upvote them
     */
    scanUsers() {
        logger.log('CRON JOB: Scanning Users for articles to upvote is fired');

        this.connection.query('SELECT * FROM `users` WHERE `active` = 1', (error, results, fields) => {
            if(error){
                logger.log(error);
            }

            results.forEach(user => {
                this.scanUserArticles(user);
            });
            
        });
    }

    /**
     * Getting last user article and then pushing it forward
     * @param {object} user - Database user
     */
    scanUserArticles(user) {
        var now = new Date().toJSON().substr(0, 19);
        steem.api.getDiscussionsByAuthorBeforeDate(user.account_name, '', now, 1,
            (error, result) => {
    
                if(error){
                    logger.logError(error , 'SteemBot.scanUserArticles: getDiscussionsByAuthorBeforeDate');
                }
    
                this.checkAndPrepareArticle(user, result[0]);
            }
        );
    }

    /**
     * Checking if article doesn't exist and then if not, preparing initial information for future upvote
     * @param {object} user - Database user
     * @param {object} article - Database article
     */
    checkAndPrepareArticle(user, article) {
        var created = new Date(article.created + 'Z').getTime();

        var now_utc_timestamp = new Date().getTime(); // + new Date().getTimezoneOffset() * 60 * 1000;

        // Check if current date (now) is earlier than 6.5 days after publishing
        if(created + this.options.six_days_and_twelve_hours > now_utc_timestamp){
            var permlink = article.permlink;
            var user_offset = user.upvote_time_offset * 1000; // seconds to miliseconds, stored in database to vote before other Bots, fe. -5 (seconds)
            var account_name = user.account_name;
            var upvote_strength = user.upvote_strength;
            var published = new Date(article.created + 'Z').toISOString().slice(0, 19).replace('T', ' ');

            var direction = 'up'; // Default direction to look for free slot/space in upvote_tasks array is "up"
            if(created + this.options.time_to_add_to_upvote >= now_utc_timestamp){
                var timestamp_to_fire = created + user_offset + this.options.time_to_add_to_upvote;

                logger.logArticleAction(account_name, permlink, 'should be upvoted ~30 minutes after being published');

                if(user_offset < 0) {
                    direction = 'down'; // If offset below 0 it means upvote should be done before other bots upvote (most often exactly 30 minutes after publishing article), that's why direction is set to down in order to look for available place before, not after
                }
            }
            else {
                var timestamp_to_fire = new Date().getTime() + 1000 * 60; // 60 seconds after now

                // direction is "up" because we want to upvote AFTER now, not BEFORE which is possible with "down" setting
                logger.logArticleAction(account_name, permlink, 'should be upvoted as quick as possible');
            }

            this.connection.query('SELECT `id` FROM `articles` WHERE `account_name` = ? AND `permlink` = ?', [account_name, permlink], (error, results, fields) => {
                
                if(error){
                    logger.log(error);
                }

                // Check if article exists, if not add new
                if(results.length == 0) {
                    this.addArticle(account_name, permlink, published, upvote_strength, timestamp_to_fire, direction);  
                }
            });
        }
    }

    /**
     * Adding article to database and setting up task in UpvoteTasks instance
     * @param {string} account_name - Steem Blockchain account name
     * @param {string} permlink - Steem Blockchain article permlink 
     * @param {number} upvote_strength - 1-100% upvote strength
     * @param {number} timestamp_to_fire - "proposed/initial" timestamp to set up cron task (in order to upvote)
     * @param {string} direction - 'up' / 'down'
     */
    addArticle(account_name, permlink, published, upvote_strength, timestamp_to_fire, direction) {

        this.connection.query('INSERT INTO `articles` SET ?', {
            permlink: permlink,
            account_name: account_name,
            upvote_strength: upvote_strength,
            published: published,
            done: 0
        }, (error) => {
            if(error){
                logger.log(error);
            }
            else {
                logger.logArticleAction(account_name, permlink, 'inserted to database');
            }
        });

        UpvoteTasks.setTask(timestamp_to_fire, account_name, permlink, upvote_strength, direction);
    }

    /**
     * Main function for Cron Job - searching for other bots activities (upvoteing same users)
     */
    scanUserArticlesForBots() {
        logger.log('CRON JOB: Scanning Articles for Bots is fired');

        this.connection.query('SELECT * FROM `users`', (error, users, fields) => {
            if(error){
                logger.log(error);
            }

            this.connection.query('SELECT * FROM `bots`', (error, bots) => {

                if(error){
                    logger.log(error);
                }
                this.bots = bots;

                users.forEach((user) => {
                    this.checkUserForBots(user);
                });
            });
        });
    }

    /**
     * Getting last article before 30 minutes and then pass it to check it
     * @param {object} user - user object from database
     */
    checkUserForBots(user) {
        this.getLastArticleBefore30Min(user.account_name, '', (article) => {
            this.checkUserArticleForBots(user, article);
        });
    }

    /**
     * Function is recursively looking for the last article published 30 minutes before now (because other bots are upvoting at least 30 minutes after publishing article)
     * @param {string} account_name - Steem Blockchain user account name
     * @param {string} permlink - Steem article permlink
     * @param {function()} next 
     */
    getLastArticleBefore30Min(account_name, permlink = '', next) {
        var now = new Date().toJSON().substr(0, 19);

        steem.api.getDiscussionsByAuthorBeforeDate(account_name, permlink, now, 2, (error, articles) => {
            
            if(error) {
                logger.logError(error, 'SteemBot.getLastArticleBefore30Min: getDiscussionsByAuthorBeforeDate')
            }

            if(articles.length > 0){
                var created_timestamp = new Date(articles[0].created).getTime();
                var now_utc_timestamp = new Date().getTime() + new Date().getTimezoneOffset() * 60 * 1000;

                if(now_utc_timestamp > created_timestamp + this.options.time_to_add_to_upvote) {
                    return next(articles[0]);
                }
    
                return this.getLastArticleBefore30Min(account_name, articles[1].permlink, next);
            }
            else {
                return next(false);
            }
            
        });
    }

    /**
     * Checking if any bot is also upvoting same user articles
     * @param {object} user - user from database
     * @param {object} article - single article from Steem Blockchain
     */
    checkUserArticleForBots(user, article) {

        var if_bots_active = false;
        this.bots.forEach((bot) => {
            article.active_votes.map((vote) => {
                if(vote.voter == bot.account_name){
                    if_bots_active = true;
                }
            });
        });

        if(if_bots_active && user.upvote_time_offset == 0) {
            // If bot is active in specified user - set upvote offset in order to vote before it
            this.setUserUpvoteOffset(user, this.options.upvote_offset);
            logger.logUserAction(user.account_name, 'got upvote offset');
        }
        else if(!if_bots_active && user.upvote_time_offset < 0) {
            // If bot isn't active - set upvote offset as 0
            // Other bots can stop to upvote specified user so it is important to reset offset
            this.setUserUpvoteOffset(user, 0);
            logger.logUserAction(user.account_name, 'got upvote offset removed');
        }
    }

    /**
     * Settings upvote offset to user
     * @param {object} user - user object
     * @param {number} upvote_offset - upvote offset in seconds (fe. -30 means 30 seconds before 30 minutes after publishing article)
     */
    setUserUpvoteOffset(user, upvote_offset) {
        this.connection.query('UPDATE `users` SET `upvote_time_offset` = ? WHERE `id` = ?',
            [
                upvote_offset, 
                user.id
            ],
            (error) => {

            }
        );
    }

    /**
     * Main function for Cron Job
     * Redeeming Steem rewards
     */
    redeemRewards() {
        logger.log('CRON JOB: Redeeming rewards is fired');

        steem.api.getAccounts([this.options.steem.account_name], (error, result) => {
        
            if(error){
                logger.logError(error, 'SteemBot.redeemRewards: getAccounts');
            }
            
            if(
                parseInt(result[0].reward_steem_balance) > 0 ||
                parseInt(result[0].reward_sbd_balance) > 0 ||
                parseInt(result[0].reward_vesting_balance) > 0
            ) {
                steem.broadcast.claimRewardBalance(
                    this.options.steem.posting_key, 
                    this.options.steem.account_name, 
                    result[0].reward_steem_balance, 
                    result[0].reward_sbd_balance, 
                    result[0].reward_vesting_balance,
                    (error, result) => {
                        if(error) {
                            logger.logError(error, 'SteemBot.RedeemRewards: claimRewardBalance');
                        }
                        else {
                            logger.log('Reward redeemed')
                        }
                    }
                );
            }
        });
    }
}

module.exports = function(options, next){
    return new SteemBot(options, next);
};