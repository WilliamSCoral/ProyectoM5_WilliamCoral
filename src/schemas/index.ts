/**
 * Contratos de entrada de las 5 tools, definidos con Zod (contract-first:
 * esto se escribió antes que la lógica de negocio). Cada campo tiene un
 * .describe() — no es decorativo, es lo único que el LLM lee para saber
 * qué mandar en cada campo, porque el SDK de MCP convierte esto a JSON
 * Schema automáticamente y así se lo expone al Host.
 */
import { z } from 'zod';

/**
 * Regla reutilizable: nombre de repositorio válido para GitHub.
 * 3-100 caracteres, solo alfanuméricos, guiones, guiones bajos y puntos
 * (sin espacios). El regex se lee: desde el principio (^) hasta el final ($)
 * del string, solo esos caracteres, uno o más veces (+).
 */
const repoNameSchema = z
  .string()
  .min(3, 'El nombre del repositorio debe tener al menos 3 caracteres')
  .max(100, 'El nombre del repositorio no puede superar los 100 caracteres')
  .regex(
    /^[a-zA-Z0-9_.-]+$/,
    'El nombre del repositorio solo puede contener letras, números, guiones (-), guiones bajos (_) y puntos (.), sin espacios',
  );

/** Contrato de create_repository. */
export const CreateRepositorySchema = z.object({
  name: repoNameSchema.describe(
    'Nombre único del nuevo repositorio. 3-100 caracteres, solo letras, números, "-", "_" y ".", sin espacios.',
  ),
  description: z
    .string()
    .max(350, 'La descripción no puede superar los 350 caracteres')
    .optional()
    .describe('Descripción breve y opcional del propósito del repositorio.'),
  private: z
    .boolean()
    .default(false) // si no se especifica, se crea público — evita privacidad "por accidente"
    .describe('Si es true, el repositorio se crea privado. Default: false (público).'),
});
// z.infer deriva el tipo de TypeScript automáticamente a partir del schema:
// una sola fuente de verdad, nunca hay que mantener schema y tipo sincronizados a mano.
export type CreateRepositoryInput = z.infer<typeof CreateRepositorySchema>;

/** Contrato de create_issue. */
export const CreateIssueSchema = z.object({
  owner: z.string().min(1, 'owner es requerido').describe('Usuario u organización dueño del repositorio.'),
  repo: z.string().min(1, 'repo es requerido').describe('Nombre del repositorio (sin el owner).'),
  title: z
    .string()
    .min(3, 'El título debe tener al menos 3 caracteres')
    .max(256, 'El título no puede superar los 256 caracteres')
    .describe('Título del issue. Debe ser claro y describir el problema o tarea en pocas palabras.'),
  body: z
    .string()
    .max(10000, 'El body no puede superar los 10000 caracteres')
    .optional()
    .describe('Contenido detallado del issue en Markdown. Opcional.'),
});
export type CreateIssueInput = z.infer<typeof CreateIssueSchema>;

/** Contrato de list_repositories. Todos los campos tienen default: {} ya es un input válido. */
export const ListRepositoriesSchema = z.object({
  type: z
    .enum(['all', 'public', 'private']) // enum, no string libre: el LLM no puede mandar "publico" sin tilde
    .default('all')
    .describe('Filtra por visibilidad de los repositorios. Default: all.'),
  sort: z
    .enum(['created', 'updated', 'pushed', 'full_name'])
    .default('updated')
    .describe('Criterio de orden de los resultados. Default: updated (más recientes primero).'),
  per_page: z
    .number()
    .int('per_page debe ser un número entero')
    .min(1, 'per_page debe ser al menos 1')
    .max(100, 'per_page no puede superar 100 (límite de la API de GitHub)') // no es arbitrario: es el límite real de la API
    .default(30)
    .describe('Cantidad máxima de repositorios a devolver (1-100). Default: 30.'),
});
export type ListRepositoriesInput = z.infer<typeof ListRepositoriesSchema>;

/** Contrato de create_commit (usa el flujo de 6 pasos de Git en operations.ts). */
export const CreateCommitSchema = z.object({
  owner: z.string().min(1, 'owner es requerido').describe('Usuario u organización dueño del repositorio.'),
  repo: z.string().min(1, 'repo es requerido').describe('Nombre del repositorio (sin el owner).'),
  branch: z
    .string()
    .min(1, 'branch es requerido')
    .default('main') // cubre el caso más común sin obligar al LLM a preguntar siempre
    .describe('Rama destino donde se aplicará el commit. Default: main.'),
  path: z
    .string()
    .min(1, 'path es requerido')
    .describe('Ruta relativa del archivo a crear o modificar (ej: "docs/README.md").'),
  content: z.string().describe('Contenido en texto plano del archivo. Se codifica a base64 internamente.'),
  message: z.string().min(1, 'El mensaje de commit es requerido').describe('Mensaje descriptivo del commit.'),
});
export type CreateCommitInput = z.infer<typeof CreateCommitSchema>;

/** Contrato de list_issues. owner/repo son obligatorios (a diferencia de list_repositories). */
export const ListIssuesSchema = z.object({
  owner: z.string().min(1, 'owner es requerido').describe('Usuario u organización dueño del repositorio.'),
  repo: z.string().min(1, 'repo es requerido').describe('Nombre del repositorio (sin el owner).'),
  state: z
    .enum(['open', 'closed', 'all'])
    .default('open')
    .describe('Filtra issues por estado. Default: open (solo issues abiertos).'),
  per_page: z
    .number()
    .int('per_page debe ser un número entero')
    .min(1, 'per_page debe ser al menos 1')
    .max(100, 'per_page no puede superar 100 (límite de la API de GitHub)')
    .default(30)
    .describe('Cantidad máxima de issues a devolver (1-100). Default: 30.'),
});
export type ListIssuesInput = z.infer<typeof ListIssuesSchema>;
