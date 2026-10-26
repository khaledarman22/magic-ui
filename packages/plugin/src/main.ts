import {
  uiToMainSchema,
  MAX_MESSAGE_BYTES,
  utf8ByteLength,
  mainToUiSchema,
  tokenSchema,
  MagicUiError,
  failure,
  envelope,
  type MainToUi,
} from '@magic-ui/shared';
import { resetReaderSnapshots } from './figmaReader';
import { executePluginCommand } from './pluginCommandHandlers';

figma.showUI(__html__, { width: 360, height: 400, themeColors: true });
let readOnly = true;
let sessionId: string | undefined;
const active = new Map<string, { cancelled: boolean }>();
const post = (message: MainToUi) => {
  if (
    message.kind === 'bridge' &&
    utf8ByteLength(JSON.stringify(message.message)) > MAX_MESSAGE_BYTES
  ) {
    const incoming = message.message;
    figma.ui.postMessage(
      mainToUiSchema.parse({
        kind: 'bridge',
        message: envelope(
          'error',
          incoming.sessionId,
          incoming.correlationId,
          failure(
            'MESSAGE_TOO_LARGE',
            'The response exceeds the 65536-byte bridge limit. Writes may have completed; inspect Figma before retrying.',
          ),
        ),
      }),
    );
    return;
  }
  figma.ui.postMessage(mainToUiSchema.parse(message));
};
async function sendSettings(correlationId: string) {
  const stored: unknown = await figma.clientStorage.getAsync(
    'magicUiSessionToken',
  );
  const parsed = tokenSchema.safeParse(stored);
  post({
    kind: 'settings',
    correlationId,
    token: parsed.success ? parsed.data : null,
    document: {
      name: figma.root.name,
      pageId: figma.currentPage.id,
      pageName: figma.currentPage.name,
    },
  });
}
figma.ui.onmessage = async (raw: unknown) => {
  const parsed = uiToMainSchema.safeParse(raw);
  if (!parsed.success) return;
  const message = parsed.data;
  if (message.kind !== 'bridge') {
    try {
      if (message.kind === 'saveToken')
        await figma.clientStorage.setAsync(
          'magicUiSessionToken',
          message.token,
        );
      await sendSettings(message.correlationId);
    } catch {
      post({
        kind: 'localError',
        correlationId: message.correlationId,
        message:
          'Could not access saved credentials. Reopen Magic UI and try again.',
      });
    }
    return;
  }
  const incoming = message.message;
  if (incoming.type === 'ready') {
    for (const entry of active.values()) entry.cancelled = true;
    sessionId = incoming.sessionId;
    readOnly = incoming.payload.readOnly;
    resetReaderSnapshots();
    return;
  }
  if (incoming.sessionId !== sessionId) return;
  if (incoming.type === 'cancel') {
    const entry = active.get(incoming.correlationId);
    if (entry) entry.cancelled = true;
    return;
  }
  if (incoming.type !== 'command' || active.has(incoming.correlationId)) return;
  const entry = { cancelled: false };
  active.set(incoming.correlationId, entry);
  try {
    const result = await executePluginCommand(
      incoming.payload,
      () => entry.cancelled,
      readOnly,
    );
    post({
      kind: 'bridge',
      message: envelope(
        'result',
        incoming.sessionId,
        incoming.correlationId,
        result,
      ),
    });
  } catch (error) {
    const detail =
      error instanceof MagicUiError
        ? error.error
        : failure(
            'INTERNAL_ERROR',
            'Figma could not complete the command. Inspect the document before retrying.',
          );
    post({
      kind: 'bridge',
      message: envelope(
        'error',
        incoming.sessionId,
        incoming.correlationId,
        detail,
      ),
    });
  } finally {
    active.delete(incoming.correlationId);
  }
};
