import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Person, FamilyTree, SideFilter, TreeShare } from '../types';
import { useAuth } from './AuthContext';
import * as treeService from '../services/treeService';

interface TreeContextType {
  trees: FamilyTree[];
  activeTree: FamilyTree | null;
  members: Person[];
  sideFilter: SideFilter;
  loading: boolean;
  treesLoaded: boolean;
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
  shareTree: (share: Omit<TreeShare, 'joinedAt'>) => Promise<void>;
  revokeShare: (userId: string) => Promise<void>;
}

const TreeContext = createContext<TreeContextType>(null!);
const LAST_TREE_KEY = 'homesome_last_tree';

export function TreeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [trees, setTrees] = useState<FamilyTree[]>([]);
  const [activeTree, setActiveTree] = useState<FamilyTree | null>(null);
  const [members, setMembers] = useState<Person[]>([]);
  const [sideFilter, setSideFilter] = useState<SideFilter>('all');
  const [loading, setLoading] = useState(false);
  const [treesLoaded, setTreesLoaded] = useState(false);

  const loadTrees = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const t = await treeService.getUserTrees(user.uid);
      setTrees(t);
    } finally {
      setLoading(false);
      setTreesLoaded(true);
    }
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
  useEffect(() => {
    if (activeTree) {
      localStorage.setItem(LAST_TREE_KEY, activeTree.id);
    } else {
      localStorage.removeItem(LAST_TREE_KEY);
    }
  }, [activeTree]);
  useEffect(() => {
    if (!user || activeTree || trees.length === 0) return;
    const lastTreeId = localStorage.getItem(LAST_TREE_KEY);
    if (!lastTreeId) return;
    const tree = trees.find((t) => t.id === lastTreeId);
    if (tree) setActiveTree(tree);
  }, [user, activeTree, trees]);

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

  const shareTree = async (share: Omit<TreeShare, 'joinedAt'>) => {
    if (!activeTree) return;
    const existingShares = activeTree.shares || [];
    const updatedShares = existingShares.filter((s) => s.userId !== share.userId);
    updatedShares.push({ ...share, joinedAt: new Date() });
    await treeService.updateTree(activeTree.id, { shares: updatedShares });
    const updated = { ...activeTree, shares: updatedShares };
    setActiveTree(updated);
    setTrees((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const revokeShare = async (userId: string) => {
    if (!activeTree) return;
    const updatedShares = (activeTree.shares || []).filter((s) => s.userId !== userId);
    await treeService.updateTree(activeTree.id, { shares: updatedShares });
    const updated = { ...activeTree, shares: updatedShares };
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
    if (!tree) return null;
    if (user) {
      const existingShares = tree.shares || [];
      if (!existingShares.find((s) => s.userId === user.uid)) {
        const newShare = {
          userId: user.uid,
          email: user.email || '',
          displayName: user.displayName || user.email || user.uid,
          role: 'viewer' as const,
          joinedAt: new Date(),
        };
        const updatedShares = [...existingShares, newShare];
        await treeService.updateTree(tree.id, { shares: updatedShares });
        tree.shares = updatedShares;
      }
    }
    if (!trees.find((t) => t.id === tree.id)) {
      setTrees((prev) => [...prev, tree]);
    }
    return tree;
  };

  return (
    <TreeContext.Provider value={{
      trees, activeTree, members, sideFilter, loading, treesLoaded,
      setActiveTree, setSideFilter, loadTrees, loadMembers,
      createTree: createNewTree, updateTree: updateCurrentTree,
      deleteTree: deleteCurrentTree, saveMember, deleteMember: removeMember, joinTree,
      shareTree, revokeShare,
    }}>
      {children}
    </TreeContext.Provider>
  );
}

export function useTree() { return useContext(TreeContext); }
