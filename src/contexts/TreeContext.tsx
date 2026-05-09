import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Person, FamilyTree, SideFilter } from '../types';
import { useAuth } from './AuthContext';
import * as treeService from '../services/treeService';

interface TreeContextType {
  trees: FamilyTree[];
  activeTree: FamilyTree | null;
  members: Person[];
  sideFilter: SideFilter;
  loading: boolean;
  setActiveTree: (tree: FamilyTree | null) => void;
  setSideFilter: (f: SideFilter) => void;
  loadTrees: () => Promise<void>;
  loadMembers: () => Promise<void>;
  createTree: (name: string) => Promise<FamilyTree>;
  updateTree: (updates: Partial<FamilyTree>) => Promise<void>;
  deleteTree: () => Promise<void>;
  saveMember: (person: Person) => Promise<void>;
  deleteMember: (personId: string) => Promise<void>;
  joinTree: (code: string) => Promise<FamilyTree | null>;
}

const TreeContext = createContext<TreeContextType>(null!);

export function TreeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [trees, setTrees] = useState<FamilyTree[]>([]);
  const [activeTree, setActiveTree] = useState<FamilyTree | null>(null);
  const [members, setMembers] = useState<Person[]>([]);
  const [sideFilter, setSideFilter] = useState<SideFilter>('all');
  const [loading, setLoading] = useState(false);

  const loadTrees = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const t = await treeService.getUserTrees(user.uid);
      setTrees(t);
    } finally { setLoading(false); }
  }, [user]);

  const loadMembers = useCallback(async () => {
    if (!activeTree) return;
    setLoading(true);
    try {
      const m = await treeService.getMembers(activeTree.id);
      setMembers(m);
    } finally { setLoading(false); }
  }, [activeTree]);

  useEffect(() => { if (user) loadTrees(); }, [user, loadTrees]);
  useEffect(() => { if (activeTree) loadMembers(); }, [activeTree, loadMembers]);

  const createNewTree = async (name: string) => {
    if (!user) throw new Error('Not authenticated');
    const tree = await treeService.createTree(name, user.uid);
    setTrees((prev) => [...prev, tree]);
    return tree;
  };

  const updateCurrentTree = async (updates: Partial<FamilyTree>) => {
    if (!activeTree) return;
    await treeService.updateTree(activeTree.id, updates);
    const updated = { ...activeTree, ...updates };
    setActiveTree(updated);
    setTrees((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const deleteCurrentTree = async () => {
    if (!activeTree) return;
    await treeService.deleteTree(activeTree.id);
    setTrees((prev) => prev.filter((t) => t.id !== activeTree.id));
    setActiveTree(null);
    setMembers([]);
  };

  const saveMember = async (person: Person) => {
    if (!activeTree) return;
    await treeService.saveMember(activeTree.id, person);
    setMembers((prev) => {
      const idx = prev.findIndex((m) => m.id === person.id);
      if (idx >= 0) { const copy = [...prev]; copy[idx] = person; return copy; }
      return [...prev, person];
    });
    if (!activeTree.rootPersonId && person.parentIds.length === 0) {
      await updateCurrentTree({ rootPersonId: person.id });
    }
  };

  const removeMember = async (personId: string) => {
    if (!activeTree) return;
    await treeService.deleteMember(activeTree.id, personId);
    const remaining = members.filter((m) => m.id !== personId).map((m) => ({
      ...m,
      parentIds: m.parentIds.filter((id) => id !== personId),
      spouseIds: m.spouseIds.filter((id) => id !== personId),
      childrenIds: m.childrenIds.filter((id) => id !== personId),
    }));
    for (const m of remaining) {
      await treeService.saveMember(activeTree.id, m);
    }
    setMembers(remaining);
    if (activeTree.rootPersonId === personId) {
      await updateCurrentTree({ rootPersonId: remaining[0]?.id || '' });
    }
  };

  const joinTree = async (code: string) => {
    const tree = await treeService.getTreeByShareCode(code);
    if (tree && !trees.find((t) => t.id === tree.id)) {
      setTrees((prev) => [...prev, tree]);
    }
    return tree;
  };

  return (
    <TreeContext.Provider value={{
      trees, activeTree, members, sideFilter, loading,
      setActiveTree, setSideFilter, loadTrees, loadMembers,
      createTree: createNewTree, updateTree: updateCurrentTree,
      deleteTree: deleteCurrentTree, saveMember, deleteMember: removeMember, joinTree,
    }}>
      {children}
    </TreeContext.Provider>
  );
}

export function useTree() { return useContext(TreeContext); }
