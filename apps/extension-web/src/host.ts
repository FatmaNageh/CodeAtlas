import {
  parseHostToWebviewMessage,
  parseWebviewPersistedState,
  type HostToWebviewMessage,
  type WebviewPersistedState,
  type WebviewToHostMessage,
} from "@CodeAtlas/extension-bridge";

type MessageHandler = (message: HostToWebviewMessage) => void;

const vscodeApi = acquireVsCodeApi();

export function postHostMessage(message: WebviewToHostMessage): void {
  vscodeApi.postMessage(message);
}

export function getPersistedState(): WebviewPersistedState | undefined {
  const value = vscodeApi.getState();
  const state = parseWebviewPersistedState(typeof value === "object" && value !== null ? value : null);
  return state ?? undefined;
}

export function setPersistedState(state: WebviewPersistedState): void {
  vscodeApi.setState(state);
}

export function subscribeToHostMessages(handler: MessageHandler): () => void {
  const listener = (event: MessageEvent) => {
    const message = parseHostToWebviewMessage(
      typeof event.data === "object" && event.data !== null ? event.data : null,
    );
    if (message) handler(message);
  };

  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}
