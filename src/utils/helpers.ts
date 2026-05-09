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

export function getLifeSpan(birthYear: string, deathYear: string | null): string {
  if (!birthYear && !deathYear) return '';
  if (birthYear && !deathYear) return `${birthYear} —`;
  if (!birthYear && deathYear) return `— ${deathYear}`;
  return `${birthYear} — ${deathYear}`;
}

export function getDefaultAvatar(gender: 'male' | 'female'): string {
  if (gender === 'male') {
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="#E8DCC8" width="100" height="100" rx="50"/><circle cx="50" cy="38" r="16" fill="#9A8674"/><ellipse cx="50" cy="75" rx="24" ry="18" fill="#9A8674"/></svg>`)}`;
  }
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="#F5DDD4" width="100" height="100" rx="50"/><circle cx="50" cy="38" r="16" fill="#C4734F"/><ellipse cx="50" cy="75" rx="24" ry="18" fill="#C4734F"/></svg>`)}`;
}
