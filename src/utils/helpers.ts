export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

export function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

import type { Language } from './i18n';
import { translations } from './i18n';
import type { Person, FamilyTree } from '../types';

export function getDisplayName(person: Person, lang: Language): string {
  if (lang === 'zh') {
    return person.nameCN || person.nameEN || person.name || person.surname || '';
  }
  return person.nameEN || person.nameCN || person.name || person.surname || '';
}

export function getTreeDisplayName(tree: FamilyTree, lang: Language): string {
  if (lang === 'zh') {
    return tree.nameCN || tree.nameEN || tree.name || '';
  }
  return tree.nameEN || tree.nameCN || tree.name || '';
}

export function getRelationshipLabel(
  relationship: Person['relationship'],
  lang: Language
): string {
  const t = (key: keyof typeof translations['zh']) => (translations[lang] as Record<string, string>)[key] || '';
  if (relationship === 'self') return t('relationship.self');
  if (relationship === 'direct') return t('relationship.direct');
  if (relationship === 'sibling') return t('relationship.sibling');
  if (relationship === 'divorced') return t('relationship.divorced');
  if (relationship === 'married') return t('relationship.married');
  if (relationship === 'step') return t('relationship.step');
  if (relationship === 'adoptive') return t('relationship.adoptive');
  if (relationship === 'collateral') {
    return t('relationship.collateral');
  }
  return t('relationship.unknown');
}

export function getLifeSpan(birthYear: string, deathYear: string | null, lang: Language = 'zh'): string {
  if (!birthYear && !deathYear) return '';
  const t = (key: keyof typeof translations['zh']) => (translations[lang] as Record<string, string>)[key] || '';
  if (birthYear && !deathYear) return `${birthYear} — ${t('life.present')}`;
  if (!birthYear && deathYear) return `${t('life.unknown')} — ${deathYear}`;
  return `${birthYear} — ${deathYear}`;
}

export function getDefaultAvatar(gender: 'male' | 'female'): string {
  if (gender === 'male') {
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="#E8DCC8" width="100" height="100" rx="50"/><circle cx="50" cy="38" r="16" fill="#9A8674"/><ellipse cx="50" cy="75" rx="24" ry="18" fill="#9A8674"/></svg>`)}`;
  }
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="#F5DDD4" width="100" height="100" rx="50"/><circle cx="50" cy="38" r="16" fill="#C4734F"/><ellipse cx="50" cy="75" rx="24" ry="18" fill="#C4734F"/></svg>`)}`;
}
