var net = require('net'),
    carrier = require('carrier'),
    winston = require('winston');

function LinkDB(LS) {
    this.registered = [];
    this.ls = LS;
}
LinkDB.prototype = {
    verifyLink: function () {
    },
    registerLink: function () {
    }
};
function LinkServer(ircserver) {
    this.server = ircserver;
    this.port = this.server.config.linkPort;
    this.linkserver = null;
    this.linkdb = new LinkDB(this);
    this.unregistered = [];

    this.startServer();
}
LinkServer.prototype = {
    log: function (msg) {
        winston.warn('[LinkServer]: ' + msg);
    },
    startServer: function () {
        var self = this;
        try {
            this.linkserver = net.createServer(handleStream);
            this.linkserver.listen(this.port);
            this.linkserver.maxConnections = this.server.config.maxLinks;
            self.log('Waiting for links on port: ' + this.port);
            function handleStream(stream) {
                stream.on('end', function() {
                    self.log('*** Lost Connection *** : ' + stream.remoteAddress);
                });
                stream.on('error', function(e) {
                    self.log('Stream Error : ' + stream.remoteAddress + ' : ' + e);
                });
                var carry = carrier.carry(stream);
                self.unregistered.push(stream.remoteAddress);
                // Handle new connections, for security
                // im thinking we give the new connection 5
                // seconds to send the PASS & SERVER command
                carry.on("line", function (line) {
                    line = line.splice(0, 512);
                    var message = self.server.parse(line);
                    try {
                        if (self.linkCommands[message.command]) {
                            return self.linkCommands[message.command].apply(self, message.args);
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
        PASS: function() {},
        SERVER: function() {}
    }
};

exports.LinkServer = LinkServer;
