const parse = require("ua-parser-js");
const { uniqueNamesGenerator, starWars } = require("unique-names-generator");
const express = require("express");
const http = require("http");
var process = require("process");

var process = require('process')
// Handle SIGINT
process.on('SIGINT', () => {
  console.info("SIGINT Received, exiting...")
  process.exit(0)
})

// Handle SIGTERM
process.on('SIGTERM', () => {
  console.info("SIGTERM Received, exiting...")
  process.exit(0)
})

// Handle APP ERRORS
process.on('uncaughtException', (error, origin) => {
    console.log('----- Uncaught exception -----')
    console.log(error)
    console.log('----- Exception origin -----')
    console.log(origin)
})
process.on('unhandledRejection', (reason, promise) => {
    console.log('----- Unhandled Rejection at -----')
    console.log(promise)
    console.log('----- Reason -----')
    console.log(reason)
})


const app = express();
const port = process.env.PORT || 3000;
app.set('trust proxy', true)
app.use(express.static("public"));

app.use(function (req, res) {
  res.redirect("/");
});

app.get("/", (req, res) => {
  res.sendFile("index.html");
});

const server = http.createServer(app);
server.listen(port);

class Server {
  constructor() {
    const WebSocket = require("ws");

    this.wss = new WebSocket.Server({ server });
    this.wss.on("connection", (socket, request) =>
      this.onConnection(new Peer(socket, request))
    );
    this.wss.on("headers", (headers, response) =>
      this.onHeaders(headers, response)
    );

    this.room = {};

    console.log("Websocket Server is started at " + port);
  }

  onHeaders(headers, response) {
    if (
      response.headers.cookie &&
      response.headers.cookie.indexOf("peerid=") > -1
    )
      return;
    response.peerId = Peer.uuid();
    headers.push(`Set-Cookie:peerid=${response.peerId};SameSite=Strict; Secure`);
  }

  onConnection(peer) {
    this.joinRoom(peer);
    peer.socket.on("message", (msg) => this.onMessage(peer, msg));
    this.keepAlive(peer);

    this.send(peer, {
      type: "display-name",
      message: {
        displayName: peer.name.displayName,
        deviceName: peer.name.device,
      },
    });
  }
  onMessage(sender, msg) {
    try {
      msg = JSON.parse(msg);
    } catch (e) {
      return;
    }

    switch (msg.type) {
      case "disconnect":
        this.leaveRoom(sender);
        break;
      case "pong":
        sender.lastBeat = Date.now();
        break;
    }

    if (msg.to && this.room[sender.ip]) {
      const recipientId = msg.to;
      const recipient = this.room[sender.ip][recipientId];
      delete msg.to;
      msg.sender = sender.id;
      this.send(recipient, msg);
      return;
    }
  }
  joinRoom(peer) {
    if (!this.room[peer.ip]) {
      this.room[peer.ip] = {};
    }
    for (const peerId in this.room[peer.ip]) {
      const otherpeer = this.room[peer.ip][peerId];
      this.send(otherpeer, {
        type: "peer-joined",
        peer: peer.getInfo(),
      });
    }

    const otherpeers = [];
    for (const peerId in this.room[peer.ip]) {
      console.log(this.room[peer.ip][peerId].getInfo());
      otherpeers.push(this.room[peer.ip][peerId].getInfo());
    }

    this.send(peer, {
      type: "peers",
      peers: otherpeers,
    });

    this.room[peer.ip][peer.id] = peer;
  }
  leaveRoom(peer) {
    if (!this.room[peer.ip] || !this.room[peer.ip][peer.id]) return;
    this.cancelKeepAlive(this.room[peer.ip][peer.id]);

    delete this.room[peer.ip][peer.id];

    peer.socket.terminate();
    if (!Object.keys(this.room[peer.ip]).length) {
      delete this.room[peer.ip];
    } else {
      for (const peerid in this.room[peer.ip]) {
        const otherpeer = this.room[peer.ip][peerid];
        this.send(otherpeer, { type: "peer-left", peerId: peer.id });
      }
    }
  }
  send(peer, message) {
    if (!peer) return;
    if (this.wss.readyState !== this.wss.OPEN) return;
    message = JSON.stringify(message);
    peer.socket.send(message, (err) => "");
  }
  keepAlive(peer) {
    this.cancelKeepAlive(peer);
    var timeout = 30000;
    if (!peer.lastBeat) {
      peer.lastBeat = Date.now();
    }
    if (Date.now() - peer.lastBeat > 2 * timeout) {
      this.leaveRoom(peer);
      return;
    }
    this.send(peer, { type: "ping" });
    peer.timerId = setTimeout(() => this.keepAlive(peer), timeout);
  }
  cancelKeepAlive(peer) {
    if (peer && peer.timerId) {
      clearTimeout(peer.timerId);
    }
  }
}

class Peer {
  constructor(socket, request) {
    this.socket = socket;
    this.setIP(request);
    this.setPeerId(request);
    this.setName(request);
    this.isRTCSupported = request.url.indexOf("rtc") > -1;
    this.timerId = 0;
    this.lastBeat = Date.now();
  }

  setIP(request) {
    console.log(request.connection.remoteAddress);
    if (request["x-forwarded-for"]) {
      this.ip = request.headers["x-forwarded-for"].split(/\s*,\s*/)[0];
    } else {
      this.ip = request.connection.remoteAddress;
    }
    if (this.ip == "::1" || this.ip == "::ffff:127.0.0.1") {
      this.ip = "127.0.0.1";
    }
    console.log(this.ip,request.connection.remoteAddress)
  }
  setPeerId(request) {
    if (request.peerId) {
      this.id = request.peerId;
    } else {
      this.id = request.headers.cookie.replace("peerid=", "");
    }
  }
  setName(request) {
    let userAgent = parse(request.headers["user-agent"]);
    // Name of device
    let device = "";

    if (userAgent.device.model) {
      device += userAgent.device.model;
    } else {
      device += userAgent.browser.name;
    }
    if (!device) {
      device = "Unknown user";
    }
    const displayName = uniqueNamesGenerator({
      length: 1,
      separator: " ",
      dictionaries: [starWars],
      style: "capital",
      seed: hashCode(this.id),
    });

    this.name = {
      model: userAgent.device.model,
      os: userAgent.os.name,
      browser: userAgent.browser.name,
      type: userAgent.device.type,
      device,
      displayName,
    };
  }
  getInfo() {
    return {
      id: this.id,
      name: this.name,
      RTCSupported: this.isRTCSupported,
    };
  }
  static uuid() {
    let uuid = "",
      ii;
    for (ii = 0; ii < 32; ii += 1) {
      switch (ii) {
        case 8:
        case 20:
          uuid += "-";
          uuid += ((Math.random() * 16) | 0).toString(16);
          break;
        case 12:
          uuid += "-";
          uuid += "4";
          break;
        case 16:
          uuid += "-";
          uuid += ((Math.random() * 4) | 8).toString(16);
          break;
        default:
          uuid += ((Math.random() * 16) | 0).toString(16);
      }
    }
    return uuid;
  }
}
const hashCode = (str) => {
  var hash = 0,
    i,
    chr;
  for (i = 0; i < str.length; i++) {
    chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return hash;
};
new Server();
