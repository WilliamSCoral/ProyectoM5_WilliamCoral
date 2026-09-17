/**
 * DTOs (Data Transfer Objects) compartidos: las formas "compactas" que
 * devuelven las operaciones de GitHub (src/github/operations.ts) a las
 * tools. Nunca son la respuesta cruda de la API de GitHub (que trae muchos
 * más campos) — son solo lo que el agente necesita para responder al usuario.
 */

/** Resultado de crear o listar un repositorio. */
export interface RepoDTO {
  fullName: string; // "owner/nombre-repo"
  htmlUrl: string; // URL navegable en GitHub, la "evidencia verificable"
  private: boolean;
  description: string | null; // GitHub devuelve null (no undefined) si no hay descripción
  ownerLogin: string;
}

/** Resultado de crear o listar un issue. */
export interface IssueDTO {
  number: number; // el "#42" visible en GitHub, no un ID interno
  title: string;
  state: string; // 'open' | 'closed' (no se tipa como enum acá: la restricción de valores es del schema de entrada, no de esta salida)
  htmlUrl: string;
}

/** Resultado de crear un commit vía el flujo de 6 pasos de Git. */
export interface CommitResultDTO {
  commitSha: string; // hash SHA del commit nuevo
  commitUrl: string; // URL directa al commit en GitHub
}
