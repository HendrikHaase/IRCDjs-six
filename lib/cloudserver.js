var net = require('net'),
    carrier = require('carrier'),
    winston = require('winston'),
    LinkCloudDB = require('./storage').LinkCloudDB;

function CloudServer(server) {
    this.server = server;
    this.cserver = null;
    this.db = new LinkCloudDB(server);
    this.port = this.server.config.linkPort;
}
CloudServer.prototype = {
    log: function (msg) {
        winston.info('[CloudServer][Local] - ' + msg);
    },
    registerLinks: function () {
        var self = this;
        this.log('Updating LinkCloud...');
        for (var serverName in this.server.config.links) {
            if (self.server.config.links[serverName].active === true) {
                self.log('Added: ' + serverName);
                self.db.register(serverName, self.server.config.links[serverName]);
            }
        }
        this.log('LinkCloud is ready. ' + self.db.numRegistered + ' Links in the Database');
    },
    serverCommands: {
        PONG: function (server, hostname) {
            server.send('PING', hostname);
        },
        PASS: function () {

        },
        SERVER: function () {

        }
    },
    startServer: function () {
        var self = this;
        this.registerLinks();
        try {
            this.cserver = net.createServer(handleStream);
            this.cserver.listen(this.port);
            this.cserver.maxConnections = this.server.config.maxLinks;
            this.log('LinkCloud online port: ' + this.port);


        } catch (exception) {
            winston.error('Fatal error:', exception);
        }


        function handleStream(stream) {
            var remoteServer = self.db.findByHost(stream.remoteAddress);
            try {
                var carry = carrier.carry(stream);
                self.log('New client connection: ' + stream.remoteAddress);

                // TODO: Server.ircVersion instead of 0210010000?
                // TODO: Modes
                // TODO: zlib link compression

                // Introduce peer to remote server
                // Introduce ourselves to the remote server
                remoteServer.stream = stream;
                remoteServer.localConnection = true;
                remoteServer.send('PASS', remoteServer.password, '0210010000', 'IRC|aBgH$');
                // TODO: hopCount here?
                remoteServer.send('SERVER', self.server.name, '0', self.server.token, self.server.info || '');


                stream.on('end', function () {
                    self.log('*** Lost Connection *** : ' + stream.remoteAddress);
                });
                stream.on('error', function (error) {
                    winston.error("*** Link Error *** : " + error);
                });

                carry.on('line', function (line) {
                    line = line.slice(0, 512);
                    self.log('[' + self.server.name + ', L: ' + remoteServer.name + '] ' + line);
                    var message = self.server.parse(line);
                    try {
                        if (self.serverCommands[message.command]) {
                            message.args.unshift(remoteServer);
                            return self.serverCommands[message.command].apply(self.server, message.args);
                        }
                    } catch (e) {
                        winston.error(e);
                    }
                });
            } catch (exception) {
                winston.error('Fatal error:', exception);
            }
        }
    }
};

exports.CloudServer = CloudServer;
