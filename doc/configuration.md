# Configuring ircd.js

This is what a configuration file looks like:
```javascript
{
  "network": "ircdjs-six",
  "hostname": "alpha.ircdjs-six.com",
  "serverDescription": "A Node IRC daemon",
  "serverName": "alpha.ircdjs-six.com",
  "port": 6667,
  "linkPort": 7777,
  "diePasswd": "29djs=-2*291jsn1&*@",
  "whoWasLimit": 10000,
  "token": 1,
  "topicLength": 390,
  "channelLength": 50,
  "pingTimeout": 120,
  "maxNickLength": 30,
  "maxConnections": 1000,
  "maxLinks": 100,
  "adminLoc1": "Location 1",
  "adminLoc2": "New York",
  "adminEmail": "admin@admin.com",
  "clientvHost": ".user.network",
  "links": {
    "server2": {
      "active": true,
      "host": "127.0.0.1",
      "password": "$2a$10$T1UJYlinVUGHqfInKSZQz./CHrYIVVqbDO3N1fRNEUvFvSEcshNdC",
      "port": 7778,
      "token": 2
    }
  },
  "opers": {
    "admin": {
      "allowedHost": "*",
      "password": "$2a$10$lBiMkwM8G8Pk9yc26aLj3eGSQegPA4HKStkCf958zNTk2FM/2cWOe",
      "vhost": "oper.staff.network",
      "operLevel": 5
    }
  },
  "channels": {
    "channel1": {
      "topic": "First Channel"
    },
    "channel2": {
      "topic": "Second Channel"
    }
  },
  "klines": {
    "99.192.21.3": {
      "isKlined": true,
      "reason": "This is a test k-line",
      "removalTime": "182817281",
      "oper": "Json",
      "nickName": "dude",
      "mask": "dude!blah@thesd.users.chatnetwork"
    }
  }
}
```

* `network`: The name of your IRC network
* `hostname`: The hostname for your server
* `serverDescription`: A textual description of the server
* `serverName`: The name of the server
* `port`: The port the server should listen on
* `whoWasLimit`: The number of `WHOWAS` records to store in memory
* `opers`: A list of operators with bcrypted passwords (the `pwgen.js` script can encrypt passwords for you)
* `channels`: A list of channels that are created on startup.
* `links`: This is for other server links and can be ignored for now

## Configuration File Locations

These are the current configuration search paths:

* `/etc/ircdjs/config.json`
* `./config/config.json` (inside the source path)

## TLS

if `config.key` and `config.cert` is provided it will start a tls-server.

`config.{key,cert}` have to be paths to the key-files.
