var irc = require('./protocol'),
    ircd = require(__dirname + '/../lib/ircd');

function Commands(server, servers) {
    this.server = server;
    this.servers = servers;
}

Commands.prototype = {
    CONNECT: function (user, targetServer, port, remoteServer) {
        // ERR_NOSUCHSERVER
        // ERR_NEEDMOREPARAMS
        if (!user.isOper) {
            user.send(this.server.host, irc.errors.noPrivileges, ":Permission Denied- You're not an IRC operator");
        } else {
            if (!targetServer) {
                user.send(this.server.host, irc.errors.needMoreParams, ':Please specify a target server');
            } else {
                this.servers.connect(targetServer);
            }
        }
    },
    SERVICE: function (user, botNick, ident, password) {
        if (!botNick || !ident || !password || !this.server.config.services[ident] || this.server.config.services[ident].pword !== password || this.server.config.services[ident].allowedHost !== user.remoteAddress) {
            user.send(this.server.host, irc.errors.noPrivileges, ":Permission Denied- You're not an IRC operator");
        } else {
            user.service();
            user.hostname = this.server.config.services[ident].vhost;
        }
    },
    PONG: function (user, hostname) {
        user.lastPing = Date.now();
    },

    PING: function (user, hostname) {
        user.lastPing = Date.now();
        user.send(this.server.host, 'PONG', this.server.config.hostname, this.server.host);
    },
    WSRC: function (user, ip) {

        if (user.isKlined(ip)) {
            user.send(this.server.host, 'NOTICE', user.nick, ':K-Lined (' + ip + ') by IRC Operator ' + this.server.config.klines[ip].oper + ' for reason: ' + this.server.config.klines[ip].reason);
            this.server.disconnect(user);
        } else {
            user.remoteAddress = ip.trim();
            user.hostname = ip.trim();
            user.hostLookup();
            user.send(this.server.host, irc.reply.newHostName, user.nick, ':Your host is now ' + user.hostname);
        }


    },
    PASS: function (user, password) {
        var self = this.server;
        ircd.compareHash(password, self.config.serverPassword, function (err, res) {
            if (res) {
                user.passwordAccepted = true;
                user.server = self;
                user.runPostAuthQueue();
            } else {
                user.send(self.host, irc.errors.passwordWrong, user.nick || 'user', ':Password incorrect');
                user.quit();
            }
        });
    },
    ADMIN: function (user, server) {
        //TODO: ERR_NOSUCHSERVER
        if (!this.server.config.adminLoc1 && !this.server.config.adminLoc2 && !this.server.config.adminEmail) {
            user.send(this.server.host, irc.error.noAdminInfo, user.nick, ':No administrative info available');
        } else {
            user.send(this.server.host, irc.reply.adminMe, user.nick, ':Administrative info about ' + this.server.name);
            user.send(this.server.host, irc.reply.adminLoc1, user.nick, ':' + this.server.config.adminLoc1);
            user.send(this.server.host, irc.reply.adminLoc2, user.nick, ':' + this.server.config.adminLoc2);
            user.send(this.server.host, irc.reply.adminEmail, user.nick, ':' + this.server.config.adminEmail);
        }
    },
    AWAY: function (user, message) {
        if (user.isAway && (!message || message.length === 0)) {
            user.isAway = false;
            user.awayMessage = null;
            user.send(this.server.host, irc.reply.unaway, user.nick, ':You are no longer marked as being away');
        } else if (message && message.length > 0) {
            user.isAway = true;
            user.awayMessage = message;
            user.send(this.server.host, irc.reply.nowAway, user.nick, ':You have been marked as being away');
        } else {
            user.send(this.server.host, irc.errors.needMoreParams, user.nick, ':Need more parameters');
        }
    },

    VERSION: function (user, server) {
        // TODO: server
        user.send(this.server.host,
            irc.reply.version,
            user.nick,
            this.server.version + '.' + (this.server.debug ? 'debug' : ''),
            this.server.config.hostname, ':' + this.server.config.network);
    },

    TIME: function (user, server) {
        // TODO: server
        user.send(this.server.host, irc.reply.time, user.nick, this.server.config.hostname, ':' + (new Date()));
    },

    NICK: function (user, nick) {
        var oldMask = user.mask;
        var oldNick = user.nick;
        if (!nick || nick.length === 0) {
            return user.send(this.server.host, irc.errors.noNickGiven, ':No nickname given');
        } else if (nick === user.nick) {
            return;
        } else if (nick.length > (this.server.config.maxNickLength || 9) || nick.match(irc.validations.invalidNick)) {
            return user.send(this.server.host, irc.errors.badNick, (user.nick || ''), nick, ':Erroneus nickname');
        } else if (this.server.valueExists(nick, this.server.users.registered, 'nick')) {
            return user.send(this.server.host, irc.errors.nameInUse, '*', nick, ':is already in use');
        }
        nick = nick.trim();
        user.send(user.mask, 'NICK', ':' + nick.trim());

        user.channels.forEach(function (channel) {
            channel.users.forEach(function (channeluser) {
                if (channeluser.nick != oldNick) {
                    channeluser.send(user.mask + ' NICK :' + nick);
                }
            });
        });

        user.nick = nick.trim();
        user.register();

    },

    USER: function (user, username, hostname, servername, realname) {
        this.server.users.register(user, username, hostname, servername, realname);
    },
    OWNERKEY: function (user, channelName, ownerKey) {
        var channel = this.server.channels.find(channelName);
        if (!channelName || !ownerKey || ownerKey != channel.ownerKey) {
            return user.send(this.server.host, irc.errors.needMoreParams, user.nick, ':Need more parameters');
        } else {

            user.op(channel);
            channel.send(user.mask, 'MODE', channelName, '+o', user.nick);
        }

    },
    JOIN: function (user, channelNames, key) {
        var server = this.server;
        if (!channelNames || !channelNames.length) {
            return user.send(this.server.host, irc.errors.needMoreParams, user.nick, ':Need more parameters');
        }

        channelNames.split(',').forEach(function (args) {
            var nameParts = args.split(' '),
                channelName = nameParts[0];

            if (!server.channelTarget(channelName)
                || channelName.match(irc.validations.invalidChannel)) {
                user.send(server.host, irc.errors.noSuchChannel, ':No such channel');
            } else {
                server.channels.join(user, channelName, key);
            }
        });
    },

    // TODO: this.server can accept multiple channels according to the spec
    PART: function (user, channelName, partMessage) {
        var channel = this.server.channels.find(channelName);
        if (channel && user.channels.indexOf(channel) !== -1) {
            partMessage = partMessage ? ' :' + partMessage : '';
            channel.send(user.mask, 'PART', channelName + partMessage);
            channel.part(user);
            if (channel.users.length === 0 && !channel.isPersistent && !channel.isRegistered) {
                this.server.channels.remove(channel);
            }
        }
    },

    KICK: function (user, channels, users, kickMessage) {
        var channelMasks = channels.split(','),
            userNames = users.split(','),
            server = this.server;

        kickMessage = kickMessage ? ':' + kickMessage : ':' + user.nick;

        // ERR_BADCHANMASK

        if (userNames.length !== channelMasks.length) {
            user.send(this.server.host, irc.errors.needMoreParams, user.nick, ':Need more parameters');
        } else {
            channelMasks.forEach(function (channelMask, i) {
                var channel = server.channels.findWithMask(channelMask),
                    userName = userNames[i],
                    targetUser;

                if (!channel) {
                    user.send(server.host, irc.errors.noSuchChannel, ':No such channel');
                    return;
                }

                targetUser = channel.findUserNamed(userName);

                if (!channel.findUserNamed(user.nick)) {
                    user.send(server.host, irc.errors.notOnChannel, user.nick, channel.name, ':Not on channel');
                } else if (!targetUser) {
                    user.send(server.host, irc.errors.userNotInChannel, userName, channel.name, ':User not in channel');
                } else if (!user.isOp(channel)) {
                    user.send(server.host, irc.errors.channelOpsReq, user.nick, channel.name, ":You're not channel operator");
                } else if (targetUser.isOper && !user.isService || targetUser.isService) {
                    user.send(server.host, irc.errors.noPrivileges, user.nick, channel.name, ":Permission Denied- You're not an IRC operator");
                } else {
                    channel.send(user.mask, 'KICK', channel.name, targetUser.nick, kickMessage);
                    channel.part(targetUser);
                }
            });
        }
    },

    TOPIC: function (user, channelName, topic) {
        var channel = this.server.channels.find(channelName);

        if (!channel) {
            user.send(this.server.host, irc.errors.noSuchNick, user.nick, channelName, ':No such nick/channel');
        } else if (topic.length > this.server.config.topicLength) {
            user.send(this.server.host, irc.errors.needMoreParams, user.nick, channel.name, ":Channel topics have to be less then or equal to " + this.server.config.topicLength);

        } else {
            if (channel.modes.indexOf('t') === -1 || user.isHop(channel)) {
                channel.topic = topic;
                channel.send(user.mask, 'TOPIC', channel.name, ':' + topic);
            } else {
                user.send(this.server.host, irc.errors.channelOpsReq, user.nick, channel.name, ":You must be at least half-op to do that!");
            }
        }
    },
    STATS: function (user, query, server) {
        // TODO: remote server
        query = query.toUpperCase();
        var self = this;

        var queryCommands = {
            endStats: function () {
                user.send(self.server.host, irc.reply.statsEnd, user.nick, query + " :End of /STATS report");

            },
            C: function () {
                var serverLinks = Object.keys(self.server.config.links);
                var lastLinkNum = serverLinks.length - 1;
                var parent = this;
                if (serverLinks.length > 0) {
                    for (i = 0, end = serverLinks.length; i < end; i++) {
                        var linkName = serverLinks[i], linkData = self.server.config.links[linkName];
                        user.send(self.server.host, irc.reply.statsC, user.nick, "C " + linkData.host + " * " + linkName + " " + linkData.port + " " + linkData.token);
                        if (i === lastLinkNum) {
                           queryCommands.endStats();
                        }
                    }
                } else {
                    this.endStats();
                }
            },
            U: function() {
                now = new Date();
                difference = now.getTime() - self.server.startupTime.getTime();
                var daysOld = Math.ceil(difference / (1000 * 3600 * 24));
                var hoursOld=Math.floor((difference%(60*60*1000*24))/(60*60*1000));
                var minsOld=Math.floor(((difference%(60*60*1000*24))%(60*60*1000))/(60*1000));
                var secsOld=Math.floor((((difference%(60*60*1000*24))%(60*60*1000))%(60*1000))/1000);
                user.send(self.server.host, irc.reply.statsUptime, user.nick, ':Server up ' + (daysOld - 1) + ' days, ' + hoursOld + ':' + minsOld + ':' + secsOld);
                queryCommands.endStats();
            }
        };
        if(!query){
            user.send(self.server.host, irc.errors.needMoreParams, user.nick, 'STATS :Not enough parameters');
        } else if(!(query in queryCommands)){
            queryCommands.endStats();
        } else {
            queryCommands[query].call();
        }
    },
    REHASH: function (user) {
        if (user.isFullAdmin || user.isService) {
            user.send(this.server.host, irc.reply.reHashing, user.nick, ":Reloading server configuration file...");
            this.server.reloadConfig(user);
        } else {
            user.send(this.server.host, irc.errors.noPrivileges, user.nick, ":Permission Denied- You're not an IRC administrator");
        }
    },
    KILL: function (user, target, comment) {
        if (!comment) {
            comment = '(Killed): No reason given';
        } else {
            comment = '(Killed): ' + comment;
        }
        if (user.isOper || user.isService) {
            if (!target) {
                user.send(this.server.host, irc.errors.needMoreParams, user.nick, ':KILL :Not enough parameters');
            } else {
                var targetUser = this.server.users.find(target);
                if (targetUser) {
                    this.WALLOPS(user, 'Received KILL from IRC Operator ' + user.nick + ' for ' + target + ' (' + comment + ')');
                    targetUser.quit(comment);
                } else {
                    user.send(this.server.host, irc.errors.noSuchNick, user.nick, ':' + target + ' :No such nick/channel');
                }
            }
        } else {
            user.send(this.server.host, irc.errors.noPrivileges, user.nick, ":Permission Denied- You're not an IRC operator");
        }

    },
    // TODO: The RFC says the sender nick and actual user nick should be checked
    // TODO: Message validation
    PRIVMSG: function (user, target, message) {
        // ERR_NOTOPLEVEL
        // ERR_WILDTOPLEVEL
        // ERR_TOOMANYTARGETS
        // ERR_NOSUCHNICK
        // ERR_NOTONCHANNEL
        // RPL_AWAY
        if (!target || target.length === 0) {
            user.send(this.server.host, irc.errors.noRecipient, ':No recipient given');
        } else if (!message || message.length === 0) {
            user.send(this.server.host, irc.errors.noTextToSend, ':No text to send');
        } else if (this.server.channelTarget(target)) {
            var channel = this.server.channels.find(target);
            if (!channel) {
                user.send(this.server.host, irc.errors.noSuchNick, user.nick, target, ':No such nick/channel');
            } else if (channel.isModerated && !user.isVoiced(channel)) {
                user.send(this.server.host, irc.errors.cannotSend, channel.name, ':Cannot send to channel');
            } else if (user.channels.indexOf(channel) === -1) {
                if (channel.modes.indexOf('n') !== -1) {
                    user.send(this.server.host, irc.errors.cannotSend, channel.name, ':Cannot send to channel');
                    return;
                }
            } else {
                this.server.channels.message(user, channel, message);
            }
        } else {
            user.message(target, message);
        }
    },
    NOTICE: function (user, target, message) {
        var targetUser = this.server.users.find(target);
        if (!message) {
            user.send(this.server.host, irc.errors.noTextToSend, ':No text to send');
            return;
        } else if (!targetUser) {
            user.send(this.server.host, irc.errors.noSuchNick, user.nick, ':No such nick');
            return;
        } else if (targetUser.modes.indexOf('s') !== -1) {
            targetUser.send(user.mask, 'NOTICE', targetUser.nick, ':' + message);
            return;
        } else {
            user.send(this.server.host, irc.errors.noSuchNick, user.nick, ':No such nick');
            return;
        }

    },
    INVITE: function (user, nick, channelName) {
        var channel = this.server.channels.find(channelName),
            targetUser = this.server.users.find(nick);

        // TODO: Can this.server accept multiple channel names?
        // TODO: ERR_NOTONCHANNEL
        if (!targetUser) {
            user.send(this.server.host, irc.errors.noSuchNick, user.nick, nick, ':No such nick/channel');
            return;
        } else if (channel) {
            if (channel.isInviteOnly && !user.isOp(channel)) {
                user.send(this.server.host, irc.errors.channelOpsReq, user.nick, channel.name, ":You're not channel operator");
                return;
            } else if (channel.onInviteList(targetUser)) {
                user.send(this.server.host, irc.errors.userOnChannel, user.nick, targetUser.nick, ':User is already on that channel');
                return;
            }
        } else if (!this.server.channelTarget(channelName)) {
            // Invalid channel
            return;
        } else {
            // TODO: Make this.server a register function
            // Create the channel
            channel = this.server.channels.registered[this.server.normalizeName(channelName)] = new Channel(channelName, this.server);
        }

        user.send(this.server.host, irc.reply.inviting, user.nick, targetUser.nick, channelName);
        targetUser.send(user.mask, 'INVITE', targetUser.nick, ':' + channelName);

        // TODO: How does an invite list get cleared?
        channel.inviteList.push(targetUser.nick);
    },

    MODE: function (user, target, modes, arg) {
        // TODO: This should work with multiple parameters, like the definition:
        // <channel> {[+|-]a|o|h|p|s|i|t|n|b|v} [<limit>] [<user>] [<ban mask>]
        // a - granted to ircOps when joining a channel                [done]
        // o - give/take channel operator privileges                   [done]
        // p - private channel flag                                    [done]
        // P - Persistent channel;                                     [done]
        // s - secret channel flag;                                    [done]
        // r - registered flag (services)                              [done]
        // i - invite-only channel flag;                               [done]
        // t - topic settable by channel operator only flag;           [done]
        // n - no messages to channel from clients on the outside;     [done]
        // m - moderated channel;                                      [done]
        // l - set the user limit to channel;                          [done]
        // b - set a ban mask to keep users out;                       [done]
        // v - give/take the ability to speak on a moderated channel;  [done]
        // k - set a channel key (password).                           [done]

        // User modes
        // a - network service;                                        [done]
        // i - marks a users as invisible;                             [done]
        // w - user receives wallops;                                  [done]
        // r - restricted user connection;
        // o - operator flag;
        // O - local operator flag;
        // s - marks a user for receipt of server notices.             [done]
        var server = this.server;

        if (this.server.channelTarget(target)) {
            var channel = this.server.channels.find(target);
            if (!channel) {
                // TODO: Error
            } else if (modes) {
                if (modes === '+b') {
                    channel.banned.forEach(function (ban) {
                        user.send(server.host, irc.reply.banList, user.nick, channel.name, ban.mask, ban.user.nick, ban.timestamp);
                    });
                    user.send(this.server.host, irc.reply.endBan, user.nick, channel.name, ':End of Channel Ban List');
                }
                if (modes[0] === '+') {
                    channel.addModes(user, modes, arg);
                } else if (modes[0] === '-') {
                    channel.removeModes(user, modes, arg);
                }
            } else {
                user.send(this.server.host, irc.reply.channelModes, user.nick, channel.name, channel.modes);
            }
        } else {
            // TODO: Server user modes

            var targetUser = this.server.users.find(target);
            if (targetUser) {
                if (targetUser === user) {
                    if (modes[0] === '+') {
                        targetUser.addModes(user, modes, arg);
                    } else if (modes[0] === '-') {
                        targetUser.removeModes(user, modes, arg);
                    }
                } else {
                    user.send(this.server.host, irc.errors.usersDoNotMatch, user.nick, ':Cannot change mode for other users');

                }
            }
        }
    },

    LIST: function (user, targets) {
        // TODO: ERR_TOOMANYMATCHES
        // TODO: ERR_NOSUCHSERVER
        var server = this.server,
            channels = {};
        user.send(this.server.host, irc.reply.listStart, user.nick, 'Channel', ':Users  Name');
        if (targets) {
            targets = targets.split(',');
            targets.forEach(function (target) {
                var channel = server.channels.find(target);
                if (channel) {
                    channels[channel.name] = channel;
                }
            });
        } else {
            channels = this.server.channels.registered;
        }

        for (var i in channels) {
            var channel = channels[i];
            // if channel is secret or private, ignore
            if (channel.isPublic || channel.isMember(user)) {
                user.send(this.server.host, irc.reply.list, user.nick, channel.name, channel.memberCount, ':[' + channel.modes + '] ' + channel.topic);
            }
        }

        user.send(this.server.host, irc.reply.listEnd, user.nick, ':End of /LIST');
    },

    // TODO: LIST
    NAMES: function (user, targets) {
        var server = this.server;
        if (targets) {
            targets = targets.split(',');
            targets.forEach(function (target) {
                // if channel is secret or private, ignore
                var channel = server.channels.find(target);
                if (channel && (channel.isPublic || channel.isMember(user))) {
                    user.send(server.host, irc.reply.nameReply, user.nick, channel.type, channel.name, ':' + channel.names);
                }
            });
        }
        user.send(this.server.host, irc.reply.endNames, user.nick, '*', ':End of /NAMES list.');
    },

    WHO: function (user, target) {
        var server = this.server;
        var uCMode;
        if (this.server.channelTarget(target)) {
            // TODO: Channel wildcards
            var channel = this.server.channels.find(target);

            if (!channel) {
                user.send(this.server.host, irc.errors.noSuchChannel, user.nick, ':No such channel');
            } else {
                channel.users.forEach(function (channelUser) {
                    if (channelUser.isInvisible
                        && !user.isOper
                        && channel.users.indexOf(user) === -1) {
                        return;
                    } else {
                        user.send(server.host,
                            irc.reply.who,
                            user.nick,
                            channel.name,
                            channelUser.username,
                            channelUser.hostname,
                            server.config.hostname, // The IRC server rather than the network
                            channelUser.channelNick(channel),
                            channelUser.findChannelWhoCode(channel), // H is here, G is gone, * is IRC operator, + is voice, % is host, @ is owner
                            ':0',
                            channelUser.realname);
                    }
                });
                user.send(this.server.host, irc.reply.endWho, user.nick, channel.name, ':End of /WHO list.');
            }
        } else {
            var matcher = this.server.normalizeName(target).replace(/\?/g, '.');
            this.server.users.registered.forEach(function (targetUser) {
                try {
                    if (!targetUser.nick.match('^' + matcher + '$')) return;
                } catch (e) {
                    return;
                }

                var sharedChannel = targetUser.sharedChannelWith(user);
                if (targetUser.isInvisible
                    && !user.isOper
                    && !sharedChannel) {
                    return;
                } else {

                    user.send(server.host,
                        irc.reply.who,
                        user.nick,
                        sharedChannel ? sharedChannel.name : '',
                        targetUser.username,
                        targetUser.hostname,
                        server.config.hostname,
                        targetUser.channelNick(channel),
                        targetUser.findChannelWhoCode(channel),
                        ':0',
                        targetUser.realname);
                }
            });
            user.send(this.server.host, irc.reply.endWho, user.nick, target, ':End of /WHO list.');
        }
    },
    LUSERS: function (user, mask, target) {
        if (!mask && !target) {
            user.send(this.server.host, irc.reply.luserClient, user.nick, ':There are ' + (this.server.users.numRegistered - this.server.users.numInvisible) + ' users and ' + this.server.users.numInvisible + ' invisible on 1 servers');
            user.send(this.server.host, irc.reply.luserOp, user.nick, '0 :operator(s) online');
            user.send(this.server.host, irc.reply.luserUnknown, user.nick, '0 :unknown connection(s)');
            user.send(this.server.host, irc.reply.luserChannels, user.nick, this.server.numChannels + ' :channels formed');
            user.send(this.server.host, irc.reply.luserMe, user.nick, ':I have ' + this.server.users.numRegistered + ' clients and 1 servers');

        }

    },
    WHOIS: function (user, nickmask) {
        // TODO: nick masks
        var target = this.server.users.find(nickmask);
        if (target) {
            var channels = target.channels.map(function (channel) {
                if (channel.isSecret && !channel.isMember(user)) return;

                if (target.isOp(channel)) {
                    return '@' + channel.name;
                } else {
                    return channel.name;
                }
            });


            if (user.isOper && !target.isService) {
                user.send(this.server.host, irc.reply.whoIsUser, user.nick, target.nick,
                    target.username, target.hostname, '*', ':' + target.realname);
                user.send(this.server.host, '320', user.nick, target.nick, ':is at ' + target.realhostname);
                user.send(this.server.host, '320', user.nick, target.nick, ':has IP Address ' + target.remoteAddress);
                user.send(this.server.host, '322', user.nick, target.nick, ':has modes ' + target.modes);

            } else {
                user.send(this.server.host, irc.reply.whoIsUser, user.nick, target.nick,
                    target.username, target.hostname, '*', ':' + target.realname);

            }
            if (!target.isOper && !target.isService) {
                user.send(this.server.host, irc.reply.whoIsChannels, user.nick, target.nick, ':' + channels);
                user.send(this.server.host, irc.reply.whoIsServer, user.nick, target.nick, this.server.config.hostname, ':' + this.server.config.serverDescription);
            }

            if (target.isOper) {
                user.send(this.server.host, irc.reply.whoIsOperator, user.nick, target.nick, ':is an IRC operator');
            }
            if (target.isService) {
                user.send(this.server.host, irc.reply.whoIsOperator, user.nick, target.nick, ':is a Network Service');
            }
            if (target.isAway) {
                user.send(this.server.host, irc.reply.away, user.nick, target.nick, ':' + target.awayMessage);
            }

            user.send(this.server.host, irc.reply.whoIsIdle, user.nick, target.nick, target.idle, user.created, ':seconds idle, sign on time');
            user.send(this.server.host, irc.reply.endOfWhoIs, user.nick, target.nick, ':End of /WHOIS list.');
        } else if (!nickmask || nickmask.length === 0) {
            user.send(this.server.host, irc.errors.noNickGiven, user.nick, ':No nick given');
        } else {
            user.send(this.server.host, irc.errors.noSuchNick, user.nick, nickmask, ':No such nick/channel');
        }
    },
    INFO: function (user) {
        this.server.getInfo(user);
    },
    WHOWAS: function (user, nicknames, count, serverName) {
        // TODO: Server
        var server = this.server,
            found = false;
        nicknames.split(',').forEach(function (nick) {
            var matches = server.history.find(nick);
            if (count) matches = matches.slice(0, count);
            matches.forEach(function (item) {
                found = true;
                user.send(server.host, irc.reply.whoWasUser, user.nick, item.nick, item.username, item.host, '*', ':' + item.realname);
                user.send(server.host, irc.reply.whoIsServer, user.nick, item.nick, item.server, ':' + item.time);
            });
        });

        if (found) {
            user.send(this.server.host, irc.reply.endWhoWas, user.nick, nicknames, ':End of WHOWAS');
        } else {
            user.send(this.server.host, irc.errors.wasNoSuchNick, user.nick, nicknames, ':There was no such nickname');
        }
    },
    WALLOPS: function (user, text) {
        var self = this;
        if (!user.isOper) {
            user.send(this.server.host, irc.errors.noPrivileges, user.nick, ":Permission Denied- You're not an IRC operato");
            return;
        }
        if (!text || text.length === 0) {
            user.send(this.server.host, irc.errors.needMoreParams, user.nick, ':Need more parameters');
            return;
        }

        this.server.users.registered.forEach(function (user) {
            if (user.modes.indexOf('w') !== -1 && user.isOper) {
                user.send(self.server.host, 'WALLOPS', ':OPERWALL - ' + text);
            }
        });
    },
    WALLUSERS: function (user, text) {
        var self = this;
        if (!user.isOper) {
            user.send(this.server.host, irc.errors.noPrivileges, user.nick, ":Permission Denied- You're not an IRC operator");
            return;
        }
        if (!text || text.length === 0) {
            user.send(this.server.host, irc.errors.needMoreParams, user.nick, ':Need more parameters');
            return;
        }

        this.server.users.registered.forEach(function (user) {
            user.send(self.server.host, 'WALLOPS', ':USERWALL - ' + text);
        });
    },
    // TODO: Local ops
    OPER: function (user, name, password) {
        /*
         0 - Mode O - Local oper
         1 - Mode S - Support
         2 - Mode o - Operator
         3 - Mode A - Admin
         4 - Mode N - Network Admin
         5 - Mode X - Full Admin

         Mode W - Wallops
         */
        if (!name || !password) {
            user.send(this.server.host, irc.errors.wasNoSuchNick, user.nick, ':OPER requires a nick and password');
        } else {
            var userConfig,
                self = this.server,
                targetUser = self.config.opers[name];

            if (targetUser === undefined) {
                user.send(self.host, irc.errors.noOperHost, user.nick, ':No O-lines for your host');
            } else if (targetUser.allowedHost !== user.realhostname && targetUser.allowedHost !== "*") {
                user.send(self.host, irc.errors.noOperHost, user.nick, ':No O-lines for your host');
            } else {
                ircd.compareHash(password, targetUser.password, function (err, res) {
                    if (res) {
                        user.send(self.host, irc.reply.youAreOper, user.nick, ':You are now an IRC operator');
                        user.oper(targetUser.operLevel);
                        user.hostname = self.config.opers[name].vhost;
                        user.operLevel = targetUser.operLevel;
                        user.send(self.host, irc.reply.newHostName, user.nick, ':Your host is now ' + user.hostname);
                    } else {
                        user.send(self.host, irc.errors.passwordWrong, user.nick || 'user', ':Password incorrect');
                    }
                });
            }
        }
    },

    QUIT: function (user, message) {
        user.quit(message);
        this.server.history.add(user);
        delete user;
    },

    MOTD: function (user) {
        this.server.motd(user);
    }
};

module.exports = Commands;
