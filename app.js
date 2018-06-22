const express = require('express');

// scanUsers: every 5 minutes: 0 */5 * * * *
// scanBots: every 24 hours: 0 0 0 * * *
// scanRewards: every 6 hours: 0 0 */6 * * *
const SteemBot = require('./steembot')({
    scan_users_interval: '0 */5 * * * *',
    scan_bots_interval: '0 0 0 * * *',
    redeem_rewards_interval: '0 0 */6 * * *'
}, () => {});

const app = express();

module.exports = app;