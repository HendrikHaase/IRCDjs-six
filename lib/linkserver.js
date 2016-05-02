var net = require('net'),
    carrier = require('carrier'),
    winston = require('winston');

function LinkDB(LS){
    this.registered = [];
    this.ls = LS;
}
LinkDB.prototype = {
    verifyLink: function() {},
    registerLink: function() {}
};
function LinkServer(ircserver) {
    this.server = ircserver;
    this.port = this.server.config.linkPort;
    this.linkserver = null;
    this.linkdb = new LinkDB(this);
    this.unregistered = [];
}
LinkServer.prototype = {
    log: function (msg) {
        winston.warn('[LinkServer]: ' + msg);
    },
    startServer: function () {
        try {
            this.linkserver = net.createServer(handleStream);
            this.linkserver.listen(this.port);
            this.linkserver.maxConnections = this.server.config.maxLinks;
            LinkServer.log('Waiting for links on port: ' + this.port);
            function handleStream(stream) {
                var carry = carrier.carry(stream);
                // Handle new connections, for security
                // im thinking we give the new connection 5
                // seconds to send the PASS & SERVER command

            }
        } catch (e) {
            LinkServer.log(e);
        }

    }
};

exports.LinkServer = LinkServer;
