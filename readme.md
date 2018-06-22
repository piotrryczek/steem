# SteemBot

SteemBot is Bot for the Steem Blockchain in order to upvote articles published by desired users with designated power. It is also possible to define other bots to look for if they are also upvoting posts from the same users so SteemBot can upvote couple seconds before them. Bot is taking into account Steem Blockchain limits like:
* Article can be upvoted after maximum 6.5 days publishing it
* Cannot upvote more often than every 3 seconds
* Best curation reward appear in 30 minute after publishing post

## Built With

* [Steem.js](https://github.com/steemit/steem-js/) - Library to connect to the Steem API node
* [node-cron](https://github.com/kelektiv/node-cron/) - CRON support
* [mysql](https://github.com/mysqljs/mysql/) - MySQL support

## Author

* **Piotr Ryczek**