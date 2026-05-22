import * as d3 from 'd3';
import type { Person, TreeNode, SideFilter } from '../types';

export const NODE_WIDTH = 130;
export const NODE_HEIGHT = 160;
export const SPOUSE_GAP = 60;
export const LEVEL_GAP = 100;

export function buildHierarchy(
  members: Person[],
  rootId: string,
  sideFilter: SideFilter = 'all'
): TreeNode | null {
  if (members.length === 0 || !rootId) return null;

  const memberMap = new Map(members.map((m) => [m.id, m]));
  const visited = new Set<string>();

  function build(personId: string): TreeNode | null {
    if (visited.has(personId)) return null;
    visited.add(personId);

    const person = memberMap.get(personId);
    if (!person) return null;

    if (sideFilter !== 'all' && person.side !== sideFilter && person.side !== 'self') {
      return null;
    }

    const spouse =
      person.spouseIds.length > 0
        ? memberMap.get(person.spouseIds[0]) || null
        : null;

    const children = person.childrenIds
      .map((id) => build(id))
      .filter(Boolean) as TreeNode[];

    children.sort((a, b) => a.order - b.order);

    return { ...person, spouse, children };
  }

  return build(rootId);
}

export interface PositionedNode {
  person: Person;
  spouse: Person | null;
  x: number;
  y: number;
  children: PositionedNode[];
}

export interface TreeLink {
  source: { x: number; y: number };
  target: { x: number; y: number };
}

export function computeLayout(root: TreeNode): {
  nodes: PositionedNode[];
  links: TreeLink[];
  width: number;
  height: number;
} {
  const hierarchy = d3.hierarchy<TreeNode>(root, (d) => d.children);

  const nodeW = NODE_WIDTH + SPOUSE_GAP + 60;
  const treeLayout = d3
    .tree<TreeNode>()
    .nodeSize([nodeW, NODE_HEIGHT + LEVEL_GAP])
    .separation((a, b) => {
      return a.parent === b.parent ? 1 : 1.2;
    });

  treeLayout(hierarchy);

  const nodes: PositionedNode[] = [];
  const links: TreeLink[] = [];

  hierarchy.each((node) => {
    const positioned: PositionedNode = {
      person: node.data,
      spouse: node.data.spouse || null,
      x: node.x || 0,
      y: node.y || 0,
      children: [],
    };
    nodes.push(positioned);

    if (node.parent) {
      const parentX = node.parent.x || 0;
      const parentY = node.parent.y || 0;
      links.push({
        source: { x: parentX, y: parentY + NODE_HEIGHT - 20 },
        target: { x: node.x || 0, y: (node.y || 0) + 10 },
      });
    }
  });

  let minX = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  nodes.forEach((n) => {
    const halfW = n.spouse ? nodeW / 2 : NODE_WIDTH / 2;
    if (n.x - halfW < minX) minX = n.x - halfW;
    if (n.x + halfW > maxX) maxX = n.x + halfW;
    if (n.y + NODE_HEIGHT > maxY) maxY = n.y + NODE_HEIGHT;
  });

  return {
    nodes,
    links,
    width: maxX - minX + 100,
    height: maxY + 100,
  };
}

export function generateLinkPath(link: TreeLink): string {
  const { source, target } = link;
  const midY = (source.y + target.y) / 2;
  return `M ${source.x} ${source.y} C ${source.x} ${midY}, ${target.x} ${midY}, ${target.x} ${target.y}`;
}
