/**
 * Las 5 funciones que efectivamente llaman a la API real de GitHub vía
 * Octokit. Cada una recibe el `octokit` como parámetro (inyección de
 * dependencias — nunca crean su propio cliente), y devuelven un DTO chico
 * y estable, nunca la respuesta cruda de GitHub.
 */
import type { Octokit } from '@octokit/rest';
import type {
  CreateRepositoryInput,
  CreateIssueInput,
  ListRepositoriesInput,
  CreateCommitInput,
  ListIssuesInput,
} from '../schemas/index.js';
import type { RepoDTO, IssueDTO, CommitResultDTO } from '../types.js';

// Tipos locales: solo los campos de la respuesta de GitHub que a este
// archivo le importan (la respuesta real trae muchos más campos).
type RepoApiData = {
  full_name: string;
  html_url: string;
  private: boolean;
  description: string | null;
  owner: { login: string };
};

type IssueApiData = {
  number: number;
  title: string;
  state: string;
  html_url: string;
  // GitHub modela los PRs como un caso especial de issue; este campo
  // aparece cuando el "issue" en realidad es un pull request.
  pull_request?: unknown;
};

/** Traduce la forma "GitHub" (snake_case, anidada) a la forma "nuestra" (camelCase, plana). */
function toRepoDTO(data: RepoApiData): RepoDTO {
  return {
    fullName: data.full_name,
    htmlUrl: data.html_url,
    private: data.private,
    description: data.description,
    ownerLogin: data.owner.login,
  };
}

/** Traduce un issue crudo de GitHub a IssueDTO. */
function toIssueDTO(data: IssueApiData): IssueDTO {
  return {
    number: data.number,
    title: data.title,
    state: data.state,
    htmlUrl: data.html_url,
  };
}

/** Crea un repositorio nuevo bajo la cuenta autenticada. */
export async function createRepository(octokit: Octokit, input: CreateRepositoryInput): Promise<RepoDTO> {
  const { data } = await octokit.repos.createForAuthenticatedUser({
    name: input.name,
    description: input.description,
    private: input.private,
  });
  return toRepoDTO(data);
}

/** Lista los repositorios del usuario autenticado, con filtros de tipo/orden/paginación. */
export async function listRepositories(octokit: Octokit, input: ListRepositoriesInput): Promise<RepoDTO[]> {
  const { data } = await octokit.repos.listForAuthenticatedUser({
    type: input.type,
    sort: input.sort,
    per_page: input.per_page,
  });
  return data.map(toRepoDTO);
}

/** Abre un issue nuevo en un repositorio existente. */
export async function createIssue(octokit: Octokit, input: CreateIssueInput): Promise<IssueDTO> {
  const { data } = await octokit.issues.create({
    owner: input.owner,
    repo: input.repo,
    title: input.title,
    body: input.body,
  });
  return toIssueDTO(data);
}

/**
 * Lista los issues de un repo. GitHub mezcla issues y pull requests en el
 * mismo endpoint, así que se filtran los que tienen `pull_request` (no son
 * issues "de verdad") antes de mapear a DTO.
 */
export async function listIssues(octokit: Octokit, input: ListIssuesInput): Promise<IssueDTO[]> {
  const { data } = await octokit.issues.listForRepo({
    owner: input.owner,
    repo: input.repo,
    state: input.state,
    per_page: input.per_page,
  });
  return data.filter((issue) => !('pull_request' in issue && issue.pull_request)).map(toIssueDTO);
}

/**
 * Crea (o actualiza) un archivo mediante el flujo de 6 pasos de la API de Git
 * de GitHub: getRef -> getCommit -> createBlob -> createTree -> createCommit
 * -> updateRef. Cada paso necesita el resultado (un SHA) del paso anterior.
 * Si falla antes del updateRef, los objetos intermedios quedan huérfanos
 * pero el repo visible no se ve afectado (atomicidad de facto): el paso que
 * "publica" el cambio es siempre el último.
 */
export async function createCommitWithFile(
  octokit: Octokit,
  input: CreateCommitInput,
): Promise<CommitResultDTO> {
  const { owner, repo, branch, path, content, message } = input;

  // Paso 1: ¿cuál es el commit actual de la rama? Se guarda su SHA como
  // "padre" del commit nuevo (paso 5).
  const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
  const baseCommitSha = refData.object.sha;

  // Paso 2: traer el árbol de archivos (tree) de ese commit base.
  const { data: baseCommit } = await octokit.git.getCommit({ owner, repo, commit_sha: baseCommitSha });

  // Paso 3: subir el contenido nuevo como un blob (contenido puro, sin
  // nombre ni ubicación). La API de Git exige el contenido en base64.
  const { data: blobData } = await octokit.git.createBlob({
    owner,
    repo,
    content: Buffer.from(content, 'utf8').toString('base64'),
    encoding: 'base64',
  });

  // Paso 4: armar un árbol nuevo. base_tree reutiliza el árbol anterior
  // (paso 2) para no tener que redeclarar todos los demás archivos del repo.
  // mode "100644" = archivo normal, no ejecutable.
  const { data: treeData } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseCommit.tree.sha,
    tree: [{ path, mode: '100644', type: 'blob', sha: blobData.sha }],
  });

  // Paso 5: crear el objeto commit, apuntando al árbol nuevo y declarando
  // como padre al commit que había antes.
  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message,
    tree: treeData.sha,
    parents: [baseCommitSha],
  });

  // Paso 6, el que "publica" el cambio de verdad: mueve el puntero de la
  // rama al commit nuevo. force: false evita sobrescribir el historial si
  // la rama avanzó (otro commit) mientras corrían los pasos 1-5.
  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: newCommit.sha,
    force: false,
  });

  return {
    commitSha: newCommit.sha,
    commitUrl: `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`,
  };
}
