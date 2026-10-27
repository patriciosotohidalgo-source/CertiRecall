import { readFileSync } from 'node:fs';
import type { Profile, Syllabus } from '../src/domain/types';

export const loadSyllabusFile = (idioma: string): Syllabus =>
  JSON.parse(readFileSync(new URL(`../public/content/${idioma}/temario.json`, import.meta.url), 'utf8'));

export const profile = (cambios: Partial<Profile> = {}): Profile => ({
  locale: 'es', newPerDay: 12, simulatedDate: '2026-11-01', planStart: '2026-11-01', currentDay: 1,
  completedLessons: [], starred: [], updatedAt: '2026-11-01T10:00:00.000Z', ...cambios
});
