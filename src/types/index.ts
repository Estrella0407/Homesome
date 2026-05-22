export interface Person {
  id: string;
  name?: string;
  nameCN: string;
  nameEN: string;
  surname: string;
  gender: 'male' | 'female';
  /**
   * ISO date string (YYYY-MM-DD). Optional for partial knowledge.
   * Keep `birthYear` for backwards compatibility and quick display.
   */
  birthDate?: string | null;
  birthYear: string;
  deathYear: string | null;
  photoUrl: string | null;
  notes: string;
  side: 'paternal' | 'maternal' | 'self';
  relationship: 'self' | 'direct' | 'sibling' | 'collateral' | 'divorced' | 'married' | 'step' | 'adoptive' | 'unknown';
  parentIds: string[];
  spouseIds: string[];
  childrenIds: string[];
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FamilyTree {
  id: string;
  name?: string;
  nameCN: string;
  nameEN: string;
  ownerId: string;
  rootPersonId: string;
  shareCode: string;
  shares: TreeShare[];
  theme: 'traditional';
  createdAt: Date;
  updatedAt: Date;
}

export interface TreeShare {
  userId: string;
  email?: string;
  displayName?: string;
  role: 'viewer' | 'editor';
  joinedAt: Date;
}

export type Language = 'zh' | 'en';
export type SideFilter = 'all' | 'paternal' | 'maternal';

export interface TreeNode extends Person {
  spouse?: Person | null;
  children: TreeNode[];
}

export type PersonFormData = Omit<Person, 'id' | 'createdAt' | 'updatedAt' | 'childrenIds'> & {
  id?: string;
};
