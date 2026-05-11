import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, isConfigured } from './firebase';
import type { Person, FamilyTree } from '../types';
import { generateId, generateShareCode } from '../utils/helpers';

// ── Local Storage fallback ──
const LS_TREES_KEY = 'homesome_trees';
const LS_MEMBERS_PREFIX = 'homesome_members_';
const LEGACY_LS_TREES_KEY = 'zupu_trees';
const LEGACY_LS_MEMBERS_PREFIX = 'zupu_members_';

function migrateLegacyLocalStorageIfNeeded() {
  // One-time migration: if new keys are empty but legacy exists, copy over.
  if (!localStorage.getItem(LS_TREES_KEY)) {
    const legacyTrees = localStorage.getItem(LEGACY_LS_TREES_KEY);
    if (legacyTrees) localStorage.setItem(LS_TREES_KEY, legacyTrees);
  }

  // Members are per-tree keys; migrate those we can discover from trees.
  const raw = localStorage.getItem(LS_TREES_KEY) || localStorage.getItem(LEGACY_LS_TREES_KEY);
  if (!raw) return;
  try {
    const trees = JSON.parse(raw) as Array<{ id?: string }>;
    for (const t of trees) {
      const treeId = t?.id;
      if (!treeId) continue;
      const newKey = LS_MEMBERS_PREFIX + treeId;
      if (localStorage.getItem(newKey)) continue;
      const legacy = localStorage.getItem(LEGACY_LS_MEMBERS_PREFIX + treeId);
      if (legacy) localStorage.setItem(newKey, legacy);
    }
  } catch {
    // ignore
  }
}

function getLocalTrees(): FamilyTree[] {
  migrateLegacyLocalStorageIfNeeded();
  const data = localStorage.getItem(LS_TREES_KEY);
  return data ? JSON.parse(data) : [];
}
function saveLocalTrees(trees: FamilyTree[]) {
  localStorage.setItem(LS_TREES_KEY, JSON.stringify(trees));
}
function getLocalMembers(treeId: string): Person[] {
  migrateLegacyLocalStorageIfNeeded();
  const data = localStorage.getItem(LS_MEMBERS_PREFIX + treeId);
  return data ? JSON.parse(data) : [];
}
function saveLocalMembers(treeId: string, members: Person[]) {
  localStorage.setItem(LS_MEMBERS_PREFIX + treeId, JSON.stringify(members));
}

// ── Tree CRUD ──
export async function createTree(name: string, ownerId: string): Promise<FamilyTree> {
  const tree: FamilyTree = {
    id: generateId(),
    name,
    ownerId,
    rootPersonId: '',
    shareCode: generateShareCode(),
    theme: 'traditional',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (isConfigured && db) {
    await setDoc(doc(db, 'trees', tree.id), {
      ...tree,
      createdAt: Timestamp.fromDate(tree.createdAt),
      updatedAt: Timestamp.fromDate(tree.updatedAt),
    });
  } else {
    const trees = getLocalTrees();
    trees.push(tree);
    saveLocalTrees(trees);
  }

  return tree;
}

export async function getUserTrees(userId: string): Promise<FamilyTree[]> {
  if (isConfigured && db) {
    const q = query(collection(db, 'trees'), where('ownerId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => {
      const data = d.data();
      return {
        ...data,
        id: d.id,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
      } as FamilyTree;
    });
  }
  return getLocalTrees().filter((t) => t.ownerId === userId);
}

export async function getTreeByShareCode(code: string): Promise<FamilyTree | null> {
  if (isConfigured && db) {
    const q = query(collection(db, 'trees'), where('shareCode', '==', code));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const d = snapshot.docs[0];
    const data = d.data();
    return { ...data, id: d.id, createdAt: data.createdAt?.toDate?.(), updatedAt: data.updatedAt?.toDate?.() } as FamilyTree;
  }
  return getLocalTrees().find((t) => t.shareCode === code) || null;
}

export async function updateTree(treeId: string, updates: Partial<FamilyTree>): Promise<void> {
  if (isConfigured && db) {
    await updateDoc(doc(db, 'trees', treeId), { ...updates, updatedAt: Timestamp.now() });
  } else {
    const trees = getLocalTrees();
    const idx = trees.findIndex((t) => t.id === treeId);
    if (idx >= 0) {
      trees[idx] = { ...trees[idx], ...updates, updatedAt: new Date() };
      saveLocalTrees(trees);
    }
  }
}

export async function deleteTree(treeId: string): Promise<void> {
  if (isConfigured && db) {
    const membersSnap = await getDocs(collection(db, 'trees', treeId, 'members'));
    for (const d of membersSnap.docs) {
      await deleteDoc(d.ref);
    }
    await deleteDoc(doc(db, 'trees', treeId));
  } else {
    const trees = getLocalTrees().filter((t) => t.id !== treeId);
    saveLocalTrees(trees);
    localStorage.removeItem(LS_MEMBERS_PREFIX + treeId);
  }
}

// ── Member CRUD ──
export async function getMembers(treeId: string): Promise<Person[]> {
  if (isConfigured && db) {
    const snapshot = await getDocs(collection(db, 'trees', treeId, 'members'));
    return snapshot.docs.map((d) => {
      const data = d.data();
      return {
        ...data,
        id: d.id,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
      } as Person;
    });
  }
  return getLocalMembers(treeId);
}

export async function saveMember(treeId: string, person: Person): Promise<void> {
  if (isConfigured && db) {
    await setDoc(doc(db, 'trees', treeId, 'members', person.id), {
      ...person,
      createdAt: Timestamp.fromDate(person.createdAt),
      updatedAt: Timestamp.now(),
    });
  } else {
    const members = getLocalMembers(treeId);
    const idx = members.findIndex((m) => m.id === person.id);
    if (idx >= 0) {
      members[idx] = { ...person, updatedAt: new Date() };
    } else {
      members.push(person);
    }
    saveLocalMembers(treeId, members);
  }
}

export async function deleteMember(treeId: string, personId: string): Promise<void> {
  if (isConfigured && db) {
    await deleteDoc(doc(db, 'trees', treeId, 'members', personId));
  } else {
    const members = getLocalMembers(treeId).filter((m) => m.id !== personId);
    saveLocalMembers(treeId, members);
  }
}

// ── Photo Upload ──
export async function uploadPhoto(treeId: string, personId: string, file: File): Promise<string> {
  if (isConfigured && storage) {
    const storageRef = ref(storage, `trees/${treeId}/photos/${personId}`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  }
  // Fallback: store as data URL in localStorage
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

export async function deletePhoto(treeId: string, personId: string): Promise<void> {
  if (isConfigured && storage) {
    try {
      const storageRef = ref(storage, `trees/${treeId}/photos/${personId}`);
      await deleteObject(storageRef);
    } catch {
      // Photo may not exist
    }
  }
}
