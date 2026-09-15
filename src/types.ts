export interface RepoDTO {
  fullName: string;
  htmlUrl: string;
  private: boolean;
  description: string | null;
  ownerLogin: string;
}

export interface IssueDTO {
  number: number;
  title: string;
  state: string;
  htmlUrl: string;
}

export interface CommitResultDTO {
  commitSha: string;
  commitUrl: string;
}
