import { describe, it, expect } from 'vitest';
import {
  CreateRepositorySchema,
  CreateIssueSchema,
  ListRepositoriesSchema,
  ListIssuesSchema,
  CreateCommitSchema,
} from '../src/schemas/index.js';

describe('CreateRepositorySchema', () => {
  it('acepta un nombre válido y aplica el default de private', () => {
    const result = CreateRepositorySchema.safeParse({ name: 'mi-repo-valido' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.private).toBe(false);
    }
  });

  it('rechaza un nombre demasiado corto', () => {
    const result = CreateRepositorySchema.safeParse({ name: 'ab' });
    expect(result.success).toBe(false);
  });

  it('rechaza un nombre con espacios o caracteres inválidos', () => {
    const result = CreateRepositorySchema.safeParse({ name: 'mi repo invalido' });
    expect(result.success).toBe(false);
  });

  it('rechaza private con un tipo incorrecto', () => {
    const result = CreateRepositorySchema.safeParse({ name: 'repo-ok', private: 'yes' });
    expect(result.success).toBe(false);
  });
});

describe('CreateIssueSchema', () => {
  it('acepta un input válido completo', () => {
    const result = CreateIssueSchema.safeParse({ owner: 'acme', repo: 'infra', title: 'Bug en login' });
    expect(result.success).toBe(true);
  });

  it('rechaza si falta owner', () => {
    const result = CreateIssueSchema.safeParse({ repo: 'infra', title: 'Bug sin owner' });
    expect(result.success).toBe(false);
  });

  it('rechaza un título demasiado corto', () => {
    const result = CreateIssueSchema.safeParse({ owner: 'acme', repo: 'infra', title: 'Hi' });
    expect(result.success).toBe(false);
  });
});

describe('ListRepositoriesSchema', () => {
  it('aplica todos los defaults cuando no se manda nada', () => {
    const result = ListRepositoriesSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ type: 'all', sort: 'updated', per_page: 30 });
    }
  });

  it('rechaza un valor de sort fuera del enum', () => {
    const result = ListRepositoriesSchema.safeParse({ sort: 'popularity' });
    expect(result.success).toBe(false);
  });

  it('rechaza per_page fuera del límite de la API de GitHub (100)', () => {
    const result = ListRepositoriesSchema.safeParse({ per_page: 500 });
    expect(result.success).toBe(false);
  });
});

describe('ListIssuesSchema', () => {
  it('default de state es "open"', () => {
    const result = ListIssuesSchema.safeParse({ owner: 'acme', repo: 'infra' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.state).toBe('open');
    }
  });

  it('rechaza un state fuera del enum', () => {
    const result = ListIssuesSchema.safeParse({ owner: 'acme', repo: 'infra', state: 'opened' });
    expect(result.success).toBe(false);
  });
});

describe('CreateCommitSchema', () => {
  it('acepta un input válido y default de branch en "main"', () => {
    const result = CreateCommitSchema.safeParse({
      owner: 'acme',
      repo: 'infra',
      path: 'README.md',
      content: '# Hola',
      message: 'Actualiza README',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.branch).toBe('main');
    }
  });

  it('rechaza si falta el mensaje de commit', () => {
    const result = CreateCommitSchema.safeParse({
      owner: 'acme',
      repo: 'infra',
      path: 'README.md',
      content: '# Hola',
    });
    expect(result.success).toBe(false);
  });
});
