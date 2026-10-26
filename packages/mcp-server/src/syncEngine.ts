import { randomUUID } from 'node:crypto';
import {
  classifySync,
  flattenScreen,
  MagicUiError,
  failure,
  type SyncScope,
  type SyncToolInput,
  type SyncLive,
  type SyncState,
  type SyncJournal,
  type SyncReport,
  type DesignSpecification,
} from '@magic-ui/shared';
import type { BridgeServer } from './bridgeServer.js';
import type { DesignWorkspace } from './designWorkspace.js';

export class SyncEngine {
  private busy = false;
  constructor(
    private bridge: BridgeServer,
    private workspace: DesignWorkspace,
  ) {}
  private async exclusive<T>(action: () => Promise<T>) {
    if (this.busy)
      throw new MagicUiError(
        failure('SESSION_BUSY', 'Another workspace write is running.', true),
      );
    this.busy = true;
    try {
      return await action();
    } finally {
      this.busy = false;
    }
  }
  private async inspect(
    sessionId: string,
    scope: SyncScope,
    signal: AbortSignal,
    localId?: string,
  ) {
    const response = await this.bridge.request(
      sessionId,
      {
        command: 'inspectSync',
        input: { ...scope, ...(localId ? { localId } : {}) },
      },
      signal,
    );
    if (response.command !== 'inspectSync')
      throw new Error('Unexpected sync response');
    return response.result;
  }
  private entries(spec: DesignSpecification, screenId: string) {
    const screen = spec.pages
      .flatMap((p) => p.screens)
      .find((s) => s.id === screenId);
    if (!screen)
      throw new MagicUiError(failure('INVALID_INPUT', 'Screen not found.'));
    return {
      screen,
      entries: flattenScreen(screen, spec.tokens).map((entry) => ({
        ...entry,
        specification:
          'nodes' in entry.specification
            ? { ...entry.specification, nodes: [] }
            : entry.specification,
      })),
    };
  }
  private async context(
    input: SyncToolInput,
    signal: AbortSignal,
    spec?: DesignSpecification,
  ) {
    const scope = {
      projectId: input.projectId,
      pageId: input.pageId,
      screenId: input.screenId,
    };
    const specification =
      spec ?? (await this.workspace.readSpecification(scope.projectId));
    const { screen, entries } = this.entries(specification, scope.screenId);
    const stateFile = await this.workspace.readSyncData(scope.projectId);
    const state = stateFile.screens.find((s) => s.screenId === scope.screenId);
    const scan = await this.inspect(input.sessionId, scope, signal);
    if (
      state &&
      (state.documentId !== scan.documentId || state.pageId !== scope.pageId)
    )
      throw new MagicUiError(
        failure('DRIFT_DETECTED', 'Project is bound to another document/page.'),
      );
    const desired = new Map(entries.map((e) => [e.id, e]));
    const ids = new Set([
      ...desired.keys(),
      ...scan.nodes.map((n) => n.localId),
      ...(state?.nodes.map((n) => n.localId) ?? []),
    ]);
    const lives = new Map<string, SyncLive>();
    for (const id of ids) {
      const item = await this.inspect(input.sessionId, scope, signal, id);
      if (item.documentId !== scan.documentId)
        throw new MagicUiError(
          failure(
            'DRIFT_DETECTED',
            'Document binding changed during inspection.',
          ),
        );
      if (item.live) lives.set(id, item.live);
    }
    const report: SyncReport = {
      status: 'preview',
      completedSteps: 0,
      totalSteps: entries.length,
      operations: [],
    };
    for (const id of ids) {
      const entry = desired.get(id),
        live = lives.get(id),
        baseline = state?.nodes.find((n) => n.localId === id);
      const status = classifySync(
        entry?.intent,
        baseline?.intent ?? live?.intent,
        live?.snapshot,
        baseline?.snapshot ?? (live?.baseline || undefined),
      );
      const decision = input.decisions.find((d) => d.localId === id)?.decision;
      let action: SyncReport['operations'][number]['action'] = 'skip';
      if (entry && !live?.trashed) {
        if (decision === 'keep-figma' && live) action = 'keep-figma';
        else if (decision === 'apply-spec' || status === 'spec-changed')
          action = live ? 'update' : 'create';
      }
      report.operations.push({
        localId: id,
        figmaNodeId: live?.figmaNodeId ?? null,
        status,
        action,
        reason: live?.trashed
          ? 'Identity is in Trash; explicitly restore it first.'
          : decision
            ? `Explicit ${decision}`
            : status === 'missing-in-figma'
              ? 'Creation/recreation requires render or explicit apply-spec.'
              : status,
      });
    }
    if (
      new Set(input.decisions.map((d) => d.localId)).size !==
        input.decisions.length ||
      input.decisions.some((d) => !desired.has(d.localId))
    )
      throw new MagicUiError(
        failure(
          'INVALID_INPUT',
          'Decisions must uniquely identify nodes in this screen specification.',
        ),
      );
    return {
      scope,
      specification,
      screen,
      entries,
      stateFile,
      state,
      scan,
      lives,
      report,
    };
  }
  async preview(input: SyncToolInput, signal: AbortSignal) {
    return (await this.context(input, signal)).report;
  }
  async run(
    input: SyncToolInput,
    signal: AbortSignal,
    kind: 'render' | 'apply' = 'apply',
    progress?: (done: number, total: number) => Promise<void>,
  ) {
    return this.exclusive(async () => {
      const journals = await this.workspace.readJournals(input.projectId);
      let journal = input.operationId
        ? journals.operations.find((o) => o.operationId === input.operationId)
        : undefined;
      if (
        journal &&
        (journal.scope.screenId !== input.screenId ||
          journal.scope.pageId !== input.pageId)
      )
        throw new MagicUiError(
          failure('INVALID_INPUT', 'Operation scope cannot be changed.'),
        );
      if (!journal && journals.operations.some((o) => o.status !== 'completed'))
        throw new MagicUiError(
          failure(
            'SESSION_BUSY',
            'Resume the interrupted operation before starting another one.',
          ),
        );
      const decisions = new Map(
        (journal?.decisions ?? []).map((d) => [d.localId, d]),
      );
      input.decisions.forEach((d) => decisions.set(d.localId, d));
      const context = await this.context(
        { ...input, decisions: [...decisions.values()] },
        signal,
        journal?.specification,
      );
      const {
        scope,
        specification,
        screen,
        entries,
        stateFile,
        scan,
        lives,
        report,
      } = context;
      const resuming = Boolean(journal);
      kind = journal?.kind ?? kind;
      if (
        kind === 'render' &&
        !resuming &&
        report.operations.some(
          (r) =>
            ['figma-changed', 'conflict'].includes(r.status) &&
            !decisions.has(r.localId),
        )
      )
        throw new MagicUiError(
          failure(
            'DRIFT_DETECTED',
            'Render found manual changes. Use preview/apply with per-node decisions.',
          ),
        );
      if (journal && journal.documentId !== scan.documentId && scan.documentId)
        throw new MagicUiError(
          failure('DRIFT_DETECTED', 'Journal belongs to another document.'),
        );
      if (!journal) {
        journal = {
          operationId: input.operationId ?? randomUUID(),
          scope,
          specification,
          decisions: [...decisions.values()],
          kind,
          documentId:
            context.state?.documentId ?? (scan.documentId || randomUUID()),
          status: 'running',
          steps: [],
          report,
        };
        journals.operations.push(journal);
      }
      journal.decisions = [...decisions.values()];
      journal.status = 'running';
      journal.report = {
        ...report,
        operationId: journal.operationId,
        status: 'interrupted',
      };
      const state: SyncState = context.state ?? {
        ...scope,
        documentId: journal.documentId,
        nodes: [],
      };
      if (!context.state) stateFile.screens.push(state);
      const saveJournal = () =>
        this.workspace.writeRecoveryFile(
          input.projectId,
          'design-progress.json',
          journals,
        );
      const saveState = () =>
        this.workspace.writeRecoveryFile(
          input.projectId,
          'sync-state.json',
          stateFile,
        );
      await saveJournal();
      try {
        for (const entry of entries) {
          if (signal.aborted)
            throw new MagicUiError(
              failure('CANCELLED', 'Stopped after the previous durable step.'),
            );
          const row = journal.report.operations.find(
            (r) => r.localId === entry.id,
          )!;
          let live = lives.get(entry.id);
          const prior = journal.steps.find((s) => s.localId === entry.id);
          // A response may have been lost after the plugin committed. Verify its
          // live guard and intent, never trust local "done" alone.
          const explicitNow = input.decisions.some((d) => d.localId === entry.id);
          const committed =
            !explicitNow && live?.operationId === journal.operationId &&
            live.intent === entry.intent &&
            live.snapshot === live.baseline;
          if (committed) {
            row.action = 'skip';
            row.status = 'in-sync';
          } else if (
            kind === 'render' &&
            row.status === 'missing-in-figma' &&
            !context.state?.nodes.some((n) => n.localId === entry.id) &&
            !prior
          )
            row.action = 'create';
          // A missing checkpointed node is a user deletion, not an implicit retry.
          if (resuming && prior && !live && !explicitNow) {
            row.action = 'skip';
            row.reason =
              'Node disappeared during interruption; explicit apply-spec required.';
          }
          if (resuming && prior && !explicitNow && !committed && (live?.snapshot ?? null) !== prior.before && (live?.snapshot ?? null) !== prior.after) {
            row.action = 'skip'; row.reason = 'New drift after the saved decision; a fresh per-node decision is required.';
          }
          if (!scan.documentId && live && row.status === 'in-sync') row.action = 'keep-figma';
          const step = prior ?? {
            localId: entry.id,
            status: 'pending' as const,
            before: live?.snapshot ?? null,
            after: null,
          };
          if (!prior) journal.steps.push(step);
          step.status = 'pending';
          step.before = live?.snapshot ?? null;
          step.after = null;
          await saveJournal();
          if (row.action !== 'skip') {
            // Re-read immediately before sending the optimistic write.
            const fresh = (
              await this.inspect(input.sessionId, scope, signal, entry.id)
            ).live;
            if (
              (fresh?.snapshot ?? null) !== (live?.snapshot ?? null) ||
              (fresh?.figmaNodeId ?? null) !== (live?.figmaNodeId ?? null)
            )
              throw new MagicUiError(
                failure(
                  'DRIFT_DETECTED',
                  'Node changed after preview; resume to inspect it again.',
                ),
              );
            // Once dispatched, finish the bounded step and persist its result.
            // Cancellation is checked between steps, not during a Figma mutation.
            const response = await this.bridge.request(
              input.sessionId,
              {
                command: 'syncStep',
                input: {
                  ...scope,
                  documentId: journal.documentId,
                  operationId: journal.operationId,
                  entry,
                  tokens: specification.tokens,
                  direction: screen.direction,
                  specVersion: specification.schemaVersion,
                  expectedNodeId: live?.figmaNodeId ?? null,
                  expectedSnapshot: live?.snapshot ?? null,
                  action:
                    row.action === 'keep-figma' ? 'keep-figma' : 'apply-spec',
                },
              },
              new AbortController().signal,
            );
            if (response.command !== 'syncStep')
              throw new Error('Unexpected step result');
            live = response.result;
            lives.set(entry.id, live);
          }
          if (
            live &&
            (row.action !== 'skip' || committed || row.status === 'in-sync')
          ) {
            const previous = state.nodes.find((n) => n.localId === entry.id);
            const record = {
              localId: entry.id,
              figmaNodeId: live.figmaNodeId,
              specVersion: specification.schemaVersion,
              lastSyncedHash: live.ownedHash,
              intent: entry.intent,
              snapshot: live.snapshot,
              ...(row.action === 'keep-figma'
                ? {
                    drift: JSON.stringify({
                      desiredIntent: entry.intent,
                      acceptedFigma: live.snapshot,
                    }),
                  }
                : previous?.drift
                  ? { drift: previous.drift }
                  : {}),
            };
            state.nodes = [
              ...state.nodes.filter((n) => n.localId !== entry.id),
              record,
            ];
            await saveState();
          }
          step.status =
            row.action === 'skip' && !committed ? 'skipped' : 'done';
          step.after = live?.snapshot ?? null;
          journal.report.completedSteps++;
          await saveJournal();
          await progress?.(journal.report.completedSteps, entries.length);
        }
        journal.status = 'completed';
        journal.report.status = 'completed';
        await saveJournal();
        return journal.report;
      } catch (error) {
        journal.status = 'interrupted';
        journal.report.status = 'interrupted';
        await saveJournal();
        if (error instanceof MagicUiError)
          throw new MagicUiError({
            ...error.error,
            details: {
              operationId: journal.operationId,
              completedSteps: journal.report.completedSteps,
            },
          });
        throw error;
      }
    });
  }
  async resume(
    sessionId: string,
    projectId: string,
    operationId: string,
    decisions: SyncToolInput['decisions'],
    signal: AbortSignal,
    progress?: (done: number, total: number) => Promise<void>,
  ) {
    const journal = (
      await this.workspace.readJournals(projectId)
    ).operations.find((o) => o.operationId === operationId);
    if (!journal)
      throw new MagicUiError(failure('INVALID_INPUT', 'Unknown operation ID.'));
    return this.run(
      { ...journal.scope, sessionId, operationId, decisions },
      signal,
      journal.kind,
      progress,
    );
  }
  async render(
    input: SyncToolInput,
    signal: AbortSignal,
    progress?: (done: number, total: number) => Promise<void>,
  ) {
    const report = await this.run(input, signal, 'render', progress);
    const context = await this.context(input, signal);
    const mapping = context.entries.flatMap((e) => {
      const n = context.lives.get(e.id);
      return n ? [{ id: e.id, nodeId: n.figmaNodeId }] : [];
    });
    const orphanedNodes = context.report.operations
      .filter((r) => r.status === 'orphaned' && r.figmaNodeId)
      .map((r) => ({ id: r.localId, nodeId: r.figmaNodeId! }));
    return {
      operationId: report.operationId,
      nodeCount: mapping.length,
      mapping,
      created: report.operations.filter((r) => r.action === 'create').length,
      updated: report.operations.filter((r) => r.action === 'update').length,
      unchanged: report.operations.filter((r) => r.status === 'in-sync').length,
      orphaned: orphanedNodes.length,
      orphanedNodes,
    };
  }
  async trash(
    input: SyncScope & { sessionId: string; localId: string; reason?: string },
    restore: boolean,
    signal: AbortSignal,
  ) {
    return this.exclusive(async () => {
      const scope = {
        projectId: input.projectId,
        screenId: input.screenId,
        pageId: input.pageId,
      };
      const context = await this.context(
        { ...scope, sessionId: input.sessionId, decisions: [] },
        signal,
      );
      if (!restore && context.entries.some((e) => e.id === input.localId))
        throw new MagicUiError(
          failure('INVALID_INPUT', 'Only orphaned identities may enter Trash.'),
        );
      const item = context.lives.get(input.localId);
      if (!item)
        throw new MagicUiError(
          failure('NODE_NOT_FOUND', 'Owned identity not found.'),
        );
      // Do not move descendants still present in the spec with an orphan parent.
      if (!restore)
        for (const entry of context.entries) {
          const actual = context.lives.get(entry.id);
          if (
            actual &&
            JSON.parse(actual.snapshot).parentId === item.figmaNodeId
          )
            throw new MagicUiError(
              failure(
                'DRIFT_DETECTED',
                'Container still contains a specified child.',
              ),
            );
        }
      const result = await this.bridge.request(
        input.sessionId,
        {
          command: 'trashNode',
          input: {
            ...scope,
            localId: input.localId,
            reason: input.reason ?? '',
            restore,
            expectedNodeId: item.figmaNodeId,
            expectedSnapshot: item.snapshot,
          },
        },
        signal,
      );
      if (result.command !== 'trashNode')
        throw new Error('Unexpected Trash result');
      return result.result;
    });
  }
}
