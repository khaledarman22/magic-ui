import {
  MagicUiError,
  failure,
  nodeSnapshotSchema,
  type Command,
  type CommandResult,
  type NodeSnapshot,
} from '@magic-ui/shared';

export function readNodeSnapshot(node: BaseNode): NodeSnapshot {
  return nodeSnapshotSchema.parse({
    nodeId: node.id,
    name: node.name,
    type: node.type,
    parentId: node.parent?.id ?? null,
    ...('x' in node
      ? { x: node.x, y: node.y, width: node.width, height: node.height }
      : {}),
  });
}
export async function executePluginCommand(
  command: Command,
  isCancelled: () => boolean,
): Promise<CommandResult> {
  if (isCancelled())
    throw new MagicUiError(failure('CANCELLED', 'Request cancelled.'));
  switch (command.command) {
    case 'ping':
      return { command: 'ping', result: { alive: true } };
    case 'createFrame': {
      const { pageId, name, width, height, x, y } = command.input;
      if (figma.currentPage.id !== pageId)
        throw new MagicUiError(
          failure(
            'PAGE_CHANGED',
            'The requested page is not the active page. Reconnect and read connection status again.',
          ),
        );
      // No asynchronous gap between target validation and this bounded write.
      const frame = figma.createFrame();
      frame.name = name;
      frame.resize(width, height);
      frame.x = x;
      frame.y = y;
      return {
        command: 'createFrame',
        result: { ...readNodeSnapshot(frame), type: 'FRAME' },
      };
    }
    case 'readNode': {
      const node = await figma.getNodeByIdAsync(command.input.nodeId);
      if (isCancelled())
        throw new MagicUiError(failure('CANCELLED', 'Request cancelled.'));
      if (!node)
        throw new MagicUiError(
          failure(
            'NODE_NOT_FOUND',
            'No node with that ID exists in this Figma document.',
          ),
        );
      return { command: 'readNode', result: readNodeSnapshot(node) };
    }
  }
}
