import { useRef, useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import type { Person, TreeNode, SideFilter } from '../../types';
import { buildHierarchy, NODE_WIDTH, NODE_HEIGHT, SPOUSE_GAP } from '../../utils/treeLayout';
import { getDefaultAvatar, getLifeSpan } from '../../utils/helpers';
import './TreeView.css';

interface Props {
  members: Person[];
  rootId: string;
  sideFilter: SideFilter;
  selectedPersonId: string | null;
  onSelectPerson: (person: Person) => void;
  onAddChild: (parentId: string) => void;
  onAddSpouse: (personId: string) => void;
  onAddParent: (childId: string) => void;
  onAddSibling: (personId: string) => void;
  onAddRoot: () => void;
}

const COUPLE_W = NODE_WIDTH * 2 + SPOUSE_GAP;
const LEVEL_H = NODE_HEIGHT + 80;

export default function TreeView({ members, rootId, sideFilter, selectedPersonId, onSelectPerson, onAddChild, onAddSpouse, onAddParent, onAddSibling, onAddRoot }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const renderTree = useCallback(() => {
    if (!svgRef.current || !gRef.current) return;
    const g = d3.select(gRef.current);
    g.selectAll('*').remove();

    if (!rootId || members.length === 0) return;

    const root = buildHierarchy(members, rootId, sideFilter);
    if (!root) return;

    const hierarchy = d3.hierarchy<TreeNode>(root, (d) => d.children);
    const treeLayout = d3.tree<TreeNode>()
      .nodeSize([COUPLE_W + 40, LEVEL_H])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.15));

    treeLayout(hierarchy);

    // Draw links
    const linkG = g.append('g').attr('class', 'links');
    hierarchy.links().forEach((link) => {
      const sx = link.source.x ?? 0, sy = link.source.y ?? 0;
      const tx = link.target.x ?? 0, ty = link.target.y ?? 0;
      const startY = sy + NODE_HEIGHT - 35;
      const endY = ty - 5;
      const midY = startY + (endY - startY) / 2;

      linkG.append('path')
        .attr('class', 'tree-link')
        .attr('d', `M${sx},${startY} L${sx},${midY} L${tx},${midY} L${tx},${endY}`)
        .attr('fill', 'none')
        .attr('stroke', 'var(--border-primary)')
        .attr('stroke-width', 2)
        .attr('opacity', 0)
        .transition().duration(600).attr('opacity', 1);
    });

    // Draw nodes
    const nodesData = hierarchy.descendants();
    nodesData.forEach((node, i) => {
      const nx = node.x ?? 0, ny = node.y ?? 0;
      const person = node.data;
      const spouse = person.spouse;
      const hasSpouse = !!spouse;
      const offsetX = hasSpouse ? -NODE_WIDTH / 2 - SPOUSE_GAP / 2 : 0;

      const nodeG = g.append('g')
        .attr('class', 'tree-node')
        .attr('transform', `translate(${nx},${ny})`)
        .style('opacity', 0)
        .style('pointer-events', 'all');

      nodeG.transition().delay(i * 50).duration(400).style('opacity', 1);

      // Render primary person
      renderPersonNode(nodeG, person, offsetX, selectedPersonId, onSelectPerson, onAddChild, onAddSpouse, onAddSibling, onAddParent);

      // Render spouse
      if (spouse && hasSpouse) {
        const spouseX = NODE_WIDTH / 2 + SPOUSE_GAP / 2;
        renderPersonNode(nodeG, spouse, spouseX, selectedPersonId, onSelectPerson, onAddChild, onAddSpouse, onAddSibling, onAddParent);

        // Spouse connection line
        nodeG.append('line')
          .attr('x1', offsetX + NODE_WIDTH / 2 + 5)
          .attr('y1', 35)
          .attr('x2', spouseX - NODE_WIDTH / 2 + 25)
          .attr('y2', 35)
          .attr('stroke', 'var(--accent-warm)')
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '4,4');
      }

    });
  }, [members, rootId, sideFilter, onSelectPerson, onAddChild, onAddSpouse, onAddParent, onAddSibling]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current!);

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 3])
      .on('zoom', (event) => { g.attr('transform', event.transform); });

    svg.call(zoom);
    zoomRef.current = zoom;

    renderTree();

    // Center the tree
    setTimeout(() => {
      const bbox = gRef.current?.getBBox();
      if (bbox && svgRef.current) {
        const svgW = svgRef.current.clientWidth;
        const svgH = svgRef.current.clientHeight;
        const scale = Math.min(svgW / (bbox.width + 100), svgH / (bbox.height + 100), 1);
        const tx = svgW / 2 - (bbox.x + bbox.width / 2) * scale;
        const ty = 60 - bbox.y * scale;
        svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
      }
    }, 100);
  }, [renderTree]);

  const handleZoom = (dir: 'in' | 'out' | 'fit') => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    if (dir === 'in') svg.transition().duration(300).call(zoomRef.current.scaleBy, 1.3);
    else if (dir === 'out') svg.transition().duration(300).call(zoomRef.current.scaleBy, 0.7);
    else {
      const bbox = gRef.current?.getBBox();
      if (bbox) {
        const svgW = svgRef.current.clientWidth, svgH = svgRef.current.clientHeight;
        const s = Math.min(svgW / (bbox.width + 100), svgH / (bbox.height + 100), 1);
        const tx = svgW / 2 - (bbox.x + bbox.width / 2) * s;
        const ty = 60 - bbox.y * s;
        svg.transition().duration(500).call(zoomRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(s));
      }
    }
  };

  if (!rootId || members.length === 0) {
    return (
      <div className="tree-empty" onClick={onAddRoot}>
        <div className="tree-empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" strokeWidth="1.5">
            <circle cx="12" cy="5" r="3"/><line x1="12" y1="8" x2="12" y2="14"/>
            <circle cx="6" cy="19" r="3"/><circle cx="18" cy="19" r="3"/>
            <path d="M12 14l-6 2M12 14l6 2"/>
          </svg>
        </div>
        <h3>添加第一位成员</h3>
        <p>点击此处开始构建家族树</p>
      </div>
    );
  }

  return (
    <div className="tree-container">
      <div className="tree-controls">
        <button className="btn-icon" onClick={() => handleZoom('in')} title="Zoom in">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M8 11h6M11 8v6"/></svg>
        </button>
        <button className="btn-icon" onClick={() => handleZoom('out')} title="Zoom out">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M8 11h6"/></svg>
        </button>
        <button className="btn-icon" onClick={() => handleZoom('fit')} title="Fit">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
        </button>
      </div>
      <svg ref={svgRef} className="tree-svg">
        <g ref={gRef} />
      </svg>
    </div>
  );
}

function renderPersonNode(
  parent: d3.Selection<SVGGElement, unknown, null, undefined>,
  person: Person,
  offsetX: number,
  selectedPersonId: string | null,
  onSelect: (p: Person) => void,
  onAddChild: (id: string) => void,
  onAddSpouse: (id: string) => void,
  onAddSibling: (id: string) => void,
  onAddParent: (id: string) => void
) {
  const photoSize = 56;
  const g = parent.append('g')
    .attr('transform', `translate(${offsetX}, 0)`)
    .style('cursor', 'pointer')
    .style('pointer-events', 'all')
    .on('click', () => onSelect(person));

  // Background card
  g.append('rect')
    .attr('x', -NODE_WIDTH / 2 + 5).attr('y', -5)
    .attr('width', NODE_WIDTH - 10).attr('height', NODE_HEIGHT - 30)
    .attr('rx', 12).attr('fill', 'var(--bg-card)')
    .attr('stroke', person.side === 'maternal' ? 'var(--maternal-color)' : person.side === 'self' ? 'var(--accent-jade)' : 'var(--paternal-color)')
    .attr('stroke-width', 1.5)
    .attr('filter', 'url(#shadow)')
    .style('pointer-events', 'all');

  // Photo
  const imgSize = photoSize;
  const clipId = `clip-${person.id}-${Math.random().toString(36).substring(2, 6)}`;

  const defs = g.append('defs');
  defs.append('clipPath').attr('id', clipId)
    .append('circle').attr('cx', 0).attr('cy', 30).attr('r', imgSize / 2);

  // Photo border ring
  const ringColor = person.side === 'maternal' ? 'var(--maternal-color)' : person.side === 'self' ? 'var(--accent-jade)' : 'var(--paternal-color)';
  g.append('circle').attr('cx', 0).attr('cy', 30).attr('r', imgSize / 2 + 3)
    .attr('fill', 'none').attr('stroke', ringColor).attr('stroke-width', 2.5);

  g.append('image')
    .attr('x', -imgSize / 2).attr('y', 30 - imgSize / 2)
    .attr('width', imgSize).attr('height', imgSize)
    .attr('href', person.photoUrl || getDefaultAvatar(person.gender))
    .attr('clip-path', `url(#${clipId})`)
    .attr('preserveAspectRatio', 'xMidYMid slice');

  // Name
  g.append('text')
    .attr('text-anchor', 'middle').attr('y', 75)
    .attr('font-family', 'var(--font-chinese)')
    .attr('font-size', '14').attr('font-weight', '600')
    .attr('fill', 'var(--text-primary)')
    .text(person.name || '未命名');

  // Lifespan
  const lifespan = getLifeSpan(person.birthYear, person.deathYear);
  if (lifespan) {
    g.append('text')
      .attr('text-anchor', 'middle').attr('y', 92)
      .attr('font-size', '11').attr('fill', 'var(--text-tertiary)')
      .text(lifespan);
  }

  const isSelected = selectedPersonId === person.id;
  const actionOverlay = g.append('g').style('opacity', isSelected ? 1 : 0);
  const actionButtons = [
    { x: -NODE_WIDTH / 2 + 18, y: -22, symbol: '↑', title: '添加父/母', handler: () => onAddParent(person.id) },
    { x: 0, y: NODE_HEIGHT - 42, symbol: '+', title: '添加子女', handler: () => onAddChild(person.id) },
    { x: NODE_WIDTH / 2 - 18, y: -22, symbol: '↔', title: '添加兄弟姐妹', handler: () => onAddSibling(person.id) },
  ];

  actionButtons.forEach((button) => {
    const btn = actionOverlay.append('g')
      .attr('transform', `translate(${button.x},${button.y})`)
      .style('cursor', 'pointer')
      .on('click', (e) => { e.stopPropagation(); button.handler(); });

    btn.append('circle').attr('r', 10).attr('fill', 'var(--accent-gold-dark)').attr('opacity', 0.9);
    btn.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em')
      .attr('fill', 'white').attr('font-size', '12').attr('font-weight', '600')
      .text(button.symbol);
    btn.append('title').text(button.title);
  });

  let spBtn: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  if (person.spouseIds.length === 0) {
    spBtn = g.append('g')
      .attr('class', 'add-spouse-btn')
      .attr('transform', `translate(${NODE_WIDTH / 2 - 15}, 25)`)
      .style('cursor', 'pointer').style('opacity', isSelected ? 1 : 0)
      .on('click', (e) => { e.stopPropagation(); onAddSpouse(person.id); });
    spBtn.append('circle').attr('r', 9).attr('fill', 'var(--accent-warm)').attr('opacity', 0.85);
    spBtn.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em')
      .attr('fill', 'white').attr('font-size', '12').text('♥');
    spBtn.append('title').text('添加配偶');
  }

  g.on('mouseover', () => {
    actionOverlay.transition().duration(150).style('opacity', 1);
    if (spBtn) spBtn.transition().duration(150).style('opacity', 1);
  });
  g.on('mouseout', () => {
    if (!isSelected) {
      actionOverlay.transition().duration(150).style('opacity', 0);
      if (spBtn) spBtn.transition().duration(150).style('opacity', 0);
    }
  });

  // Hover effect
  g.on('mouseover.highlight', function () {
    d3.select(this).select('rect').transition().duration(150)
      .attr('stroke-width', 2.5)
      .attr('filter', 'url(#shadow-hover)');
  });
  g.on('mouseout.highlight', function () {
    d3.select(this).select('rect').transition().duration(150)
      .attr('stroke-width', 1.5)
      .attr('filter', 'url(#shadow)');
  });
}
