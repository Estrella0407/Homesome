export interface Person {
  id: string;
  name: string;
  surname: string;
  gender: 'male' | 'female';
  birthYear: string;
  deathYear: string | null;
  photoUrl: string | null;
  notes: string;
  side: 'paternal' | 'maternal' | 'self';
  parentIds: string[];
  spouseIds: string[];
  childrenIds: string[];
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FamilyTree {
  id: string;
  name: string;
  ownerId: string;
  rootPersonId: string;
  shareCode: string;
  theme: 'traditional';
  createdAt: Date;
  updatedAt: Date;
}

export interface TreeShare {
  userId: string;
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
