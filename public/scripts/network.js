class ServerConnection {
    constructor() {
      this.connect();
      Events.on("beforeunload", (e) => this.disconnect());
      Events.on("pagehide", (e) => this.disconnect());
      document.addEventListener("visibilitychange", (e) =>
        this.onVisibilityChange()
      );
    }
    connect() {
      clearTimeout(this.reconnectTimer);
      if (this.isConnected() || this.isConnecting()) return;
      const ws = new WebSocket(this.endpoint());
      ws.binaryType = "arraybuffer";
      ws.onopen = (e) => console.log("WS: server connected");
      ws.onmessage = (e) => this.onMessage(e.data);
      ws.onclose = (e) => this.onDisconnect();
      ws.onerror = (e) => console.error(e);
      this.socket = ws;
    }
    onMessage(msg) {
      msg = JSON.parse(msg);
      console.log("WS:", msg);
      switch (msg.type) {
        case "peers":
          Events.fire("peers", msg.peers);
          break;
        case "peer-joined":
          Events.fire("peer-joined", msg.peer);
          break;
        case "peer-left":
          Events.fire("peer-left", msg.peerId);
          break;
        case "signal":
          Events.fire("signal", msg);
          break;
        case "ping":
          this.send({ type: "pong" });
          break;
        case "display-name":
          Events.fire("display-name", msg);
          break;
        default:
          console.error("WS: unkown message type", msg);
      }
    }
    send(message) {
      if (!this.isConnected()) return;
      this.socket.send(JSON.stringify(message));
    }
    endpoint() {
      const protocol = location.protocol.startsWith("https") ? "wss" : "ws";
      const webrtc = window.isRtcSupported ? "/rtc" : "/fallback";
      const url =
        protocol + "://" + window.location.host + webrtc;
      return url;
    }
    disconnect() {
      this.send({ type: "disconnect" });
      this.socket.onclose = null;
      this.socket.close();
    }
    onDisconnect() {
      console.log("WS: server disconnected");
      Events.fire("notify-user", "Connection lost. Retry in 5 seconds...");
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout((_) => this.connect(), 5000);
    }
    onVisibilityChange() {
      if (document.hidden) return;
      this.connect();
    }
    isConnected() {
      return this.socket && this.socket.readyState === this.socket.OPEN;
    }
    isConnecting() {
      return this.socket && this.socket.readyState === this.socket.CONNECTING;
    }
  }
  
  class Peer {
    constructor(serverConnection, peerId) {
      this.server = serverConnection;
      this.peerId = peerId;
      this.filesQueue = [];
      this.busy = false;
    }
    sendJSON(message) {
      this.send(JSON.stringify(message));
    }
    sendFiles(files) {
      for (let i = 0; i < files.length; i++) {
        this.filesQueue.push(files[i]);
      }
      if (this.busy) return;
      this.dequeueFile();
    }
  
    dequeueFile() {
      if (!this.filesQueue.length) return;
      this.busy = true;
      const file = this.filesQueue.shift();
      this.sendFile(file);
    }
    sendFile(file) {
      this.sendJSON({
        type: "header",
        name: file.name,
        mime: file.type,
        size: file.size,
      });
      this.chunker = new FileChunker(
        file,
        (chunk) => this.send(chunk),
        (offset) => this.onPartitionEnd(offset)
      );
      this.chunker.nextPartition();
    }
    onPartitionEnd(offset) {
      this.sendJSON({ type: "partition", offset: offset });
    }
    onReceivedPartitionEnd(offset) {
      this.sendJSON({ type: "partition-received", offset: offset });
    }
    sendNextPartition() {
      if (!this.chunker || this.chunker.isFileEnd()) return;
      this.chunker.nextPartition();
    }
    sendProgress(progress) {
      this.sendJSON({ type: "progress", progress: progress });
    }
    onMessage(message) {
      if (typeof message !== "string") {
        this.onChunkReceived(message);
        return;
      }
      message = JSON.parse(message);
      console.log("RTC:", message);
      switch (message.type) {
        case "header":
          this.onFileHeader(message);
          break;
        case "partition":
          this.onReceivedPartitionEnd(message);
          break;
        case "partition-received":
          this.sendNextPartition();
          break;
        case "progress":
          this.onDownloadProgress(message.progress);
          break;
        case "transfer-complete":
          this.onTransferCompleted();
          break;
        case "text":
          this.onTextReceived(message);
          break;
      }
    }
    onFileHeader(header) {
      this.lastProgress = 0;
      this.digester = new FileDigester(
        {
          name: header.name,
          mime: header.mime,
          size: header.size,
        },
        (file) => this.onFileReceived(file)
      );
    }
    onChunkReceived(chunk) {
      if (!chunk.byteLength) return;
  
      this.digester.unchunk(chunk);
      const progress = this.digester.progress;
      this.onDownloadProgress(progress);
  
      // occasionally notify sender about our progress
      if (progress - this.lastProgress < 0.01) return;
      this.lastProgress = progress;
      this.sendProgress(progress);
    }
    onDownloadProgress(progress) {
      Events.fire("file-progress", { sender: this.peerId, progress: progress });
    }
    onFileReceived(proxyFile) {
      Events.fire("file-received", proxyFile);
      this.sendJSON({ type: "transfer-complete" });
    }
    onTransferCompleted() {
      this.onDownloadProgress(1);
      this.reader = null;
      this.busy = false;
      this.dequeueFile();
      Events.fire("notify-user", "File transfer completed.");
    }
  
    sendText(text) {
      const unescaped = btoa(unescape(encodeURIComponent(text)));
      this.sendJSON({ type: "text", text: unescaped });
    }
    onTextReceived(message) {
      const escaped = decodeURIComponent(escape(atob(message.text)));
      Events.fire("text-received", { text: escaped, sender: this.peerId });
    }
  }
  class RTCPeer extends Peer {
    constructor(serverConnection, peerId) {
      super(serverConnection, peerId);
      if (!peerId) return; // we will listen for a caller
      this.connect(peerId, true);
    }
    connect(peerId, isCaller) {
      if (!this.conn) this.openConnection(peerId, isCaller);
  
      if (isCaller) {
        this.openChannel();
      } else {
        this.conn.ondatachannel = (e) => this.onChannelOpened(e);
      }
    }
    openConnection(peerId, isCaller) {
      this.isCaller = isCaller;
      this.peerId = peerId;
      this.conn = new RTCPeerConnection(RTCPeer.config);
      this.conn.onicecandidate = (e) => this.onIceCandidate(e);
      this.conn.onconnectionstatechange = (e) => this.onConnectionStateChange(e);
      this.conn.oniceconnectionstatechange = (e) =>
        this.onIceConnectionStateChange(e);
    }
    openChannel() {
      const channel = this.conn.createDataChannel("data-channel", {
        ordered: true,
        reliable: true,
      });
      channel.onopen = (e) => this.onChannelOpened(e);
      this.conn
        .createOffer()
        .then((d) => this.onDescription(d))
        .catch((e) => this.onError(e));
    }
    onDescription(description) {
      this.conn
        .setLocalDescription(description)
        .then((_) => this.sendSignal({ sdp: description }))
        .catch((e) => this.onError(e));
    }
    onIceCandidate(event) {
      if (!event.candidate) return;
      this.sendSignal({ ice: event.candidate });
    }
    onServerMessage(message) {
      if (!this.conn) this.connect(message.sender, false);
  
      if (message.sdp) {
        this.conn
          .setRemoteDescription(new RTCSessionDescription(message.sdp))
          .then((_) => {
            if (message.sdp.type === "offer") {
              return this.conn.createAnswer().then((d) => this.onDescription(d));
            }
          })
          .catch((e) => this.onError(e));
      } else if (message.ice) {
        this.conn.addIceCandidate(new RTCIceCandidate(message.ice));
      }
    }
    onChannelOpened(event) {
      console.log("RTC: channel opened with", this.peerId);
      const channel = event.channel || event.target;
      channel.binaryType = "arraybuffer";
      channel.onmessage = (e) => this.onMessage(e.data);
      channel.onclose = (e) => this.onChannelClosed();
      this.channel = channel;
    }
    onChannelClosed() {
      console.log("RTC: channel closed", this.peerId);
      if (!this.isCaller) return;
      this.connect(this.peerId, true); // reopen the channel
    }
    onConnectionStateChange(e) {
      console.log("RTC: state changed:", this.conn.connectionState);
      switch (this.conn.connectionState) {
        case "disconnected":
          this.onChannelClosed();
          break;
        case "failed":
          this.conn = null;
          this.onChannelClosed();
          break;
      }
    }
    onIceConnectionStateChange() {
      switch (this.conn.iceConnectionState) {
        case "failed":
          console.error("ICE Gathering failed");
          break;
        default:
          console.log("ICE Gathering", this.conn.iceConnectionState);
      }
    }
    onError(error) {
      console.error(error);
    }
    send(message) {
      if (!this.channel) return this.refresh();
      this.channel.send(message);
    }
    sendSignal(signal) {
      signal.type = "signal";
      signal.to = this.peerId;
      this.server.send(signal);
    }
    refresh() {
      // check if channel is open. otherwise create one
      if (this.isConnected() || this.isConnecting()) return;
      this.connect(this.peerId, this.isCaller);
    }
  
    isConnected() {
      return this.channel && this.channel.readyState === "open";
    }
  
    isConnecting() {
      return this.channel && this.channel.readyState === "connecting";
    }
  }
  
  class PeersManager {
    constructor(serverConnection) {
      this.peers = {};
      this.server = serverConnection;
      Events.on("signal", (e) => this.onMessage(e.detail));
      Events.on("peers", (e) => this.onPeers(e.detail));
      Events.on("files-selected", (e) => this.onFilesSelected(e.detail));
      Events.on("send-text", (e) => this.onSendText(e.detail));
      Events.on("peer-left", (e) => this.onPeerLeft(e.detail));
    }
    onMessage(message) {
      if (!this.peers[message.sender]) {
        this.peers[message.sender] = new RTCPeer(this.server);
      }
      this.peers[message.sender].onServerMessage(message);
    }
    onPeers(peers) {
      peers.forEach((peer) => {
        if (this.peers[peer.id]) {
          this.peers[peer.id].refresh();
          return;
        }
        if (window.isRtcSupported && peer.RTCSupported) {
          this.peers[peer.id] = new RTCPeer(this.server, peer.id);
        } else {
          this.peers[peer.id] = new WSPeer(this.server, peer.id);
        }
      });
    }
    sendTo(peerId, message) {
      this.peers[peerId].send(message);
    }
    onFilesSelected(message) {
      this.peers[message.to].sendFiles(message.files);
    }
    onSendText(message) {
      this.peers[message.to].sendText(message.text);
    }
    onPeerLeft(peerId) {
      const peer = this.peers[peerId];
      delete this.peers[peerId];
      if (!peer || !peer.peer) return;
      peer.peer.close();
    }
  }
  class WSPeer {
    send(message) {
      message.to = this.peerId;
      this.server.send(message);
    }
  }
  
  class FileChunker {
    constructor(file, onChunk, onPartitionEnd) {
      this.chunkSize = 64000; // 64 KB
      this.maxPartitionSize = 1e6; // 1 MB
      this.offset = 0;
      this.partitionSize = 0;
      this.file = file;
      this.onChunk = onChunk;
      this.onPartitionEnd = onPartitionEnd;
      this.reader = new FileReader();
      this.reader.addEventListener("load", (e) =>
        this.onChunkRead(e.target.result)
      );
    }
    nextPartition() {
      this.partitionSize = 0;
      this.readChunk();
    }
    readChunk() {
      const chunk = this.file.slice(this.offset, this.offset + this.chunkSize);
      this.reader.readAsArrayBuffer(chunk);
    }
    onChunkRead(chunk) {
      this.offset += chunk.byteLength;
      this.partitionSize += chunk.byteLength;
      this.onChunk(chunk);
      if (this.isFileEnd()) return;
      if (this.isPartitionEnd()) {
        this.onPartitionEnd(this.offset);
        return;
      }
      this.readChunk();
    }
    repeatPartition() {
      this.offset -= this.partitionSize;
      this.nextPartition();
    }
    isPartitionEnd() {
      return this.partitionSize >= this.maxPartitionSize;
    }
    isFileEnd() {
      return this.offset >= this.file.size;
    }
    get progress() {
      return this.offset / this.file.size;
    }
  }
  
  class FileDigester {
    constructor(meta, callback) {
      this.buffer = [];
      this.bytesReceived = 0;
      this.size = meta.size;
      this.mime = meta.mime || "application/octet-stream";
      this.name = meta.name;
      this.callback = callback;
    }
  
    unchunk(chunk) {
      this.buffer.push(chunk);
      this.bytesReceived += chunk.byteLength || chunk.size;
      const totalChunks = this.buffer.length;
      this.progress = this.bytesReceived / this.size;
      if (isNaN(this.progress)) this.progress = 1;
  
      if (this.bytesReceived < this.size) return;
      // we are done
      let blob = new Blob(this.buffer, { type: this.mime });
      this.callback({
        name: this.name,
        mime: this.mime,
        size: this.size,
        blob: blob,
      });
    }
  }
  