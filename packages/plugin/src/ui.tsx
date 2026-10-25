import { createMessageId } from './createMessageId';
import { render } from 'preact';
import { signal } from '@preact/signals';
import { mainToUiSchema, tokenSchema, type UiToMain } from '@magic-ui/shared';
import {
  PluginConnectionManager,
  type ConnectionState,
} from './pluginConnectionManager';
import styles from './ui.module.css';

const token = signal('');
const status = signal<ConnectionState>({
  phase: 'disconnected',
  message: 'Loading saved connection…',
});
const documentName = signal('');
const pendingSettings = new Set<string>();
const post = (message: UiToMain) =>
  parent.postMessage({ pluginMessage: message }, '*');
const manager = new PluginConnectionManager(
  `ws://localhost:${__BRIDGE_PORT__}`,
  post,
  (state) => {
    status.value = state;
  },
);
function requestSettings(save: boolean) {
  const correlationId = createMessageId();
  pendingSettings.add(correlationId);
  if (save) post({ kind: 'saveToken', correlationId, token: token.value });
  else post({ kind: 'initialize', correlationId });
}
window.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (
    (event.source !== parent && event.origin !== 'https://www.figma.com') ||
    typeof event.data !== 'object' ||
    event.data === null ||
    !('pluginMessage' in event.data)
  )
    return;
  const parsed = mainToUiSchema.safeParse(event.data.pluginMessage);
  if (!parsed.success) return;
  const message = parsed.data;
  if (message.kind === 'bridge') {
    manager.forward(message.message);
    return;
  }
  if (!pendingSettings.delete(message.correlationId)) return;
  if (message.kind === 'settings') {
    documentName.value = `${message.document.name} / ${message.document.pageName}`;
    token.value = message.token ?? '';
    if (message.token) manager.connect(message.token, message.document);
    else
      status.value = {
        phase: 'disconnected',
        message: 'Paste the server token to connect this document.',
      };
  } else if (message.kind === 'localError')
    status.value = { phase: 'error', message: message.message };
});
window.addEventListener('beforeunload', () => manager.stop());
function App() {
  return (
    <main class={styles.panel}>
      <h1>Magic UI</h1>
      <p class={styles.document} title={documentName.value}>
        {documentName.value || 'Connect this Figma document'}
      </p>
      <section class={styles.connection} aria-label="Connection status">
        <strong>
          {status.value.phase === 'connected'
            ? 'Connected'
            : status.value.phase === 'connecting'
              ? 'Connecting'
              : status.value.phase === 'error'
                ? 'Connection error'
                : 'Disconnected'}
        </strong>
        <p role="status" aria-live="polite">
          {status.value.message}
        </p>
      </section>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          manager.stop();
          status.value = {
            phase: 'connecting',
            message: 'Saving token and connecting…',
          };
          requestSettings(true);
        }}
      >
        <label for="token">Session token</label>
        <input
          id="token"
          type="password"
          value={token.value}
          onInput={(event) => {
            token.value = event.currentTarget.value.trim();
          }}
          autoComplete="off"
          spellcheck={false}
          aria-describedby="token-help"
        />
        <p id="token-help" class={styles.hint}>
          Copy from <code>~/.magic-ui/session.json</code>. Saved on this device.
        </p>
        <button
          type="submit"
          disabled={!tokenSchema.safeParse(token.value).success}
        >
          Reconnect
        </button>
      </form>
    </main>
  );
}
render(<App />, document.getElementById('app')!);
requestSettings(false);
