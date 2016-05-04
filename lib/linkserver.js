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
        if(this.debug) {
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

                stream.on('end', function() {
                    self.log('*** Lost Connection *** : ' + stream.remoteAddress);
                });
                stream.on('error', function(e) {
                    self.log('Stream Error : ' + stream.remoteAddress + ' : ' + e);
                });

                carry.on("line", function (line) {
                    line = line.splice(0, 512);
                    var message = self.server.parse(line);
                    try {
                        if (self.linkCommands[message.command]) {
                            message.args.unshift(remoteServer);
                            return self.linkCommands[message.command].apply(self.server, message.args);
                        }
                    } catch (e) {
                        winston.error(e);
                    }
                });
            }
        } catch (e) {
            self.log(e);
        }

    },
    linkCommands: {
        PASS: function(server, pass, ver, flags, options) {
            // TODO: Flags & Options
            // Pass should only be handled once
            if(server.password === pass){
                server.authenticated = true;
                server.serverVersion = ver;
                server.serverFlags = flags;
            } else {
                // Wrong pass, disconnect the server?
            }
        },
        SERVER: function() {},
        PONG: function(server, hostname) {
            server.send('PING', hostname);
        }
    }
};

exports.LinkServer = LinkServer;
