var net = require('net'),
    carrier = require('carrier'),
    winston = require('winston'),
    LinkClient = require('./linkclient').LinkClient;

function LinkServer(ircserver) {
    this.server = ircserver;
    this.port = this.server.config.linkPort;
    this.linkserver = null;
    this.debug = true;


    this.startServer();
}
LinkServer.prototype = {
    log: function (msg) {
        if (this.debug) {
            winston.warn('[LinkServer]: ' + msg);
        }
    },
    startServer: function () {
        var self = this;
        try {
            this.linkserver = net.createServer(handleStream);
            this.linkserver.listen(this.port);
            this.linkserver.maxConnections = this.server.config.maxLinks;

            self.log('Waiting for links on port: ' + this.port);

            for (var serverName in self.server.config.links) {
                if (!self.server.config.links.hasOwnProperty(serverName) || !self.server.config.links[serverName].active) continue;
                self.log('Registered LINK server: ' + serverName);
                self.server.servers.register(serverName, self.server.config.links[serverName]);
            }

            function handleStream(stream) {
                self.log('*** New Connection from: ' + stream.remoteAddress);
                var carry = carrier.carry(stream);
                var remoteServer = self.server.servers.findByHost(stream.remoteAddress);


                remoteServer.stream = stream;
                remoteServer.localConnection = true;

                /** Testing **/
                remoteServer.send('PASS', remoteServer.password, self.server.version, 'IRC|aBgH$');
                remoteServer.send('SERVER', self.server.name, '0', self.server.token, self.server.info || '');

                stream.on('end', function () {
                    self.log('*** Lost Connection *** : ' + stream.remoteAddress);
                });
                stream.on('error', function (e) {
                    self.log('Stream Error : ' + stream.remoteAddress + ' : ' + e);
                });

                carry.on("line", function (line) {
                    line = line.slice(0, 512);
                    var message = self.server.parse(line);

                    if (self.linkCommands[message.command]) {
                        message.args.unshift(remoteServer);
                        return self.linkCommands[message.command].apply(self.server, message.args);
                    }

                });
            }
        } catch (e) {
            self.log(e);
        }

    },
    linkCommands: {
        PASS: function (server, pass, ver, flags, options) {
            // TODO: Flags & Options
            // TODO: Pass should only be handled once
            if (server.password === pass) {
                server.authenticated = true;
                server.serverVersion = ver;
                server.serverFlags = flags;
            } else {
                // Wrong pass, disconnect the server?
            }
        },
        SERVER: function () {
            var host,
                hopCount,
                token,
                info,
                self = this,
                name = this.name,
                server = arguments[0],
                serverName = arguments[1],
                localName = this.name;

            // TODO: ERR_ALREADYREGISTRED
            if (arguments.length < 6 && server.name === serverName) {
                // Direct link connection
                hopCount = arguments[2];
                token = arguments[3];
                info = arguments[4];
                server.hopCount = hopCount;
                server.token = token;
                server.info = info;
                server.gotServerInfo = true;

                // TODO: there should be some sort exchange of server data like users and stuff spec says.
                // Connection is active
                console.log(server + ' connection now active with ' + token);
                this.servers.broadcast(':' + localName, 'SERVER', serverName, hopCount, token, info);
            } else if (arguments.length > 5) {
                // Register remote connection
                host = arguments[1];
                serverName = arguments[2];
                hopCount = arguments[3];
                token = arguments[4];
                info = arguments[5];
                this.servers.registerRemote({name: host}, serverName, {token: token, hopCount: hopCount, host: host});

                // Tell local servers about this connection
                this.servers.broadcastOthers(server, ':' + host, 'SERVER', serverName, hopCount, token, info);
            }
        },
        PONG: function (server, hostname) {
            server.send('PING', hostname);
        },
        NICK: function (server, nick, hopcount, username, host, servertoken, umode, realname) {
            /** var user = new User(null, Server);
             user.nick = nick;
             user.hopCount = hopcount;
             user.username = username;
             user.hostname = host;
             user.servertoken = servertoken;
             user.modes = umode;
             user.realname = realname;
             this.users.push(user);
             */
            console.log('NICK', nick, hopcount, username, host, servertoken, umode, realname);
        },

        NJOIN: function (server, channelName, users) {
            console.log('NJOIN! ', channelName, users);
        }
    }
};

exports.LinkServer = LinkServer;
