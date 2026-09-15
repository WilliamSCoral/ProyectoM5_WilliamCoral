import { z } from 'zod';

/**
 * Nombre de repositorio válido para GitHub: 3-100 caracteres, solo
 * alfanuméricos, guiones, guiones bajos y puntos (sin espacios).
 */
const repoNameSchema = z
  .string()
  .min(3, 'El nombre del repositorio debe tener al menos 3 caracteres')
  .max(100, 'El nombre del repositorio no puede superar los 100 caracteres')
  .regex(
    /^[a-zA-Z0-9_.-]+$/,
    'El nombre del repositorio solo puede contener letras, números, guiones (-), guiones bajos (_) y puntos (.), sin espacios',
  );

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
    .default(false)
    .describe('Si es true, el repositorio se crea privado. Default: false (público).'),
});
export type CreateRepositoryInput = z.infer<typeof CreateRepositorySchema>;

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

export const ListRepositoriesSchema = z.object({
  type: z
    .enum(['all', 'public', 'private'])
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
    .max(100, 'per_page no puede superar 100 (límite de la API de GitHub)')
    .default(30)
    .describe('Cantidad máxima de repositorios a devolver (1-100). Default: 30.'),
});
export type ListRepositoriesInput = z.infer<typeof ListRepositoriesSchema>;

export const CreateCommitSchema = z.object({
  owner: z.string().min(1, 'owner es requerido').describe('Usuario u organización dueño del repositorio.'),
  repo: z.string().min(1, 'repo es requerido').describe('Nombre del repositorio (sin el owner).'),
  branch: z
    .string()
    .min(1, 'branch es requerido')
    .default('main')
    .describe('Rama destino donde se aplicará el commit. Default: main.'),
  path: z
    .string()
    .min(1, 'path es requerido')
    .describe('Ruta relativa del archivo a crear o modificar (ej: "docs/README.md").'),
  content: z.string().describe('Contenido en texto plano del archivo. Se codifica a base64 internamente.'),
  message: z.string().min(1, 'El mensaje de commit es requerido').describe('Mensaje descriptivo del commit.'),
});
export type CreateCommitInput = z.infer<typeof CreateCommitSchema>;

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
