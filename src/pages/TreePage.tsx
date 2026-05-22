import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import TreeView from '../components/tree_view/TreeView';
import Modal from '../components/common/Modal';
import { useI18n } from '../contexts/I18nContext';
import { useTree } from '../contexts/TreeContext';
import type { Person, PersonFormData, SideFilter } from '../types';
import type { Language, TranslationKey } from '../utils/i18n';
import {
  getDisplayName,
  getTreeDisplayName,
  getRelationshipLabel,
  generateId,
  deriveParentIds,
  potentialParents,
} from '../utils/helpers';

// ─── Editor mode ────────────────────────────────────────────────────────────

type EditorMode =
  | { kind: 'create-root' }
  | { kind: 'create-parent'; childId: string }
  | { kind: 'create-child'; parentId: string }
  | { kind: 'create-sibling'; personId: string }
  | { kind: 'create-spouse'; personId: string }
  | { kind: 'edit'; personId: string };

const emptyForm = (): PersonFormData => ({
  nameCN: '',
  nameEN: '',
  surname: '',
  gender: 'male',
  birthDate: null,
  birthYear: '',
  deathYear: null,
  photoUrl: null,
  notes: '',
  side: 'paternal',
  relationship: 'unknown',
  fatherId: null,
  motherId: null,
  parentIds: [],
  spouseIds: [],
  siblingsIds: [],
  order: 1,
});

// ─── Component ──────────────────────────────────────────────────────────────

export default function TreePage() {
  const { t, lang } = useI18n();
  const { activeTree, members, sideFilter, setSideFilter, saveMember, deleteMember, updateTree, treesLoaded } = useTree();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorMode | null>(null);
  const [form, setForm] = useState<PersonFormData>(emptyForm());

  const rootId = activeTree?.rootPersonId || '';
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  // Always derive from memberMap so the panel reflects the latest saved data
  const selected = selectedId ? (memberMap.get(selectedId) ?? null) : null;

  if (!activeTree) {
    if (!treesLoaded) return null;
    return <Navigate to="/" replace />;
  }

  // ── Relationship helpers ─────────────────────────────────────────────────

  const rel = useMemo(() => {
    const get = (id: string) => memberMap.get(id) || null;

    const parentsOf = (p: Person): Person[] =>
      p.parentIds.map(get).filter(Boolean) as Person[];

    const fatherOf = (p: Person): Person | null =>
      (p.fatherId ? get(p.fatherId) : null) ??
      (p.parentIds[0] ? get(p.parentIds[0]) : null);

    const motherOf = (p: Person): Person | null =>
      (p.motherId ? get(p.motherId) : null) ??
      (p.parentIds[1] ? get(p.parentIds[1]) : null);

    const spousesOf = (p: Person): Person[] =>
      p.spouseIds.map(get).filter(Boolean) as Person[];

    const childrenOf = (p: Person): Person[] =>
      p.childrenIds.map(get).filter(Boolean) as Person[];

    const siblingsOf = (p: Person): Person[] => {
      const sibIds = new Set<string>();
      
      for (const id of (p.siblingsIds || [])) {
        if (id && id !== p.id) sibIds.add(id);
      }

      for (const pid of (p.parentIds || [])) {
        const parent = get(pid);
        if (!parent) continue;
        for (const cid of (parent.childrenIds || [])) {
          if (cid && cid !== p.id) sibIds.add(cid);
        }
      }
      return Array.from(sibIds).map(get).filter(Boolean) as Person[];
    };

    return { get, parentsOf, fatherOf, motherOf, spousesOf, childrenOf, siblingsOf };
  }, [memberMap]);

  // ── Open editor ──────────────────────────────────────────────────────────

  const openEditor = (mode: EditorMode) => {
    setEditor(mode);

    if (mode.kind === 'edit') {
      const p = memberMap.get(mode.personId);
      if (!p) return;
      const { id: _id, createdAt: _c, updatedAt: _u, childrenIds: _kids, ...rest } = p;
      setForm({ ...rest, id: p.id });
      return;
    }

    const base = emptyForm();

    if (mode.kind === 'create-root') {
      setForm({ ...base, side: 'self', relationship: 'self', parentIds: [], fatherId: null, motherId: null });
      return;
    }

    if (mode.kind === 'create-parent') {
      const child = memberMap.get(mode.childId);
      setForm({
        ...base,
        side: child?.side ?? 'paternal',
        relationship: 'direct',
      });
      return;
    }

    if (mode.kind === 'create-child') {
      const parent = memberMap.get(mode.parentId);
      const newFatherId = parent?.gender === 'male' ? mode.parentId : null;
      const newMotherId = parent?.gender === 'female' ? mode.parentId : null;
      const parentIds = deriveParentIds(newFatherId, newMotherId);
      setForm({
        ...base,
        parentIds,
        fatherId: newFatherId,
        motherId: newMotherId,
        relationship: 'direct',
        side: parent?.side === 'self' ? 'paternal' : (parent?.side ?? 'paternal'),
      });
      return;
    }

    if (mode.kind === 'create-sibling') {
      const person = memberMap.get(mode.personId);
      setForm({
        ...base,
        side: person?.side ?? 'paternal',
        relationship: 'sibling',
        parentIds: person?.parentIds || [],
        fatherId: person?.fatherId || null,
        motherId: person?.motherId || null,
      });
      return;
    }

    if (mode.kind === 'create-spouse') {
      const p = memberMap.get(mode.personId);
      setForm({
        ...base,
        gender: p?.gender === 'male' ? 'female' : 'male',
        side: p?.side ?? 'paternal',
        relationship: 'married',
        parentIds: [],
        fatherId: null,
        motherId: null,
      });
      return;
    }
  };

  // ── Save with relationship wiring ─────────────────────────────────────────

  const upsertWithRelations = async (mode: EditorMode, data: PersonFormData) => {
    const now = new Date();
    const id = data.id || generateId();
    const existing = memberMap.get(id);

    // Derive parentIds from explicit father/mother
    const fatherId = data.fatherId || null;
    const motherId = data.motherId || null;
    const parentIds = deriveParentIds(fatherId, motherId);

    const birthYearFromDate =
      data.birthDate && data.birthDate.length >= 4 ? data.birthDate.slice(0, 4) : '';

    const person: Person = {
      id,
      name: data.nameCN || data.nameEN || undefined,
      nameCN: data.nameCN,
      nameEN: data.nameEN,
      surname: data.surname,
      gender: data.gender,
      birthDate: data.birthDate ?? null,
      birthYear: data.birthYear || birthYearFromDate,
      deathYear: data.deathYear,
      photoUrl: data.photoUrl,
      notes: data.notes,
      side: data.side,
      relationship: data.relationship || 'unknown',
      fatherId,
      motherId,
      parentIds,
      spouseIds: data.spouseIds,
      childrenIds: existing?.childrenIds || [],
      siblingsIds: existing?.siblingsIds || [],
      order: data.order,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    // ── create-root ──
    if (mode.kind === 'create-root') {
      await saveMember(person);
      await updateTree({ rootPersonId: person.id });
      return;
    }

    // ── create-parent ──
    if (mode.kind === 'create-parent') {
    await saveMember(person);
    const child = memberMap.get(mode.childId);
    if (child) {
      const updatedChild = {
        ...child,
        // Add to parentIds array and set specific gender slot
        fatherId: person.gender === 'male' ? person.id : child.fatherId,
        motherId: person.gender === 'female' ? person.id : child.motherId,
        parentIds: Array.from(new Set([...child.parentIds, person.id])),
        updatedAt: new Date(),
      };
      await saveMember(updatedChild);
    }
    return;
  }

    // ── create-child ──
    if (mode.kind === 'create-child') {
      const parentPerson = memberMap.get(mode.parentId);
      const siblings = (parentPerson?.childrenIds || [])
        .map((cid) => memberMap.get(cid))
        .filter(Boolean) as Person[];
      const nextOrder = siblings.length ? Math.max(...siblings.map((s) => s.order || 1)) + 1 : 1;
      person.order = nextOrder;

      await saveMember(person);

      // Wire child into the triggering parent's childrenIds
      if (parentPerson) {
        await saveMember({
          ...parentPerson,
          childrenIds: Array.from(new Set([...parentPerson.childrenIds, person.id])),
          updatedAt: now,
        });
      }

      // Also wire child into the OTHER parent if both are set
      const otherParentId = person.fatherId === mode.parentId ? person.motherId : person.fatherId;
      if (otherParentId) {
        const otherParent = memberMap.get(otherParentId);
        if (otherParent) {
          await saveMember({
            ...otherParent,
            childrenIds: Array.from(new Set([...otherParent.childrenIds, person.id])),
            updatedAt: now,
          });
        }
      }
      return;
    }

    // ── create-sibling ──
    if (mode.kind === 'create-sibling') {
      const sibling = memberMap.get(mode.personId);

      const finalFatherId = person.fatherId || (sibling?.fatherId || null);
      const finalMotherId = person.motherId || (sibling?.motherId || null);
      const finalParentIds = deriveParentIds(finalFatherId, finalMotherId);

      let siblingsList: Person[] = [];
      if (finalParentIds.length > 0) {
        const parent = memberMap.get(finalParentIds[0]);
        siblingsList = (parent?.childrenIds || [])
          .map((cid) => memberMap.get(cid))
          .filter(Boolean) as Person[];
      }
      const nextOrder = siblingsList.length ? Math.max(...siblingsList.map((s) => s.order || 1)) + 1 : 1;

      const newPerson = {
        ...person,
        fatherId: finalFatherId,
        motherId: finalMotherId,
        parentIds: finalParentIds,
        order: nextOrder,
        siblingsIds: Array.from(new Set([...(person.siblingsIds || []), mode.personId])) 
      };

      await saveMember(newPerson);

      for (const pid of finalParentIds) {
        const parent = memberMap.get(pid);
        if (parent) {
          await saveMember({
            ...parent,
            childrenIds: Array.from(new Set([...(parent.childrenIds || []), newPerson.id])),
            updatedAt: now,
          });
        }
      }

      if (sibling) {
        await saveMember({
          ...sibling,
          siblingsIds: Array.from(new Set([...(sibling.siblingsIds || []), newPerson.id])),
          updatedAt: now,
        });
      }
      return; 
    }

    // ── create-spouse ──
    if (mode.kind === 'create-spouse') {
      const p = memberMap.get(mode.personId);
      if (!p) { await saveMember(person); return; }

      const updatedSpouse: Person = {
        ...person,
        spouseIds: Array.from(new Set([...person.spouseIds, p.id])),
        parentIds: [],
        fatherId: null,
        motherId: null,
        childrenIds: [],
        order: 1,
        updatedAt: now,
      };
      await saveMember(updatedSpouse);
      await saveMember({
        ...p,
        spouseIds: Array.from(new Set([...p.spouseIds, person.id])),
        updatedAt: now,
      });
      return;
    }

    // ── edit ──
    // If parentIds changed, update old and new parent records
    const oldParentIds = existing?.parentIds || [];
    const addedParents = parentIds.filter((pid) => !oldParentIds.includes(pid));
    const removedParents = oldParentIds.filter((pid) => !parentIds.includes(pid));

    await saveMember(person);

    for (const pid of addedParents) {
      const parent = memberMap.get(pid);
      if (parent) {
        await saveMember({
          ...parent,
          childrenIds: Array.from(new Set([...parent.childrenIds, person.id])),
          updatedAt: now,
        });
      }
    }

    for (const pid of removedParents) {
      const parent = memberMap.get(pid);
      if (parent) {
        await saveMember({
          ...parent,
          childrenIds: parent.childrenIds.filter((cid) => cid !== person.id),
          updatedAt: now,
        });
      }
    }

    // If this person was the root and no longer has parents set, keep rootPersonId
    if (id === rootId && parentIds.length === 0) {
      // still root — no change needed
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async (personId: string) => {
    if (!confirm(t('tree.confirmDelete'))) return;
    await deleteMember(personId);
    if (selected?.id === personId) setSelectedId(null);
  };

  // ── Editor title / hint ───────────────────────────────────────────────────

  const editorTitle = (() => {
    if (!editor) return '';
    if (editor.kind === 'edit') return t('editor.editPerson');
    if (editor.kind === 'create-root') return t('editor.addRoot');
    if (editor.kind === 'create-parent') return t('panel.addParent');
    if (editor.kind === 'create-child') return t('tree.addChild');
    if (editor.kind === 'create-sibling') return t('tree.addSibling');
    return t('tree.addSpouse');
  })();

  const relationHint = (() => {
  if (!editor || editor.kind === 'edit' || editor.kind === 'create-root') return '';

  const targetId =
    editor.kind === 'create-child' ? editor.parentId :
    editor.kind === 'create-parent' ? editor.childId :
    editor.personId;
  const target = memberMap.get(targetId);
  const name = target ? getDisplayName(target, lang) : t('person.unnamed');

  if (editor.kind === 'create-child') {
    return `${name}${t('editor.relationHint.child')}`;
  }
  
  if (editor.kind === 'create-parent') {
    return `${name}${t('editor.relationHint.parent' as any)}`; 
  }
  if (editor.kind === 'create-sibling') {
    return `${name}${t('editor.relationHint.sibling')}`;
  }
  return `${name}${t('editor.relationHint.spouse')}`;
})();

  // ── Potential parents for selectors ──────────────────────────────────────

  const potentialFathers = useMemo(() => {
    if (!editor) return [];
    const editId = editor.kind === 'edit' ? editor.personId : undefined;
    const current = editId ? memberMap.get(editId) : undefined;
    const base = current
      // Exclude only the currently-set mother (not the father, so it stays selectable)
      ? potentialParents(current, members, current.motherId ? [current.motherId] : [], /*keepCurrentParents=*/true)
      : members;
    return base.filter((m) => m.gender === 'male');
  }, [editor, members, memberMap]);

  const potentialMothers = useMemo(() => {
    if (!editor) return [];
    const editId = editor.kind === 'edit' ? editor.personId : undefined;
    const current = editId ? memberMap.get(editId) : undefined;
    const base = current
      // Exclude only the currently-set father (not the mother, so it stays selectable)
      ? potentialParents(current, members, current.fatherId ? [current.fatherId] : [], /*keepCurrentParents=*/true)
      : members;
    return base.filter((m) => m.gender === 'female');
  }, [editor, members, memberMap]);

  // ── Filter buttons ────────────────────────────────────────────────────────

  const filterButton = (key: SideFilter, label: string) => (
    <button
      key={key}
      className={`btn btn-sm ${sideFilter === key ? 'btn-primary' : 'btn-secondary'}`}
      onClick={() => setSideFilter(key)}
    >
      {label}
    </button>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
      {/* ── Tree canvas ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '12px 16px',
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-light)',
        }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <h2 style={{ fontSize: 18 }}>{t('tree.title')}</h2>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{getTreeDisplayName(activeTree, lang)}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {filterButton('all', t('tree.all'))}
            {filterButton('paternal', t('tree.paternal'))}
            {filterButton('maternal', t('tree.maternal'))}
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>
          <TreeView
            members={members}
            rootId={rootId}
            sideFilter={sideFilter}
            selectedPersonId={selected?.id || null}
            onSelectPerson={(p) => setSelectedId(p.id)}
            onAddParent={(childId) => openEditor({kind: 'create-parent', childId})}
            onAddChild={(parentId) => openEditor({ kind: 'create-child', parentId })}
            onAddSibling={(personId) => openEditor({ kind: 'create-sibling', personId })}
            onAddSpouse={(personId) => openEditor({ kind: 'create-spouse', personId })}
            onEditPerson={(personId) => openEditor({ kind: 'edit', personId })}
            onAddRoot={() => openEditor({ kind: 'create-root' })}
          />
        </div>
      </div>

      {/* ── Right detail panel ── */}
      <aside style={{
        width: 300,
        maxWidth: '38vw',
        borderLeft: '1px solid var(--border-light)',
        background: 'var(--bg-card)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {!selected ? (
          <div className="empty-state" style={{ height: '100%' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M20 21v-2a4 4 0 0 0-3-3.87M4 21v-2a4 4 0 0 1 3-3.87" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <h3>{t('panel.selectMember')}</h3>
            <p>{t('panel.clickToView')}</p>
          </div>
        ) : (
          <DetailPanel
            person={selected}
            rel={rel}
            lang={lang}
            t={t}
            onClose={() => setSelectedId(null)}
            onSelect={(p) => setSelectedId(p.id)}
            onEdit={() => openEditor({ kind: 'edit', personId: selected.id })}
            onDelete={() => handleDelete(selected.id)}
          />
        )}
      </aside>

      {/* ── Person editor modal ── */}
      <Modal
        open={!!editor}
        title={editorTitle}
        onClose={() => { setEditor(null); setForm(emptyForm()); }}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => { setEditor(null); setForm(emptyForm()); }}>
              {t('common.cancel')}
            </button>
            <button
              className="btn btn-primary"
              disabled={!((form.nameCN || '').trim() || (form.nameEN || '').trim())}
              onClick={async () => {
                if (!editor) return;
                await upsertWithRelations(editor, form);
                setEditor(null);
                setForm(emptyForm());
              }}
            >
              {t('person.save')}
            </button>
          </>
        }
      >
        <PersonEditorForm
          form={form}
          setForm={setForm}
          editor={editor}
          relationHint={relationHint}
          potentialFathers={potentialFathers}
          potentialMothers={potentialMothers}
          t={t}
          lang={lang}
        />
      </Modal>
    </div>
  );
}

// ─── Detail Panel ────────────────────────────────────────────────────────────

interface RelHelpers {
  parentsOf: (p: Person) => Person[];
  fatherOf: (p: Person) => Person | null;
  motherOf: (p: Person) => Person | null;
  spousesOf: (p: Person) => Person[];
  childrenOf: (p: Person) => Person[];
  siblingsOf: (p: Person) => Person[];
}

function DetailPanel({
  person,
  rel,
  lang,
  t,
  onClose,
  onSelect,
  onEdit,
  onDelete,
}: {
  person: Person;
  rel: RelHelpers;
  lang: Language;
  t: (key: TranslationKey) => string;
  onClose: () => void;
  onSelect: (p: Person) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const father = rel.fatherOf(person);
  const mother = rel.motherOf(person);
  const spouses = rel.spousesOf(person);
  const children = rel.childrenOf(person);
  const siblings = rel.siblingsOf(person);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--border-light)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-chinese)',
            fontWeight: 800,
            fontSize: 18,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {getDisplayName(person, lang) || t('person.unnamed')}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {[
              person.birthYear || null,
              getRelationshipLabel(person.relationship ?? 'unknown', lang),
            ].filter(Boolean).join(' · ')}
          </div>
        </div>
        <button className="btn-icon" onClick={onClose} aria-label="Close" style={{ flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Action buttons */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--border-light)',
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
      }}>
        <button className="btn btn-secondary btn-sm" onClick={onEdit}>{t('tree.edit')}</button>
        <button className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }} onClick={onDelete}>{t('tree.delete')}</button>
      </div>

      {/* Relations scroll area */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Parents — father left / mother right */}
        <section>
          <SectionLabel>{t('panel.parents')}</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
            <ParentSlot
              label={lang === 'zh' ? '父' : 'Father'}
              person={father}
              onSelect={onSelect}
              t={t}
            />
            <ParentSlot
              label={lang === 'zh' ? '母' : 'Mother'}
              person={mother}
              onSelect={onSelect}
              t={t}
            />
          </div>
        </section>

        {/* Spouses */}
        <RelSection
          title={t('panel.spouses')}
          people={spouses}
          onPick={onSelect}
          lang={lang}
          t={t}
          badge={(p) => {
            if (p.relationship === 'divorced') return lang === 'zh' ? '离异' : 'Ex';
            if (p.relationship === 'separated') return lang === 'zh' ? '分居' : 'Sep';
            return undefined;
          }}
        />

        {/* Children */}
        <RelSection title={t('panel.children')} people={children} onPick={onSelect} lang={lang} t={t} />

        {/* Siblings */}
        <RelSection title={t('panel.siblings')} people={siblings} onPick={onSelect} lang={lang} t={t} />

        {/* Notes */}
        {person.notes ? (
          <section>
            <SectionLabel>{t('person.notes')}</SectionLabel>
            <div style={{
              marginTop: 6,
              whiteSpace: 'pre-wrap',
              fontFamily: 'var(--font-chinese)',
              color: 'var(--text-secondary)',
              lineHeight: 1.8,
              fontSize: 13,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
              padding: 10,
            }}>
              {person.notes}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--font-chinese)',
      fontWeight: 700,
      fontSize: 12,
      color: 'var(--text-tertiary)',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    }}>
      {children}
    </div>
  );
}

function ParentSlot({
  label,
  person,
  onSelect,
  t,
}: {
  label: string;
  person: Person | null;
  onSelect: (p: Person) => void;
  t: (key: TranslationKey) => string;
}) {
  return (
    <div style={{
      border: '1px solid var(--border-light)',
      borderRadius: 'var(--radius-md)',
      padding: '8px 10px',
      background: 'var(--bg-secondary)',
      minHeight: 52,
    }}>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 3, fontWeight: 600 }}>{label}</div>
      {person ? (
        <button
          onClick={() => onSelect(person)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontFamily: 'var(--font-chinese)',
            fontWeight: 600,
            fontSize: 13,
            color: 'var(--accent-gold-dark)',
            textAlign: 'left',
          }}
        >
          {getDisplayName(person, 'zh') || getDisplayName(person, 'en') || t('person.unnamed')}
        </button>
      ) : (
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{t('panel.none')}</span>
      )}
    </div>
  );
}

function RelSection({
  title,
  people,
  onPick,
  lang,
  t,
  badge,
}: {
  title: string;
  people: Person[];
  onPick: (p: Person) => void;
  lang: Language;
  t: (key: TranslationKey) => string;
  badge?: (p: Person) => string | undefined;
}) {
  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <SectionLabel>{title}</SectionLabel>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{people.length}</span>
      </div>
      {people.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{t('panel.none')}</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {people.map((p) => (
            <button
              key={p.id}
              className="btn btn-secondary btn-sm"
              onClick={() => onPick(p)}
              style={{ padding: '5px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
              title={getDisplayName(p, lang) || t('person.unnamed')}
            >
              {getDisplayName(p, lang) || t('person.unnamed')}
              {badge?.(p) && (
                <span style={{
                  fontSize: 10,
                  background: 'var(--accent-warm)',
                  color: 'white',
                  borderRadius: 4,
                  padding: '1px 4px',
                }}>
                  {badge(p)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Person Editor Form ───────────────────────────────────────────────────────

import React from 'react';

function PersonEditorForm({
  form,
  setForm,
  editor,
  relationHint,
  potentialFathers,
  potentialMothers,
  t,
  lang,
}: {
  form: PersonFormData;
  setForm: React.Dispatch<React.SetStateAction<PersonFormData>>;
  editor: EditorMode | null;
  relationHint: string;
  potentialFathers: Person[];
  potentialMothers: Person[];
  t: (key: TranslationKey) => string;
  lang: Language;
}) {
  const isSpouse = editor?.kind === 'create-spouse';
  const isRoot = editor?.kind === 'create-root';
  const showParents = !isSpouse; // spouses don't get parent fields by default

  const set = <K extends keyof PersonFormData>(key: K, val: PersonFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {relationHint && (
        <div style={{
          color: 'var(--text-tertiary)',
          fontSize: 12,
          lineHeight: 1.5,
          background: 'var(--bg-secondary)',
          padding: '8px 10px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-light)',
        }}>
          {relationHint}
        </div>
      )}

      {/* Name row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="form-group">
          <label className="form-label">{t('person.nameCN')}</label>
          <input
            className="form-input"
            value={form.nameCN}
            onChange={(e) => set('nameCN', e.target.value)}
            autoFocus
          />
        </div>
        <div className="form-group">
          <label className="form-label">{t('person.nameEN')}</label>
          <input
            className="form-input"
            value={form.nameEN}
            onChange={(e) => set('nameEN', e.target.value)}
          />
        </div>
      </div>

      {/* Gender + Relationship type */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="form-group">
          <label className="form-label">{t('person.gender')}</label>
          <select
            className="form-select"
            value={form.gender}
            onChange={(e) => set('gender', e.target.value as 'male' | 'female')}
          >
            <option value="male">{t('person.male')}</option>
            <option value="female">{t('person.female')}</option>
          </select>
        </div>
        {isSpouse ? (
          <div className="form-group">
            <label className="form-label">{t('editor.spouseType')}</label>
            <select
              className="form-select"
              value={form.relationship}
              onChange={(e) => set('relationship', e.target.value as Person['relationship'])}
            >
              <option value="married">{t('relationship.married')}</option>
              <option value="divorced">{t('relationship.divorced')}</option>
              <option value="separated">{t('relationship.separated')}</option>
            </select>
          </div>
        ) : !isRoot && (
          <div className="form-group">
            <label className="form-label">{t('person.relationship')}</label>
            <select
              className="form-select"
              value={form.relationship}
              onChange={(e) => set('relationship', e.target.value as Person['relationship'])}
            >
              <option value="direct">{t('relationship.direct')}</option>
              <option value="sibling">{t('relationship.sibling')}</option>
              <option value="collateral">{t('relationship.collateral')}</option>
              <option value="step">{t('relationship.step')}</option>
              <option value="adoptive">{t('relationship.adoptive')}</option>
              <option value="unknown">{t('relationship.unknown')}</option>
            </select>
          </div>
        )}
      </div>

      {/* Side — only show for collateral or when editing */}
      {(form.relationship === 'collateral' || editor?.kind === 'edit') && (
        <div className="form-group">
          <label className="form-label">{t('person.side')}</label>
          <select
            className="form-select"
            value={form.side}
            onChange={(e) => set('side', e.target.value as Person['side'])}
          >
            <option value="paternal">{t('person.paternal')}</option>
            <option value="maternal">{t('person.maternal')}</option>
            <option value="self">{t('person.self')}</option>
          </select>
        </div>
      )}

      {/* Full relationship selector — only in edit mode */}
      {editor?.kind === 'edit' && (
        <div className="form-group">
          <label className="form-label">{t('person.relationship')}</label>
          <select
            className="form-select"
            value={form.relationship}
            onChange={(e) => set('relationship', e.target.value as Person['relationship'])}
          >
            <option value="self">{t('relationship.self')}</option>
            <option value="direct">{t('relationship.direct')}</option>
            <option value="sibling">{t('relationship.sibling')}</option>
            <option value="collateral">{t('relationship.collateral')}</option>
            <option value="married">{t('relationship.married')}</option>
            <option value="divorced">{t('relationship.divorced')}</option>
            <option value="separated">{t('relationship.separated')}</option>
            <option value="step">{t('relationship.step')}</option>
            <option value="adoptive">{t('relationship.adoptive')}</option>
            <option value="unknown">{t('relationship.unknown')}</option>
          </select>
        </div>
      )}

      {/* Birth / Death */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="form-group">
          <label className="form-label">{t('person.birthYear')}</label>
          <input
            className="form-input"
            type="date"
            value={form.birthDate || ''}
            onChange={(e) => {
              const birthDate = e.target.value || null;
              setForm((p) => ({
                ...p,
                birthDate,
                birthYear: birthDate ? birthDate.slice(0, 4) : p.birthYear,
              }));
            }}
          />
        </div>
        <div className="form-group">
          <label className="form-label">{t('person.deathYear')}</label>
          <input
            className="form-input"
            value={form.deathYear || ''}
            placeholder="e.g. 2020"
            onChange={(e) => set('deathYear', e.target.value || null)}
          />
        </div>
      </div>

      {/* Parents — father left, mother right */}
      {showParents && !isRoot && (
        <div className="form-group">
          <label className="form-label" style={{ marginBottom: 6 }}>
            {t('person.parents')}
            <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 6 }}>
              — {t('person.parentsHint')}
            </span>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {/* Father */}
            <div className="form-group">
              <label className="form-label" style={{ fontSize: 11 }}>{t('person.father')}</label>
              <select
                className="form-select"
                value={form.fatherId || ''}
                onChange={(e) => {
                  const fatherId = e.target.value || null;
                  setForm((prev) => ({
                    ...prev,
                    fatherId,
                    parentIds: deriveParentIds(fatherId, prev.motherId),
                  }));
                }}
              >
                <option value="">{t('person.noPerson')}</option>
                {potentialFathers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {getDisplayName(m, lang) || t('person.unnamed')}
                  </option>
                ))}
              </select>
            </div>
            {/* Mother */}
            <div className="form-group">
              <label className="form-label" style={{ fontSize: 11 }}>{t('person.mother')}</label>
              <select
                className="form-select"
                value={form.motherId || ''}
                onChange={(e) => {
                  const motherId = e.target.value || null;
                  setForm((prev) => ({
                    ...prev,
                    motherId,
                    parentIds: deriveParentIds(prev.fatherId, motherId),
                  }));
                }}
              >
                <option value="">{t('person.noPerson')}</option>
                {potentialMothers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {getDisplayName(m, lang) || t('person.unnamed')}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="form-group">
        <label className="form-label">{t('person.notes')}</label>
        <textarea
          className="form-textarea"
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder={t('person.notesPlaceholder')}
        />
      </div>
    </div>
  );
}