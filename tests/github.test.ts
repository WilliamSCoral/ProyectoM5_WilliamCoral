import { describe, it, expect, vi } from 'vitest';
import type { Octokit } from '@octokit/rest';
import {
  createRepository,
  listRepositories,
  createIssue,
  listIssues,
  createCommitWithFile,
} from '../src/github/operations.js';

function makeFakeRepo(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    full_name: 'acme/infra',
    html_url: 'https://github.com/acme/infra',
    private: false,
    description: 'Infra repo',
    owner: { login: 'acme' },
    ...overrides,
  };
}

function makeFakeIssue(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    number: 42,
    title: 'Bug en login',
    state: 'open',
    html_url: 'https://github.com/acme/infra/issues/42',
    ...overrides,
  };
}

describe('createRepository', () => {
  it('mapea la respuesta de Octokit a RepoDTO', async () => {
    const octokit = {
      repos: {
        createForAuthenticatedUser: vi.fn().mockResolvedValue({ data: makeFakeRepo({ private: true }) }),
      },
    } as unknown as Octokit;

    const result = await createRepository(octokit, { name: 'infra', private: true });

    expect(octokit.repos.createForAuthenticatedUser).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'infra', private: true }),
    );
    expect(result).toEqual({
      fullName: 'acme/infra',
      htmlUrl: 'https://github.com/acme/infra',
      private: true,
      description: 'Infra repo',
      ownerLogin: 'acme',
    });
  });

  it('propaga el error si Octokit rechaza (ej. nombre ya existe)', async () => {
    const octokit = {
      repos: {
        createForAuthenticatedUser: vi.fn().mockRejectedValue(new Error('422 Unprocessable Entity')),
      },
    } as unknown as Octokit;

    await expect(createRepository(octokit, { name: 'infra', private: false })).rejects.toThrow(
      '422 Unprocessable Entity',
    );
  });
});

describe('listRepositories', () => {
  it('devuelve un array de RepoDTO mapeado', async () => {
    const octokit = {
      repos: {
        listForAuthenticatedUser: vi.fn().mockResolvedValue({ data: [makeFakeRepo(), makeFakeRepo({ full_name: 'acme/web' })] }),
      },
    } as unknown as Octokit;

    const result = await listRepositories(octokit, { type: 'all', sort: 'updated', per_page: 30 });

    expect(result).toHaveLength(2);
    expect(result[0].fullName).toBe('acme/infra');
    expect(result[1].fullName).toBe('acme/web');
  });
});

describe('createIssue', () => {
  it('mapea la respuesta de Octokit a IssueDTO', async () => {
    const octokit = {
      issues: {
        create: vi.fn().mockResolvedValue({ data: makeFakeIssue() }),
      },
    } as unknown as Octokit;

    const result = await createIssue(octokit, { owner: 'acme', repo: 'infra', title: 'Bug en login' });

    expect(octokit.issues.create).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'acme', repo: 'infra', title: 'Bug en login' }),
    );
    expect(result.number).toBe(42);
    expect(result.htmlUrl).toBe('https://github.com/acme/infra/issues/42');
  });
});

describe('listIssues', () => {
  it('filtra los pull requests del listado', async () => {
    const octokit = {
      issues: {
        listForRepo: vi.fn().mockResolvedValue({
          data: [makeFakeIssue(), makeFakeIssue({ number: 43, pull_request: {} })],
        }),
      },
    } as unknown as Octokit;

    const result = await listIssues(octokit, { owner: 'acme', repo: 'infra', state: 'open', per_page: 30 });

    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(42);
  });
});

describe('createCommitWithFile', () => {
  it('ejecuta el flujo de 6 pasos en orden y devuelve el resultado final', async () => {
    const octokit = {
      git: {
        getRef: vi.fn().mockResolvedValue({ data: { object: { sha: 'base-commit-sha' } } }),
        getCommit: vi.fn().mockResolvedValue({ data: { tree: { sha: 'base-tree-sha' } } }),
        createBlob: vi.fn().mockResolvedValue({ data: { sha: 'blob-sha' } }),
        createTree: vi.fn().mockResolvedValue({ data: { sha: 'new-tree-sha' } }),
        createCommit: vi.fn().mockResolvedValue({ data: { sha: 'new-commit-sha' } }),
        updateRef: vi.fn().mockResolvedValue({ data: {} }),
      },
    } as unknown as Octokit;

    const result = await createCommitWithFile(octokit, {
      owner: 'acme',
      repo: 'infra',
      branch: 'main',
      path: 'README.md',
      content: '# Hola mundo',
      message: 'Actualiza README',
    });

    expect(octokit.git.createBlob).toHaveBeenCalledWith(
      expect.objectContaining({ content: Buffer.from('# Hola mundo', 'utf8').toString('base64'), encoding: 'base64' }),
    );
    expect(octokit.git.createTree).toHaveBeenCalledWith(
      expect.objectContaining({ base_tree: 'base-tree-sha' }),
    );
    expect(octokit.git.createCommit).toHaveBeenCalledWith(
      expect.objectContaining({ tree: 'new-tree-sha', parents: ['base-commit-sha'] }),
    );
    expect(octokit.git.updateRef).toHaveBeenCalledWith(
      expect.objectContaining({ ref: 'heads/main', sha: 'new-commit-sha', force: false }),
    );
    expect(result).toEqual({
      commitSha: 'new-commit-sha',
      commitUrl: 'https://github.com/acme/infra/commit/new-commit-sha',
    });
  });
});
