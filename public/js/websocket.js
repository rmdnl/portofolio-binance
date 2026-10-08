export class WebSocketClient {
  constructor(url) {
    this.url = url;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 2000;
    this.ws = null;
    this.onOpenCallbacks = [];
    this.onMessageCallbacks = [];
    this.onCloseCallbacks = [];
    this.onErrorCallbacks = [];
  }

  connect() {
    if (this.ws) {
      this.ws.close();
    }

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.onOpenCallbacks.forEach(cb => cb());
    };

    this.ws.onmessage = (event) => {
      this.onMessageCallbacks.forEach(cb => cb(event.data));
    };

    this.ws.onclose = () => {
      this.onCloseCallbacks.forEach(cb => cb());
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts);
      }
    };

    this.ws.onerror = (error) => {
      this.onErrorCallbacks.forEach(cb => cb(error));
    };
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  onOpen(callback) {
    this.onOpenCallbacks.push(callback);
  }

  onMessage(callback) {
    this.onMessageCallbacks.push(callback);
  }

  onClose(callback) {
    this.onCloseCallbacks.push(callback);
  }

  onError(callback) {
    this.onErrorCallbacks.push(callback);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
    this.ws = null;
  }

  get readyState() {
    return this.ws ? this.ws.readyState : WebSocket.CLOSED;
  }
}
