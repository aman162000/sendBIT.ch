const parse = require("ua-parser-js");
const uq = require("./uniquename");

class Server {
  constructor(port) {
    const WebSocket = require("ws");

    this.wss = new WebSocket.Server({ port: port });
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

    headers.push(`Set-Cookie:peerid=${response.peerId};SameSite=Strict;Secure`);
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

    switch (message.type) {
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
    for (const peerId in this.room[peer.id]) {
      const otherpeer = this.room[peer.ip][peerId];
      this.send(otherpeer, {
        type: "peer-joined",
        peer: peer.getInfo(),
      });
    }

    const otherpeers = [];
    for (const peerId in this.room[peer.ip]) {
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
    this.setName(request);
    this.setPeerId(request);
    this.isRTCSupported = request.url.indexOf("rtc") > -1;
    this.timerId = 0;
    this.lastBeat = Date.now();
  }

  setIP(request) {
    if (request["x-forwarded-for"]) {
      this.ip = request.headers["x-forwarded-for"].split(/\s*,\s*/)[0];
    } else {
      this.ip = request.connection.remoteAddress;
    }
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

    const displayName = uq();

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

const server = new Server(process.env.PORT || 3000);
