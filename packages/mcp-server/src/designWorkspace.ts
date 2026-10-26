import { constants } from 'node:fs';
import {
  lstat,
  mkdir,
  open,
  readdir,
  realpath,
  rename,
  unlink,
} from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import {
  MagicUiError,
  failure,
  initializeProjectSchema,
  projectMetadataSchema,
  migrateDesignSpecification,
  stableIdSchema,
  MAX_MESSAGE_BYTES,
  componentRegistrySchema,
  type ComponentRegistry,
  syncStatesSchema,
  syncJournalsSchema,
} from '@magic-ui/shared';

export class DesignWorkspace {
  constructor(readonly allowedRoot: string) {}
  private async root() {
    const root = resolve(this.allowedRoot);
    // The configured root must already exist; never follow a root symlink.
    if (!(await lstat(root)).isDirectory() || (await realpath(root)) !== root)
      throw new MagicUiError(
        failure(
          'WORKSPACE_ERROR',
          'Workspace root must be an existing canonical directory.',
        ),
      );
    return root;
  }
  private async readJson(path: string, limit = MAX_MESSAGE_BYTES) {
    const handle = await open(
      path,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > limit)
        throw new MagicUiError(
          failure(
            'MESSAGE_TOO_LARGE',
            'Workspace JSON must be a regular file of at most 65536 bytes.',
          ),
        );
      const buffer = Buffer.alloc(limit + 1);
      let total = 0;
      while (total < buffer.length) {
        const { bytesRead } = await handle.read(
          buffer,
          total,
          buffer.length - total,
          null,
        );
        if (!bytesRead) break;
        total += bytesRead;
      }
      if (total > limit)
        throw new MagicUiError(
          failure('MESSAGE_TOO_LARGE', 'Workspace JSON exceeds 65536 bytes.'),
        );
      return JSON.parse(buffer.subarray(0, total).toString('utf8')) as unknown;
    } finally {
      await handle.close();
    }
  }
  private initializing = false;
  async initialize(input: unknown) {
    if (this.initializing)
      throw new MagicUiError(
        failure(
          'WORKSPACE_ERROR',
          'Project initialization is already in progress. Retry when it finishes.',
          true,
        ),
      );
    this.initializing = true;
    try {
      return await this.initializeProject(input);
    } finally {
      this.initializing = false;
    }
  }
  private async initializeProject(input: unknown) {
    const { projectId, projectName } = initializeProjectSchema.parse(input);
    const root = await this.root();
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.endsWith('-Design')) continue;
      try {
        const metadata = projectMetadataSchema.parse(
          await this.readJson(join(root, entry.name, 'project.json')),
        );
        if (metadata.projectId === projectId)
          throw new MagicUiError(
            failure('WORKSPACE_ERROR', 'Project ID already exists.'),
          );
      } catch (error) {
        if (error instanceof MagicUiError) throw error;
      }
    }
    const directory = join(root, `${projectName}-Design`);
    await mkdir(directory); // Exclusive: an existing directory is never overwritten.
    const write = async (name: string, data: unknown) => {
      const handle = await open(
        join(directory, name),
        constants.O_WRONLY |
          constants.O_CREAT |
          constants.O_EXCL |
          constants.O_NOFOLLOW,
        0o600,
      );
      try {
        await handle.writeFile(JSON.stringify(data, null, 2) + '\n');
      } finally {
        await handle.close();
      }
    };
    await write('project.json', {
      schemaVersion: '1.0.0',
      projectId,
      projectName,
    });
    await write('design-spec.json', {
      schemaVersion: '1.0.0',
      projectId,
      pages: [],
    });
    return {
      projectId,
      directory,
      specificationPath: join(directory, 'design-spec.json'),
    };
  }
  private async projectDirectory(projectId: string) {
    stableIdSchema.parse(projectId);
    const root = await this.root();
    const matches: string[] = [];
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.endsWith('-Design')) continue;
      const directory = join(root, entry.name);
      if ((await realpath(directory)) !== directory)
        throw new MagicUiError(
          failure('WORKSPACE_ERROR', 'Project symlinks are not allowed.'),
        );
      let metadata;
      try {
        metadata = projectMetadataSchema.parse(
          await this.readJson(join(directory, 'project.json')),
        );
      } catch {
        continue;
      }
      if (metadata.projectId === projectId) matches.push(directory);
    }
    if (matches.length !== 1)
      throw new MagicUiError(
        failure(
          'PROJECT_NOT_FOUND',
          'Expected exactly one project with that ID inside the allowed workspace.',
        ),
      );
    return matches[0]!;
  }
  async readSpecification(projectId: string) {
    const directory = await this.projectDirectory(projectId);
    const spec = migrateDesignSpecification(
      await this.readJson(join(directory, 'design-spec.json')),
    );
    if (spec.projectId !== projectId)
      throw new MagicUiError(
        failure(
          'INVALID_INPUT',
          'Project metadata and specification IDs differ.',
        ),
      );
    return spec;
  }
  private async registryDirectory(projectId: string, create = false) {
    const directory = join(
      await this.projectDirectory(projectId),
      'design-system',
    );
    if (create) await mkdir(directory, { recursive: true });
    const stat = await lstat(directory);
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      (await realpath(directory)) !== directory
    )
      throw new MagicUiError(
        failure('WORKSPACE_ERROR', 'Registry directory must not be a symlink.'),
      );
    return directory;
  }
  async readRegistry(projectId: string): Promise<ComponentRegistry> {
    try {
      const result = componentRegistrySchema.parse(
        await this.readJson(
          join(await this.registryDirectory(projectId), 'components.json'),
        ),
      );
      if (result.projectId !== projectId)
        throw new Error('Registry project mismatch');
      return result;
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      )
        return { projectId, components: [] };
      throw error;
    }
  }
  async writeRegistry(registry: ComponentRegistry) {
    const parsed = componentRegistrySchema.parse(registry);
    const directory = await this.registryDirectory(parsed.projectId, true);
    const destination = join(directory, 'components.json');
    try {
      const stat = await lstat(destination);
      if (!stat.isFile() || stat.isSymbolicLink())
        throw new Error('Registry must be a regular file');
    } catch (e) {
      if (!(e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT'))
        throw e;
    }
    const data = JSON.stringify(parsed, null, 2) + '\n';
    if (Buffer.byteLength(data) > MAX_MESSAGE_BYTES)
      throw new MagicUiError(
        failure('MESSAGE_TOO_LARGE', 'Registry exceeds workspace limit.'),
      );
    const temporary = join(directory, `.components-${randomUUID()}.json`);
    const handle = await open(
      temporary,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
    try {
      await handle.writeFile(data);
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await rename(temporary, destination);
    } finally {
      await unlink(temporary).catch(() => {});
    }
  }
  async readSyncData(projectId: string) {
    return syncStatesSchema.parse(
      (await this.readRecoveryFile(projectId, 'sync-state.json')) ?? {
        screens: [],
      },
    );
  }
  async readJournals(projectId: string) {
    return syncJournalsSchema.parse(
      (await this.readRecoveryFile(projectId, 'design-progress.json')) ?? {
        operations: [],
      },
    );
  }
  private async readRecoveryFile(projectId: string, filename: string) {
    const directory = await this.projectDirectory(projectId);
    try {
      return await this.readJson(join(directory, filename), 8 * 1024 * 1024);
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      )
        return undefined;
      throw error;
    }
  }
  async writeRecoveryFile(
    projectId: string,
    filename: 'sync-state.json' | 'design-progress.json',
    value: unknown,
  ) {
    const parsed =
      filename === 'sync-state.json'
        ? syncStatesSchema.parse(value)
        : syncJournalsSchema.parse(value);
    const directory = await this.projectDirectory(projectId);
    const destination = join(directory, filename);
    try {
      const stat = await lstat(destination);
      if (!stat.isFile() || stat.isSymbolicLink())
        throw new Error('Recovery file must be a regular file.');
    } catch (error) {
      if (!(
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      ))
        throw error;
    }
    const data = JSON.stringify(parsed) + '\n';
    if (Buffer.byteLength(data) > 8 * 1024 * 1024)
      throw new MagicUiError(
        failure(
          'MESSAGE_TOO_LARGE',
          'Recovery history exceeds 8 MiB. Archive completed operations explicitly.',
        ),
      );
    const temporary = join(directory, `.recovery-${randomUUID()}.json`);
    const handle = await open(
      temporary,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
    try {
      await handle.writeFile(data);
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await rename(temporary, destination);
    } finally {
      await unlink(temporary).catch(() => {});
    }
  }
}
