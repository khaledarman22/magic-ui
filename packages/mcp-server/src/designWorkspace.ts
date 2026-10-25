import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  MagicUiError,
  failure,
  initializeProjectSchema,
  projectMetadataSchema,
  migrateDesignSpecification,
  stableIdSchema,
  MAX_MESSAGE_BYTES,
} from '@magic-ui/shared';

export class DesignWorkspace {
  constructor(private readonly allowedRoot: string) {}
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
  private async readJson(path: string) {
    const handle = await open(
      path,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > MAX_MESSAGE_BYTES)
        throw new MagicUiError(
          failure(
            'MESSAGE_TOO_LARGE',
            'Workspace JSON must be a regular file of at most 65536 bytes.',
          ),
        );
      const buffer = Buffer.alloc(MAX_MESSAGE_BYTES + 1);
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
      if (total > MAX_MESSAGE_BYTES)
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
  async readSpecification(projectId: string) {
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
    const spec = migrateDesignSpecification(
      await this.readJson(join(matches[0]!, 'design-spec.json')),
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
}
