export interface Person {
  id: string;
  name?: string;
  nameCN: string;
  nameEN: string;
  surname: string;
  gender: 'male' | 'female';
  /**
   * ISO date string (YYYY-MM-DD). Optional for partial knowledge.
   */
  birthDate?: string | null;
  birthYear: string;
  deathYear: string | null;
  photoUrl: string | null;
  notes: string;
  side: 'paternal' | 'maternal' | 'self';
  /**
   * How this person relates to the tree / "self":
   * - 'self'      : the root person
   * - 'direct'    : direct blood ancestor/descendant
   * - 'sibling'   : sibling of a direct-line person
   * - 'collateral': cousins, aunts, uncles, etc.
   * - 'married'   : current spouse
   * - 'divorced'  : former spouse (separated/divorced)
   * - 'separated' : separated (still legally married)
   * - 'step'      : step-relation
   * - 'adoptive'  : adopted
   * - 'unknown'   : unspecified
   */
  relationship: 'self' | 'direct' | 'sibling' | 'collateral' | 'married' | 'divorced' | 'separated' | 'step' | 'adoptive' | 'unknown';
  /**
   * Explicit parent links — preferred over parentIds for new data.
   * fatherId / motherId allow blended-family scenarios where a person
   * may have a step-father AND a biological father recorded separately.
   */
  fatherId?: string | null;
  motherId?: string | null;
  /**
   * Legacy / derived: [fatherId, motherId] kept for backwards-compat
   * and as the authoritative list used by layout/queries.
   * Always keep in sync with fatherId / motherId.
   */
  parentIds: string[];
  spouseIds: string[];
  childrenIds: string[];
  siblingsIds: string[];
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
  siblings?: TreeNode[];
}

export type PersonFormData = Omit<Person, 'id' | 'createdAt' | 'updatedAt' | 'childrenIds'> & {
  id?: string;
};