var dns = require('dns'),
    winston = require('winston'),
    irc = require('./protocol');

function User(client, ircServer) {
    this.server = ircServer;
    this.config = ircServer.config;
    this.nick = null;
    this.username = null;
    this.realname = null;
    this.channels = [];
    this.quitMessage = 'Connection lost';
    this.disconnected = false;
    this.pendingAuth = false;
    this.passwordAccepted = false;
    this.lastPing = null;
    this.postAuthQueue = [];

    if (client) {
        this.client = client;
    }

    if (client && client.stream) {
        this.stream = client.stream;
        this.remoteAddress = client.stream.remoteAddress;
        this.hostname = client.stream.remoteAddress;

    }

    this.registered = false;
    this._modes = [];
    this.channelModes = {};
    this.serverName = '';
    this.created = new Date() / 1000;
    this.updated = new Date();
    this.isAway = false;
    this.awayMessage = null;

    this.serverOper = false;
    this.localOper = false;
    this.operLevel = 0;
    this.hopCount = 0;
    this.servertoken = null;

    this.hostLookup();
}

User.prototype = {
    get id() {
        return this.nick;
    },
    get whoCode() {
        return this.whoCode;
    },
    get mask() {
        return ':' + this.nick + '!' + this.username + '@' + this.hostname;
    },

    get modes() {
        return '+' + this._modes.join('');
    },

    set modes(modes) {
        if (modes) {
            modes = modes.replace(/^\+/, '');
            this._modes = modes.split('');
        }
    },
    get idle() {
        return parseInt(((new Date()) - this.updated) / 1000, 10);
    },
    get isService() {
        return this.modes.indexOf('a') !== -1;
    },
    get isOper() {
        return this.modes.indexOf('o') !== -1;
    },
    get isSupport() {
        return this.modes.indexOf('S') !== -1;
    },
    get isAdmin() {
        return this.modes.indexOf('A') !== -1;
    },
    get isNetAdmin() {
        return this.modes.indexOf('N') !== -1;
    },
    get isFullAdmin() {
        return this.modes.indexOf('X') !== -1;
    },
    get isLocalOper() {
        return this.modes.indexOf('O') !== -1;
    },
    get isInvisible() {
        return this.modes.indexOf('i') !== -1;
    },
    get isRegistered() {
        return this.modes.indexOf('x') !== -1;
    },

    send: function () {
        if (!this.stream) return;

        var self = this,
            message = arguments.length === 1 ?
                arguments[0]
                : Array.prototype.slice.call(arguments).join(' ');

        winston.log('S: [' + this.nick + '] ' + message);

        try {
            this.stream.write(message + '\r\n');
        } catch (exception) {
            winston.error('[' + this.nick + '] error writing to stream:', exception);

            // This setTimeout helps prevent against race conditions when multiple clients disconnect at the same time
            setTimeout(function () {
                if (!self.disconnected) {
                    self.disconnected = true;
                    self.server.disconnect(self);
                }
            }, 1);
        }
    },

    expandMask: function (mask) {
        return mask.replace(/\./g, '\\.').replace(/\*/g, '.*');
    },

    matchesMask: function (mask) {
        var parts = mask.match(/([^!]*)!([^@]*)@(.*)/) || [],
            matched = true,
            lastPart = parts.length < 4 ? parts.length : 4;
        parts = parts.slice(1, lastPart).map(this.expandMask);

        if (!this.nick.match(parts[0])) {
            return false;
        } else if (!this.username.match(parts[1])) {
            return false;
        } else if (!this.hostname.match(parts[2])) {
            return false;
        } else {
            return true;
        }
    },

    sharedChannelWith: function (targetUser) {
        var user = this,
            channels = targetUser.channels,
            matchedChannel;
        channels.some(function (channel) {
            if (user.channels.indexOf(channel) !== -1) {
                matchedChannel = channel;
                return true;
            }
        });

        return matchedChannel;
    },

    findChannelWhoCode: function (channel) {
        if (this.isAway == true) {
            return "G";
        } else if (this.isService) {
            return "S";
        } else if (this.isOper) {
            return "*";
        } else if (this.isOp(channel)) {
            return "@";
        } else if (this.isHop(channel)) {
            return "%";
        } else if (this.isVoiced(channel)) {
            return "+";
        } else {
            return "H";
        }
    },

    channelNick: function (channel) {
        if (this.isService) {
            return "&" + this.nick;
        } else if (this.isOper) {
            return "~" + this.nick;
        } else if (this.isOp(channel)) {
            return '@' + this.nick;
        } else if (this.isHop(channel)) {
            return '%' + this.nick;
        } else if (this.isVoiced(channel)) {
            return '+' + this.nick;
        } else {
            return this.nick;
        }

    },

    isOp: function (channel) {
        if (this.isOper || this.isService) {
            return true
        } else {
            if (this.channelModes[channel])
                return this.channelModes[channel].match(/o/);
        }
    },
    isChannelOper: function (channel) {
        if (this.isOper) {
            return true
        } else {
            if (this.channelModes[channel])
                return this.channelModes[channel].match(/a/);
        }
    },
    isChannelService: function (channel) {
        if (this.isService) {
            return true
        } else {
            if (this.channelModes[channel])
                return this.channelModes[channel].match(/A/);
        }
    },
    serviceOpChan: function (channel) {
        this.channelModes[channel] += 'A';
    },
    operChan: function (channel) {
        this.channelModes[channel] += 'a';
    },
    op: function (channel) {
        this.channelModes[channel] += 'o';

    },

    deop: function (channel) {
        if (this.channelModes[channel])
            this.channelModes[channel] = this.channelModes[channel].replace(/o/, '');
    },

    oper: function (level) {
        var modes = [];
        var self = this;
        if (level > -1) {
            modes.push('O');
        }
        if (level > 0) {
            modes.push('S');
        }
        if (level > 1) {
            modes.push('o');
        }
        if (level > 2) {
            modes.push('A');
        }
        if (level > 3) {
            modes.push('N');
        }
        if (level > 4) {
            modes.push('X');
        }
        var stringModes = '';
        modes.forEach(function(mode){
            if (!self.modes.match(mode)) {
                self._modes.push(mode);
               stringModes += mode;
                self.localOper = true;
            }
        });
        self.send(self.mask, 'MODE', self.nick, '+' + stringModes);
    },
    // TODO: Processing of +O
    localoper: function () {
        if (!this.modes.match(/O/)) {
            this._modes.push('O');
            this.send(this.mask, 'MODE', this.nick, '+O', this.nick);
            this.serverOper = true;
        }
    },
    service: function () {
        if (!this.modes.match(/a/)) {
            this._modes.push('a');
            this.send(this.mask, 'MODE', this.nick, '+a', this.nick);
            this.localOper = true;
        }
    },
    authRegister: function (vhost) {
        if (!this.modes.match(/x/)) {
            this._modes.push('x');
            this.send(this.mask, 'MODE', this.nick, '+x', this.nick);
        }
    },
    isHop: function (channel) {
        if (this.channelModes[channel])
            return this.channelModes[channel].match(/h/) || this.isOp(channel);
    },

    hop: function (channel) {
        this.channelModes[channel] += 'h';
    },

    dehop: function (channel) {
        if (this.channelModes[channel])
            this.channelModes[channel] = this.channelModes[channel].replace(/h/, '');
    },

    isVoiced: function (channel) {
        if (this.channelModes[channel])
            return this.channelModes[channel].match(/v/) || this.isHop(channel) || this.isOp(channel);
    },

    voice: function (channel) {
        this.channelModes[channel] += 'v';
    },

    devoice: function (channel) {
        if (this.channelModes[channel])
            this.channelModes[channel] = this.channelModes[channel].replace(/v/, '');
    },

    hostLookup: function () {
        if (!this.remoteAddress) return;
        var user = this;
        dns.reverse(this.remoteAddress, function (err, addresses) {
            user.realhostname = addresses && addresses.length > 0 ? addresses[0] : user.remoteAddress;
        });
        user.hostname = new Buffer(this.remoteAddress).toString('base64').toLowerCase().substr(0, 5) + this.config.clientvHost;
    },
    isKlined: function (ip) {
        try {
            if (this.config.klines[ip]) {
                if (this.config.klines[ip].isKlined === true) {
                    return true;
                } else {
                    return false;
                }
            } else {
                return false;
            }
        } catch (e) {
            winston.error(e);
        }

    },
    register: function () {
        if (this.registered === false
            && this.nick
            && this.username) {
            this.serverName = this.config.name;
            try {
                if (this.remoteAddress !== undefined && this.isKlined(this.remoteAddress)) {
                    this.send(this.server.host, 'NOTICE', this.nick, ':K-Lined (' + this.remoteAddress + ') by IRC Operator ' + this.config.klines[this.remoteAddress].oper + ' for reason: ' + this.config.klines[this.remoteAddress].reason);
                    this.server.disconnect(this);
                    return false;
                }
            } catch (e) {
                winston.error(e);
            }
            this.send(this.server.host, irc.reply.welcome, this.nick, ':Welcome to the ' + this.config.network + ' IRC network', this.mask);
            this.send(this.server.host, irc.reply.yourHost, this.nick, ':Your host is', this.config.hostname, 'running version', this.server.version);
            this.send(this.server.host, irc.reply.created, this.nick, ':This server was created on', this.server.created);
            this.send(this.server.host, irc.reply.myInfo, this.nick, ':' + this.server.name, this.server.version, 'OiwosaSANX', 'APaohpstrnmilbvk', 'Abklaohvb');
            this.send(this.server.host, irc.reply.myProtos, this.nick, 'PREFIX=(Aaohv)&~@%+ OWNERKEY NICKLEN=' + this.config.maxNickLength + ' CHANNELLEN=' + this.config.channelLength + ' TOPICLEN=' + this.config.topicLength + ' NETWORK=' + this.config.network + ' :are supported by this server');
            this.send(this.server.host, irc.reply.myProtos, this.nick, 'CHANTYPES=# :are supported by this server');

            this.server.motd(this);
            this.server.commands.LUSERS(this);
            this.registered = true;
            this.addMode.w.apply(this);
            this.addMode.s.apply(this);
        } else {
            this.send(this.server.host, irc.errors.alreadyRegistered, this.nick, ':You may not reregister');
        }
    },

    message: function (nick, message) {
        var user = this.server.users.find(nick);
        this.updated = new Date();

        if (user) {
            if (user.isAway) {
                this.send(this.server.host, irc.reply.away, this.nick, user.nick, ':' + user.awayMessage);
            }
            user.send(this.mask, 'PRIVMSG', user.nick, ':' + message);
        } else {
            this.send(this.server.host, irc.errors.noSuchNick, this.nick, nick, ':No such nick/channel');
        }
    },

    addModes: function (user, modes, arg) {
        var thisUser = this;
        modes.slice(1).split('').forEach(function (mode) {
            if (thisUser.addMode[mode])
                thisUser.addMode[mode].apply(thisUser, [user, arg]);
        });
    },

    addMode: {
        i: function (user, arg) {
            if (this === user) {
                if (!user.modes.match(/i/)) {
                    user._modes.push('i');
                    user.send(user.mask, 'MODE', this.nick, '+i');
                    if (this !== user) {
                        this.send(this.mask, 'MODE', this.nick, '+i');
                    }
                }
            } else {
                this.send(this.server.host, irc.errors.usersDoNotMatch, this.nick, user.nick, ':Cannot change mode for other users');
            }
        },
        s: function () {
            if (!this.modes.match(/s/)) {
                this._modes.push('s');
                this.send(this.mask, 'MODE', this.nick, '+s');
            }

        },
        w: function () {
            if (!this.modes.match(/w/)) {
                this._modes.push('w');
                this.send(this.mask, 'MODE', this.nick, '+w');
            }
        }
    },

    removeModes: function (user, modes, arg) {
        var thisUser = this;
        modes.slice(1).split('').forEach(function (mode) {
            if (thisUser.removeMode[mode])
                thisUser.removeMode[mode].apply(thisUser, [user, arg]);
        });
    },

    removeMode: {
        i: function (user, arg) {
            if (user.modes.match(/i/)) {
                user._modes.splice(user._modes.indexOf('i'), 1);
                user.send(user.mask, 'MODE', this.nick, '-i');
            }
        },
        s: function (user) {
            if (this.modes.match(/s/)) {
                user._modes.splice(user._modes.indexOf('s'), 1);
                this.send(this.mask, 'MODE', this.nick, '-s');
            }
        },
        w: function (user) {
            if (this.modes.match(/w/)) {
                user._modes.splice(user._modes.indexOf('w'), 1);
                this.send(this.mask, 'MODE', this.nick, '-w');
            }
        }

    },

    queue: function (message) {
        this.postAuthQueue.push(message);
    },

    runPostAuthQueue: function () {
        if (!this.passwordAccepted) return;

        var self = this;

        this.postAuthQueue.forEach(function (message) {
            self.server.respondToMessage(self, message);
        });
    },
    hasTimedOut: function () {
        return this.lastPing && (Math.floor((Date.now() - this.lastPing) / 1000) > (this.config.pingTimeout || this.config.idleTimeout));
    },

    closeStream: function () {
        if (this.stream && this.stream.end) {
            this.stream.end();
        }
    },

    quit: function (message) {
        this.quitMessage = message;
        this.closeStream();
    }
};

exports.User = User;
