import type { Octokit } from '@octokit/rest';
import type {
  CreateRepositoryInput,
  CreateIssueInput,
  ListRepositoriesInput,
  CreateCommitInput,
  ListIssuesInput,
} from '../schemas/index.js';
import type { RepoDTO, IssueDTO, CommitResultDTO } from '../types.js';

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
  pull_request?: unknown;
};

function toRepoDTO(data: RepoApiData): RepoDTO {
  return {
    fullName: data.full_name,
    htmlUrl: data.html_url,
    private: data.private,
    description: data.description,
    ownerLogin: data.owner.login,
  };
}

function toIssueDTO(data: IssueApiData): IssueDTO {
  return {
    number: data.number,
    title: data.title,
    state: data.state,
    htmlUrl: data.html_url,
  };
}

export async function createRepository(octokit: Octokit, input: CreateRepositoryInput): Promise<RepoDTO> {
  const { data } = await octokit.repos.createForAuthenticatedUser({
    name: input.name,
    description: input.description,
    private: input.private,
  });
  return toRepoDTO(data);
}

export async function listRepositories(octokit: Octokit, input: ListRepositoriesInput): Promise<RepoDTO[]> {
  const { data } = await octokit.repos.listForAuthenticatedUser({
    type: input.type,
    sort: input.sort,
    per_page: input.per_page,
  });
  return data.map(toRepoDTO);
}

export async function createIssue(octokit: Octokit, input: CreateIssueInput): Promise<IssueDTO> {
  const { data } = await octokit.issues.create({
    owner: input.owner,
    repo: input.repo,
    title: input.title,
    body: input.body,
  });
  return toIssueDTO(data);
}

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
 * -> updateRef. Si falla antes del updateRef, los objetos intermedios quedan
 * huérfanos pero el repo no se ve afectado (atomicidad de facto).
 */
export async function createCommitWithFile(
  octokit: Octokit,
  input: CreateCommitInput,
): Promise<CommitResultDTO> {
  const { owner, repo, branch, path, content, message } = input;

  const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
  const baseCommitSha = refData.object.sha;

  const { data: baseCommit } = await octokit.git.getCommit({ owner, repo, commit_sha: baseCommitSha });

  const { data: blobData } = await octokit.git.createBlob({
    owner,
    repo,
    content: Buffer.from(content, 'utf8').toString('base64'),
    encoding: 'base64',
  });

  const { data: treeData } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseCommit.tree.sha,
    tree: [{ path, mode: '100644', type: 'blob', sha: blobData.sha }],
  });

  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message,
    tree: treeData.sha,
    parents: [baseCommitSha],
  });

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
