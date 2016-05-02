//
// ::::::::::..     .,-::::::::::::-.         ....:::::: .::::::.
// ;;;;;;;``;;;;  ,;;;'````' ;;,   `';,    ;;;;;;;;;````;;;`    `
// [[[ [[[,/[[['  [[[        `[[     [[    ''`  `[[.    '[==/[[[[,
// $$$ $$$$$$c    $$$         $$,    $$   ,,,    `$$      '''    $
// 888 888b "88bo,`88bo,__,o, 888_,o8P'd8b888boood88     88b    dP
// MMM MMMM   "W"   "YUMMMMMP"MMMMP"`  YMP"MMMMMMMM"      "YMmMY"
//
//                                            A Node.JS IRC Server
// ircd.js
// IRCD.js By Alex Young
// IRCDjs-six Extension by Kyle Rambeau
// libs:
// http://github.com/pgte/carrier

// rfcs:
// http://www.networksorcery.com/enp/rfc/rfc2812.txt
// http://tools.ietf.org/html/rfc1459
//
// spells out some stuff the RFC was light on:
// http://docs.dal.net/docs/misc.html#5

var net = require('net'),
    tls = require('tls'),
    carrier = require('carrier'),
    fs = require('fs'),
    readline = require('readline'),
    lr = require('line-reader'),
    irc = require('./protocol'),
    path = require('path'),
    assert = require('assert'),
    Channel = require('./channel').Channel,
    User = require('./user').User,
    History = require('./storage').History,
    ChannelDatabase = require('./storage').ChannelDatabase,
    UserDatabase = require('./storage').UserDatabase,
    LinkServer = require('./linkserver').LinkServer,
    ServerCommands = require('./commands'),
    winston = require('winston'),
    commander = require('commander'),
    exists = fs.exists || path.exists // 0.8 moved exists to fs
    ;
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {
    colorize: true,
    prettyPrint: true
});
function AbstractConnection(stream) {
    this.stream = stream;
    this.object = null;

    this.__defineGetter__('id', function () {
        return this.object ? this.object.id : 'Unregistered';
    });
}

function Server() {
    this.history = new History(this);
    this.users = new UserDatabase(this);
    this.channels = new ChannelDatabase(this);
    this.config = null;
    this.servers = null;
    this.commands = new ServerCommands(this, this.servers);
    this.startupTime = new Date();
    this.linkServer = new LinkServer(this);

}

Server.boot = function () {
    var server = new Server();

    server.file = server.cliParse();

    server.loadConfig(function () {
        server.start();
        server.createDefaultChannels();
    });

    process.on('SIGHUP', function () {
        winston.info('Reloading config...');
        server.loadConfig();
    });

    process.on('SIGTERM', function () {
        winston.info('Exiting...');
        server.close();
    });
};

Server.prototype = {
    version: 'v-0.0.75-six',
    created: '2016-03-21',
    debug: false,
    get name() {
        return this.config.serverName;
    },
    get info() {
        return this.config.serverDescription;
    },
    get token() {
        return this.config.token;
    },
    get host() {
        return ':' + this.config.hostname;
    },
    get numChannels() {
        return Object.keys(this.channels.registered).length;
    },
    cliParse: function () {
        var file = null;

        commander.option('-f --file [file]', 'Configuration file (Defaults: /etc/ircdjs/config.json or ../config/config.json)')
            .parse(process.argv);
        // When the -f switch is passwd without a parameter, commander.js evaluates it to true.
        if (commander.file && commander.file !== true) file = commander.file;
        return file;
    },
    reloadConfig: function (user) {
        var server = this,
            paths = [
                path.join('/', 'etc', 'ircdjs', 'config.json'),
                path.join(__dirname, '..', 'config', 'config.json')
            ], oldConfig = this.server.config;

        this.config = null;
        if (server.file) paths.unshift(server.file);

        paths.forEach(function (name) {
            exists(name, function (exists) {
                if (!exists || server.config) return;
                try {

                    server.config = JSON.parse(fs.readFileSync(name).toString());
                    server.config.idleTimeout = server.config.idleTimeout || 60;
                    winston.info('[Server] - Configuration reloaded');
                    user.send(this.host, irc.reply.reHashing, user.nick, ":Configuration has been reloaded.");

                } catch (exception) {
                    user.send(this.host, irc.reply.reHashing, user.nick, ":Reloading failed: " + exception);
                    winston.error('[Server] Could not reload config! Rolling back...', exception);
                    server.config = oldConfig; //TODO doesnt old load config dafunk
                }
            });
        });
    },
    loadConfig: function (fn) {
        var server = this,
            paths = [
                path.join('/', 'etc', 'ircdjs', 'config.json'),
                path.join(__dirname, '..', 'config', 'config.json')
            ];

        this.config = null;
        if (server.file) paths.unshift(server.file);

        paths.forEach(function (name) {
            exists(name, function (exists) {
                if (!exists || server.config) return;
                try {
                    server.config = JSON.parse(fs.readFileSync(name).toString());
                    server.config.idleTimeout = server.config.idleTimeout || 60;
                    winston.info('IRCn Server ' + server.version);
                    winston.info(' ');

                    winston.info('[Server] Starting IRC Server with Config file: ' + name);
                    if (fn) fn();
                } catch (exception) {
                    winston.error('[Server] Please ensure you have a valid config file.', exception);
                }
            });
        });
    },

    normalizeName: function (name) {
        return name &&
            name.toLowerCase()
                .replace(/{/g, '[')
                .replace(/}/g, ']')
                .replace(/\|/g, '\\')
                .trim();
    },

    isValidPositiveInteger: function (str) {
        var n = ~~Number(str);
        return String(n) === str && n >= 0;
    },

    valueExists: function (value, collection, field) {
        var self = this;
        value = this.normalizeName(value);
        return collection.some(function (u) {
            return self.normalizeName(u[field]) === value;
        })
    },

    //We are only accepting channels with # in the name
    channelTarget: function (target) {
        var prefix = target[0];
        var channelPrefixes = ['#'];
        return (channelPrefixes.indexOf(prefix) !== -1);
    },

    parse: function (data) {
        var parts = data.trim().split(/ :/),
            args = parts[0].split(' ');

        parts = [parts.shift(), parts.join(' :')];

        if (parts.length > 0) {
            args.push(parts[1]);
        }

        if (data.match(/^:/)) {
            args[1] = args.splice(0, 1, args[1]);
            args[1] = (args[1] + '').replace(/^:/, '');
        }

        return {
            command: args[0].toUpperCase(),
            args: args.slice(1)
        };
    },

    respondToMessage: function (user, message) {
        this.commands[message.command].apply(this.commands, [user].concat(message.args));
    },

    respond: function (data, client) {
        var message = this.parse(data);

        if (this.validCommand(message.command)) {
            if (this.config.serverPassword && !client.object.passwordAccepted) {
                this.queueResponse(client, message);
            } else {
                this.respondToMessage(client.object, message);
            }
        }
    },

    getInfo: function (user) {
        var self = this;
        try {
            lr.eachLine('./config/info.txt', function (line, last) {
                user.send(self.host, irc.reply.showInfo, user.nick, ':' + line);
                if (last) {
                    user.send(self.host, irc.reply.endInfo, user.nick, ":End of /INFO list");
                }
            });
        } catch (e) {
            winston.error(e);
            user.send(self.host, irc.reply.showInfo, user.nick, ':No text to send.');
            user.send(self.host, irc.reply.endInfo, user.nick, ":End of /INFO list");


        }

    },
    queueResponse: function (client, message) {
        if ('PASS' === message.command) {
            // Respond now
            client.object.pendingAuth = false;
            this.respondToMessage(client.object, message);
        } else {
            client.object.queue(message);
        }
    },

    validCommand: function (command) {
        return this.commands[command];
    },

    createDefaultChannels: function () {
        var self = this;
        if (this.config.channels) {
            Object.keys(this.config.channels).forEach(function (channel) {
                var channelName = '';
                if (!self.channelTarget(channel)) {
                    channelName = "#" + channel;
                } else {
                    channelName = channel;
                }
                var newChannel = self.channels.registered[self.normalizeName(channelName)] = new Channel(channelName, self);
                newChannel.topic = self.config.channels[channel].topic;
            });
        }
    },

    motd: function (user) {
        var self = this;
        user.send(this.host, irc.reply.motdStart, user.nick, ':- ' + this.name + ' Message of the day -');
        try {
            lr.eachLine('./config/motd.txt', function (line, last) {
                user.send(self.host, irc.reply.motd, user.nick, ' :' + line);
                if (last) {
                    user.send(self.host, irc.reply.motdEnd, user.nick, ':End of /MOTD command');
                }
            });
        } catch (e) {
            user.send(this.host, irc.errors.noMotd, user.nick, ' :MOTD File is missing');
            winston.error(e);
        }


    },

    startTimeoutHandler: function () {
        var self = this;
        var timeout = this.config.pingTimeout || 10;
        this.timeoutHandler = setInterval(function () {
            self.users.forEach(function (user) {
                if (user.hasTimedOut()) {
                    winston.info('User timed out:', user.mask);
                    self.disconnect(user);
                } else {
                    // TODO: If no other activity is detected
                    user.send('PING', self.config.hostname, self.host);
                }
            });
        }, timeout * 1000);
    },

    stopTimeoutHandler: function () {
        clearInterval(this.timeoutHandler);
    },

    start: function (callback) {
        var server = this, key, cert, options;
        if (this.config.key && this.config.cert) {
            try {
                key = fs.readFileSync(this.config.key);
                cert = fs.readFileSync(this.config.cert);
            } catch (exception) {
                winston.error('Fatal error:', exception);
            }
            options = {key: key, cert: cert};
            this.server = tls.createServer(options, handleStream);
        } else {
            this.server = net.createServer(handleStream);
        }
        this.server.maxConnections = this.config.maxConnections;
        assert.ok(callback === undefined || typeof callback == 'function');
        this.server.listen(this.config.port, callback);
        function handleStream(stream) {
            try {
                var carry = carrier.carry(stream),
                    client = new AbstractConnection(stream);

                client.object = new User(client, server);
                if (server.config.serverPassword) {
                    client.object.pendingAuth = true;
                }

                stream.on('end', function () {
                    server.end(client);
                });
                stream.on('error', winston.error);
                carry.on('line', function (line) {
                    server.data(client, line);
                });
            } catch (exception) {
                winston.error('Fatal error:', exception);
            }
        }
    },

    close: function (callback) {
        if (callback !== undefined) {
            assert.ok(typeof callback === 'function');
            this.server.once('close', callback);
        }
        this.stopTimeoutHandler();
        this.server.serviceProc.close();
        WSRC.close();
        this.server.close();
    },

    end: function (client) {
        var user = client.object;

        if (user) {
            this.disconnect(user);
        }
    },

    disconnect: function (user) {
        user.channels.forEach(function (channel) {
            channel.users.forEach(function (channelUser) {
                if (channelUser !== user) {
                    channelUser.send(user.mask, 'QUIT', ':' + user.quitMessage);
                }
            });

            channel.users.splice(channel.users.indexOf(user), 1);
        });

        user.closeStream();
        this.users.remove(user);
        user = null;
    },

    data: function (client, line) {
        line = line.slice(0, 512);
        //winston.info('[Server] - [' + this.name + ', C: ' + client.id + '] ' + line);
        this.respond(line, client);
    }
};

exports.Server = Server;
exports.winston = winston;

if (!module.parent) {
    Server.boot();

}
