const logger = require('./steemlog');
const CronJob = require('cron').CronJob;
const steem = require('steem');

class UpvoteTasks {
    constructor() {
        this.difference_between_upvotes = 6 * 1000; // Steem Blockchain allows to upvote once per 3 seconds; vote within minimum difference of 6 seconds
        this.upvote_tasks = []; // Array with upvoting tasks
        this.upvote_modifier = 1 // Upvote modifier
    }

    /**
     * 
     * @param {string} posting_key - Steem Blockchain Private Posting Key; provide ONLY POSTING private key - no Master/Owner/Active!
     * @param {string} account_name - Steem Blockchain account name (author (as a bot) which should upvotes others)
     * @param {object} connection - MySQL connection object
     */
    setData(posting_key, account_name, connection) {
        this.posting_key = posting_key;
        this.account_name = account_name;
        this.connection = connection;
    }

    /**
     * Initializing default cron tasks
     */
    init() {
        // Every hour is checking current account voting power left and setted up upvote modifier
        new CronJob('0 0 */1 * * *', () => {
            this.setUpvoteModifier();
        }, null, true, null, null, true);
    }

    /**
     * Preparing Task to be setted up
     * @param {number} timestamp_to_fire - "proposed/initial" timestamp to set up cron task (in order to upvote)
     * @param {string} account_name - Steem Blockchain account name
     * @param {string} permlink - Steem Blockchain article permlink 
     * @param {number} upvote_strength - 1-100% upvote strength
     * @param {string} direction - 'up' / 'down'
     * @param {function()} - callback after setting up new task
     */
    setTask(timestamp_to_fire, account_name, permlink, upvote_strength, direction, next) {

        var final_timestamp_to_fire = this.checkCronTasksForAvailableTime(timestamp_to_fire, direction); // looking for optimal available time to upvote

        this.setCronTask(final_timestamp_to_fire, account_name, permlink, upvote_strength);

        var mysql_upvote_when = new Date(final_timestamp_to_fire).toISOString().slice(0, 19).replace('T', ' ');
        this.connection.query('UPDATE `articles` SET `upvote_when` = ? WHERE `account_name` = ? AND `permlink` = ?', [
            mysql_upvote_when,
            account_name,
            permlink
        ], (error, results, fields) => {
            if (error) {
                logger.log(error);
            } else {
                logger.logArticleAction(account_name, permlink, 'updated in database after setting up task');
            }
        });

        if (next) {
            next();
        }
    }

    /**
     * Setting up Cron Job for upvote
     * @param {number} final_timestamp_to_fire  - final (checked before if correct) timestamp to set up cron task (in order to upvote)
     * @param {string} account_name - Steem Blockchain account name
     * @param {string} permlink - Steem Blockchain article permlink 
     * @param {number} upvote_strength - 1-100% upvote strength
     */
    setCronTask(final_timestamp_to_fire, account_name, permlink, upvote_strength) {
        var cron_job = new CronJob(new Date(final_timestamp_to_fire), () => {
            this.upvote(account_name, permlink, upvote_strength);
        }, null, true);
        cron_job.account_name = account_name;
        cron_job.permlink = permlink;

        logger.logArticleAction(account_name, permlink, 'cron task setted up');

        this.upvote_tasks.push(
            cron_job
        );

        this.upvote_tasks.sort((a, b) => {
            var timestamp_a = new Date(a.cronTime.source).getTime();
            var timestamp_b = new Date(b.cronTime.source).getTime();

            return timestamp_a - timestamp_b;
        });
    }

    /**
     * Delete task from array cron_upvotes
     * @param {string} account_name - Steem Blockchain account name
     * @param {string} permlink  - Steem Blockchain article permlink
     */
    deleteTask(account_name, permlink) {
        this.upvote_tasks = this.upvote_tasks.filter((task) => {
            if (task.account_name != account_name || task.permlink != permlink) {
                return task;
            }
        });
    }

    /**
     * Function is recursively looking for the optimal time for Cron Upvote task to be done in relation to other tasks placed in the cron_upvotes array (minimum difference is 4 seconds)
     * @param {number} timestamp_to_fire - timestamp to check if it is suitable (4 seconds diff from others)
     * @param {string} direction - up/down; down is used when upvote before other Bots
     */
    checkCronTasksForAvailableTime(timestamp_to_fire, direction = 'up') {

        if (this.upvote_tasks.length > 0) {
            var closest = this.getClosestTimestamp(timestamp_to_fire);

            var diff = closest - timestamp_to_fire;
            var diff_absolute = Math.abs(diff);

            if (diff_absolute < this.difference_between_upvotes) {

                if (direction == 'up') {
                    if (diff >= 0) {
                        var new_timestamp_search_for = timestamp_to_fire + (this.difference_between_upvotes + diff_absolute);
                    } 
                    else {
                        var new_timestamp_search_for = timestamp_to_fire + (this.difference_between_upvotes - diff_absolute);
                    }
                } else if (direction == 'down') {
                    if (diff >= 0) {
                        var new_timestamp_search_for = timestamp_to_fire - (this.difference_between_upvotes - diff_absolute);
                    } 
                    else {
                        var new_timestamp_search_for = timestamp_to_fire - (this.difference_between_upvotes + diff_absolute);
                    }
                }
                return this.checkCronTasksForAvailableTime(new_timestamp_search_for, direction);
            } 
            else {
                return timestamp_to_fire;
            }
        }

        return timestamp_to_fire;
    }

    /**
     * Function is looking for the closest Cron object's timestamp in the cron_upvotes array
     * @param {number} - timestamp 
     * @returns {number} - closest timestamp
     */
    getClosestTimestamp(timestamp) {

        var closest_cron = this.upvote_tasks.reduce((previous, current) => {

            var previous_timestamp = previous.cronTime.source.toDate().getTime();
            var current_timestamp = current.cronTime.source.toDate().getTime();

            var diff_previous = Math.abs(previous_timestamp - timestamp);
            var diff_current = Math.abs(current_timestamp - timestamp);

            if (diff_previous > diff_current) {
                return current;
            } else {
                return previous;
            }
        });

        return new Date(closest_cron.cronTime.source).getTime();
    }

    /**
     * Setting upvote modifier in relation to left Voting Power
     */
    setUpvoteModifier() {
        steem.api.getAccounts([this.account_name], (error, result) => {
            if (error) {
                logger.logError(error, 'UpvoteTasks.getUpvoteModifier: getAccounts');
            }

            let voting_power = result[0].voting_power;

            // Less then 20%
            if (voting_power > 0 && voting_power < 2000) {
                this.upvote_modifier = 0.1;
            }
            // 20 - 50%
            else if (voting_power >= 2000 && voting_power < 5000) {
                this.upvote_modifier = 0.35;
            }
            // 50 - 65%
            else if (voting_power >= 5000 && voting_power < 6500) {
                this.upvote_modifier = 0.6;
            } 
            // 65 - 80%
            else if (voting_power >= 6500 && voting_power < 8000) {
                this.upvote_modifier = 0.8
            }
            // 80 - 95%
            else if(voting_power >= 8000 && voting_power < 9500) {
                this.upvote_modifier = 1;
            }
            // 95 - 98%
            else if(voting_power >= 9500 && voting_power < 9800) {
                this.upvote_modifier = 2;
            }
            // 98 - 100%
            else {
                this.upvote_modifier = 3;
            }
        });
    }

    /**
     * Upvoting function
     * @param {string} account_name - Steem Blockchain account name
     * @param {string} permlink  - Steem Blockchain article permlink
     * @param {number} upvote_strength - 1-100% upvote strength
     */
    upvote(account_name, permlink, upvote_strength) {

        var real_upvote_strength = upvote_strength * this.upvote_modifier;
        if(real_upvote_strength > 100) {
            real_upvote_strength = 100;
        }

        steem.broadcast.vote(
            this.posting_key, // Voting account posting key 
            this.account_name, // Voting account name 
            account_name, // account whose permlink to be voted
            permlink, // permlink from account to be voted
            real_upvote_strength * 100, // Steem Blockchain use 1-10000, fe. 40(%) upvote * 100 = 4000 taking in account modifier
            (error, result) => {

                if (error) {
                    logger.logError(error, 'UpvoteTasks.upvote: vote');
                      
                    this.checkIfAlreadyUpvoted(account_name, permlink, (if_upvoted) => {
                        // If not upvoted set upvote task again; if already upvoted do nothing
                        if(!if_upvoted) {
                            var timestamp_to_fire = new Date().getTime() + 1000 * 60; // 60 seconds from now
                            this.setTask(timestamp_to_fire, account_name, permlink, upvote_strength, 'up');
                        }
                    });
                } 
                else {
                    logger.logArticleAction(account_name, permlink, 'upvoted');

                    this.finalizeUpvote(account_name, permlink, real_upvote_strength);
                }
            }
        );
    };

    /**
     * Updating database after upvote and deleting task from array
     * @param {string} account_name - Steem Blockchain account name
     * @param {string} permlink  - Steem Blockchain article permlink
     * @param {number} real_upvote_strength - 1-100%, final upvote strength after applying modifier
     */
    finalizeUpvote(account_name, permlink, real_upvote_strength) {
        this.connection.query('UPDATE `articles` SET `done` = 1, `done_when` = ?, `real_upvote_strength` = ? WHERE `account_name` = ? AND `permlink` = ?', [
                new Date().toISOString().slice(0, 19).replace('T', ' '),
                real_upvote_strength,
                account_name,
                permlink
            ],
            (error, results, fields) => {
                if(error) {
                    logger.logError(error, 'UpvoteTasks.finalizeUpvote: MySQL.UPDATE');
                } else {
                    logger.logArticleAction(account_name, permlink, 'updated in database after upvote');
                }
            }
        );

        this.deleteTask(account_name, permlink);
    }
    
    /**
     * Checking if given article from given author was already upvoted
     * @param {string} account_name - Steem Blockchain account name
     * @param {string} permlink  - Steem Blockchain article permlink
     * @param {function(boolean)} next - callback with true/false response
     */
    checkIfAlreadyUpvoted(account_name, permlink, next) {

        var if_upvoted = false;
        steem.api.getActiveVotes(account_name, permlink, (error, votes) => {
            if(error) {
                logger.logError(error, 'UpvoteTasks.checkIfAlreadyUpvoted: getActiveVotes');
            }
            else {
                votes.map((vote) => {
                    if(vote.voter == this.account_name){
                        if_upvoted = true;
                        return;
                    }
                });

                next(if_upvoted);
                return;
            }

            next(false);
        });
    }
}

module.exports = new UpvoteTasks();