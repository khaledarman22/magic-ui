import {
  uiToMainSchema,
  mainToUiSchema,
  tokenSchema,
  MagicUiError,
  failure,
  envelope,
  type MainToUi,
} from '@magic-ui/shared';
import { executePluginCommand } from './pluginCommandHandlers';

figma.showUI(__html__, { width: 360, height: 400, themeColors: true });
let sessionId: string | undefined;
const active = new Map<string, { cancelled: boolean }>();
const post = (message: MainToUi) =>
  figma.ui.postMessage(mainToUiSchema.parse(message));
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
