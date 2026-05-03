import type { WebviewPersistedState, WebviewToHostMessage } from "@CodeAtlas/extension-bridge";

declare global {
  interface VsCodeApi<State> {
    postMessage(message: WebviewToHostMessage): void;
    getState(): State | undefined;
    setState(state: State): void;
  }

  function acquireVsCodeApi(): VsCodeApi<WebviewPersistedState>;
}

export {};
