window.URL = window.URL || window.webkitURL;
window.isRtcSupported = !!(
  window.RTCPeerConnection ||
  window.mozRTCPeerConnection ||
  window.webkitRTCPeerConnection
);
const $ = (query) => document.getElementById(query);
const $$ = (query) => document.body.querySelector(query);
const isURL = (text) => /^((https?:\/\/|www)[^\s]+)/g.test(text.toLowerCase());
window.isDownloadSupported =
  typeof document.createElement("a").download !== "undefined";
window.isProductionEnvironment = !window.location.host.startsWith("localhost");
window.iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

class Events {
  static fire(type, detail) {
    window.dispatchEvent(new CustomEvent(type, { detail: detail }));
  }

  static on(type, callback) {
    return window.addEventListener(type, callback, false);
  }

  static off(type, callback) {
    return window.removeEventListener(type, callback, false);
  }
}

Events.on("display-name", (e) => {
  const me = e.detail.message;
  const $displayName = $("displayName");
  $displayName.textContent = "You are known as " + me.displayName;
  $displayName.title = me.deviceName;
});

let c = document.createElement("canvas");
document.body.appendChild(c);
let style = c.style;
style.height = "100%";
style.position = "absolute";
style.left = 0;
style.top = 0;
let ctx = c.getContext("2d");
let x, y, w, h, d;

function init() {
  w = window.innerWidth;
  h = window.innerHeight;
  c.width = w;
  c.height = h;
  x = w / 2;
  y = h / 2;
  d = Math.max(h, w, 1000) / 13; //13 is equal to no. of circle
  drawCircles();
}

window.onresize = init;

let step = 0;

function drawCircles() {
  ctx.clearRect(0, 0, w, h);
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    let color = Math.round(102 * (1 - (d * i + (step % d)) / Math.max(w, h)));
    ctx.strokeStyle = "rgba(" + 255 + "," + color + "," + 0 + ",0.2)";
    ctx.arc(x, y, d * i + (step % d), 0, 2 * Math.PI);
    ctx.stroke();
    ctx.lineWidth = 2;
  }
  step += 1;
}
function animate() {
  requestAnimationFrame(function () {
    drawCircles();
    animate();
  });
}
window.backgroundAnimation = () => {
  animate();
};

init();
animate();

//Network

class PeersUI {
  constructor() {
    Events.on("peer-joined", (e) => this.onPeerJoined(e.detail));
    Events.on("peer-left", (e) => this.onPeerLeft(e.detail));
    Events.on("peers", (e) => this.onPeers(e.detail));
    Events.on("file-progress", (e) => this.onFileProgress(e.detail));
    Events.on("paste", (e) => this.onPaste(e));
  }
  onPeerJoined(peer) {
    if ($(peer.id)) return; // peer already exists
    const peerUI = new PeerUI(peer);
    otherDeviceLoad(peerUI.$el);
    console.log("PEER JOINED");
  }
  onPeers(peers) {
    this.clearPeers();
    peers.forEach((peer) => this.onPeerJoined(peer));
  }
  onPeerLeft(peerId) {
    const $peer = $(peerId);
    if (!$peer) return;
    $peer.remove();
  }
  onFileProgress(progress) {
    const peerId = progress.sender || progress.recipient;
    const $peer = $(peerId);
    if (!$peer) return;
    $peer.ui.setProgress(progress.progress);
  }
  clearPeers() {
    const $peersOnLeft = ($("left-space").innerHTML = "");
    const $peersOnRight = ($("right-space").innerHTML = "");
  }
  onPaste(e) {
    const files =
      e.clipboardData.files ||
      e.clipboardData.items
        .filter((i) => i.type.indexOf("image") > -1)
        .map((i) => i.getAsFile());
    const peers = document.querySelectorAll(".peer");

    if (files.length > 0 && peers.length === 1) {
      Events.fire("files-selected", {
        files: files,
        to: $$(".peer").id,
      });
    }
  }
}

class PeerUI {
  html() {
    return createDivElement();
  }
  constructor(peer) {
    this.peer = peer;
    this.initDom();
    this.bindListeners(this.$el);
  }
  initDom() {
    
    let divElement = document.createElement("div");
    divElement.id = this.peer.id;
    divElement.className = "element peer";
    let btn = document.createElement("button");
    btn.className = "btn btn-other-devices";
    let image = document.createElement("img");
    image.setAttribute("src", this.icon());
    let p = document.createElement("p");
    p.textContent = this.displayName();
    let i = document.createElement("i");
    i.textContent = this.deviceName();
    btn.appendChild(image);
    let input = document.createElement("input");
    btn.addEventListener("click", () => {
      input.click();
    });
    input.type = "file";
    input.setAttribute("multiple", "");
    divElement.append(input);
    divElement.appendChild(btn);
    divElement.appendChild(p);
    divElement.appendChild(i);
    input.insertAdjacentHTML('afterend', "<div class='custom-progress'> <div class='circle'></div>  <div class='circle right'></div> </div>")
    divElement.ui = this
    this.$el = divElement;
    this.$progress = divElement.querySelector('.custom-progress');
  
  }
  bindListeners(el) {
    el.querySelector("input").addEventListener("change", (e) =>
      this.onFilesSelected(e)
    );
    el.addEventListener("drop", (e) => this.onDrop(e));
    el.addEventListener("dragend", (e) => this.onDragEnd(e));
    el.addEventListener("dragleave", (e) => this.onDragEnd(e));
    el.addEventListener("dragover", (e) => this.onDragOver(e));
    el.addEventListener("contextmenu", (e) => this.onRightClick(e));
    el.addEventListener("touchstart", (e) => this.onTouchStart(e));
    el.addEventListener("touchend", (e) => this.onTouchEnd(e));
    // prevent browser's default file drop behavior
    Events.on("dragover", (e) => e.preventDefault());
    Events.on("drop", (e) => e.preventDefault());
  }
  displayName() {
    return this.peer.name.displayName;
  }
  deviceName() {
    return this.peer.name.device + "," + this.peer.name.os;
  }
  icon() {
    const device = this.peer.name.device || this.peer.name;
    if (device.type === "mobile") {
      return "https://res.cloudinary.com/duoe2yt88/image/upload/v1668437443/Images/mobile_qeibtw.svg";
    }
    if (device.type === "tablet") {
      return "https://res.cloudinary.com/duoe2yt88/image/upload/v1668437443/Images/mobile_qeibtw.svg";
    }
    return "https://res.cloudinary.com/duoe2yt88/image/upload/v1668437443/Images/laptop_yjom1q.svg";
  }
  onFilesSelected(e) {
    const $input = e.target;
    const files = $input.files;
    Events.fire("files-selected", {
      files: files,
      to: this.peer.id,
    });
    $input.value = null; // reset input
  }
  setProgress(progress) {
    if (progress > 0) {
        this.$el.setAttribute('transfer', '1');
    }
    if (progress > 0.5) {
        this.$progress.classList.add('over50');
    } else {
        this.$progress.classList.remove('over50');
    }
    const degrees = `rotate(${360 * progress}deg)`;
    this.$progress.style.setProperty('--progress', degrees);
    if (progress >= 1) {
        this.setProgress(0);
        this.$el.removeAttribute('transfer');
    }
}

  onDrop(e) {
    e.preventDefault();
    const files = e.dataTransfer.files;
    Events.fire("files-selected", {
      files: files,
      to: this.peer.id,
    });
    this.onDragEnd();
  }
  onDragOver() {
    this.$el.setAttribute("drop", 1);
  }
  onDragEnd() {
    this.$el.removeAttribute("drop");
  }
  onRightClick(e) {
    e.preventDefault();
    Events.fire("text-recipient", this.peer.id);
  }
  onTouchStart(e) {
    this.touchStart = Date.now();
    this.touchTimer = setTimeout((_) => this.onTouchEnd(), 610);
  }
  onTouchEnd(e) {
    if (Date.now() - this.touchStart < 500) {
      clearTimeout(this.touchTimer);
    } else {
      // this was a long tap
      if (e) e.preventDefault();
      Events.fire("text-recipient", this.peer.id);
    }
  }
}

class Dialog {
  constructor(id) {
    this.$el = $(id);
    this.$el
      .querySelectorAll("[close]")
      .forEach((el) => el.addEventListener("click", (e) => this.hide()));
    this.$autoFocus = this.$el.querySelector("[autofocus]");
  }

  show() {
    this.$el.setAttribute("show", 1);
    if (this.$autoFocus) this.$autoFocus.focus();
  }

  hide() {
    this.$el.removeAttribute("show");
    document.activeElement.blur();
    window.blur();
  }
}

class NetworkStatusUI {
  constructor() {
    window.addEventListener("offline", (e) => this.showOfflineMessage(), false);
    window.addEventListener("online", (e) => this.showOnlineMessage(), false);
    if (!navigator.onLine) this.showOfflineMessage();
  }

  showOfflineMessage() {
    Events.fire("notify-user", "You are offline");
  }

  showOnlineMessage() {
    Events.fire("notify-user", "You are back online");
  }
}

class WebShareTargetUI {
  constructor() {
    const parsedUrl = new URL(window.location);
    const title = parsedUrl.searchParams.get("title");
    const text = parsedUrl.searchParams.get("text");
    const url = parsedUrl.searchParams.get("url");

    let shareTargetText = title ? title : "";
    shareTargetText += text ? (shareTargetText ? " " + text : text) : "";

    if (url) shareTargetText = url; // We share only the Link - no text. Because link-only text becomes clickable.

    if (!shareTargetText) return;
    window.shareTargetText = shareTargetText;
    history.pushState({}, "URL Rewrite", "/");
    console.log("Shared Target Text:", '"' + shareTargetText + '"');
  }
}

class ReceiveDialog extends Dialog {
  constructor() {
    super("receiveDialog");
    Events.on("file-received", (e) => {
      this.nextFile(e.detail);
      window.blop.play();
    });
    this.filesQueue = [];
  }

  nextFile(nextFile) {
    if (nextFile) this.filesQueue.push(nextFile);
    if (this.busy) return;
    this.busy = true;
    const file = this.filesQueue.shift();
    this.displayFile(file);
  }

  dequeueFile() {
    if (!this.filesQueue.length) {
      // nothing to do
      this.busy = false;
      return;
    }
    // dequeue next file
    setTimeout((_) => {
      this.busy = false;
      this.nextFile();
    }, 300);
  }

  displayFile(file) {
    const $a = this.$el.querySelector("#download");
    const url = URL.createObjectURL(file.blob);
    $a.href = url;
    $a.download = file.name;

    
    if (file.mime.split("/")[0] === "image") {
      this.$el.querySelector(".preview").style.visibility = "inherit";
      this.$el.querySelector("#img-preview").src = url;
    }

    this.$el.querySelector("#fileName").textContent = file.name;
    this.$el.querySelector("#fileSize").textContent = this.formatFileSize(
      file.size
    );
    this.show();

    if (window.isDownloadSupported) return;
    // fallback for iOS
    $a.target = "_blank";
    const reader = new FileReader();
    reader.onload = (e) => ($a.href = reader.result);
    reader.readAsDataURL(file.blob);
  }

  formatFileSize(bytes) {
    if (bytes >= 1e9) {
      return Math.round(bytes / 1e8) / 10 + " GB";
    } else if (bytes >= 1e6) {
      return Math.round(bytes / 1e5) / 10 + " MB";
    } else if (bytes > 1000) {
      return Math.round(bytes / 1000) + " KB";
    } else {
      return bytes + " Bytes";
    }
  }

  hide() {
    this.$el.querySelector(".preview").style.visibility = "hidden";
    this.$el.querySelector("#img-preview").src = "";
    super.hide();
    this._dequeueFile();
  }

}

class SendBit {
  constructor() {
    const server = new ServerConnection();
    const peers = new PeersManager(server);
    const peersUI = new PeersUI();
    Events.on("load", (e) => {
      const networkStatusUI = new NetworkStatusUI();
      const webShareTargetUI = new WebShareTargetUI();
      const receiveDialog = new ReceiveDialog();
    });
  }
}

const sendbit = new SendBit();

RTCPeer.config = {
  sdpSemantics: "unified-plan",
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};
