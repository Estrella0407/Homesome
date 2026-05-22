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
  const map: Record<Person['relationship'], keyof typeof translations['zh']> = {
    self: 'relationship.self',
    direct: 'relationship.direct',
    sibling: 'relationship.sibling',
    collateral: 'relationship.collateral',
    divorced: 'relationship.divorced',
    separated: 'relationship.separated',
    married: 'relationship.married',
    step: 'relationship.step',
    adoptive: 'relationship.adoptive',
    unknown: 'relationship.unknown',
  };
  return t(map[relationship] ?? 'relationship.unknown');
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

/**
 * Derive parentIds array from explicit fatherId / motherId fields.
 * Keeps parentIds in sync so legacy code still works.
 */
export function deriveParentIds(fatherId?: string | null, motherId?: string | null): string[] {
  const ids: string[] = [];
  if (fatherId) ids.push(fatherId);
  if (motherId) ids.push(motherId);
  return ids;
}

/**
 * Given a list of all members, return those who could plausibly be
 * a parent of the given person (i.e., not the person themselves,
 * not their own children, not already a parent).
 *
 * Pass keepCurrentParents=true when populating a parent selector so the
 * already-selected parent stays visible in the dropdown.
 */
export function potentialParents(
  person: Person,
  allMembers: Person[],
  excludeIds: string[] = [],
  keepCurrentParents = false
): Person[] {
  // When keepCurrentParents is true we don't exclude person.parentIds — the
  // caller will exclude the *other* slot's selection via excludeIds instead.
  const excluded = new Set([person.id, ...excludeIds, ...(keepCurrentParents ? [] : person.parentIds)]);
  // Exclude descendants to avoid cycles
  const descendants = new Set<string>();
  const collectDescendants = (id: string) => {
    const p = allMembers.find((m) => m.id === id);
    if (!p) return;
    for (const cid of p.childrenIds) {
      if (!descendants.has(cid)) {
        descendants.add(cid);
        collectDescendants(cid);
      }
    }
  };
  collectDescendants(person.id);

  return allMembers.filter(
    (m) => !excluded.has(m.id) && !descendants.has(m.id)
  );
}