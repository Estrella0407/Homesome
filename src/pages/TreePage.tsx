import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import TreeView from '../components/tree_view/TreeView';
import Modal from '../components/common/Modal';
import { useI18n } from '../contexts/I18nContext';
import { useTree } from '../contexts/TreeContext';
import type { Person, PersonFormData, SideFilter } from '../types';
import type { Language, TranslationKey } from '../utils/i18n';
import { getDisplayName, getTreeDisplayName, getRelationshipLabel, generateId } from '../utils/helpers';

type EditorMode =
  | { kind: 'create-root' }
  | { kind: 'create-child'; parentId: string }
  | { kind: 'create-parent'; childId: string }
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
  parentIds: [],
  spouseIds: [],
  order: 1,
});

export default function TreePage() {
  const { t, lang } = useI18n();
  const { activeTree, members, sideFilter, setSideFilter, saveMember, deleteMember, updateTree, treesLoaded } = useTree();

  const [selected, setSelected] = useState<Person | null>(null);
  const [editor, setEditor] = useState<EditorMode | null>(null);
  const [form, setForm] = useState<PersonFormData>(emptyForm);

  const rootId = activeTree?.rootPersonId || '';
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  if (!activeTree) {
    if (!treesLoaded) return null;
    return <Navigate to="/" replace />;
  }

  const rel = useMemo(() => {
    const byId = memberMap;
    const get = (id: string) => byId.get(id) || null;
    const parentsOf = (p: Person) => p.parentIds.map(get).filter(Boolean) as Person[];
    const spousesOf = (p: Person) => p.spouseIds.map(get).filter(Boolean) as Person[];
    const childrenOf = (p: Person) => p.childrenIds.map(get).filter(Boolean) as Person[];
    const siblingsOf = (p: Person) => {
      const parents = parentsOf(p);
      const sibIds = new Set<string>();
      for (const parent of parents) {
        for (const cid of parent.childrenIds) {
          if (cid && cid !== p.id) sibIds.add(cid);
        }
      }
      return Array.from(sibIds).map(get).filter(Boolean) as Person[];
    };
    const cousinsOf = (p: Person) => {
      const parents = parentsOf(p);
      const cousinIds = new Set<string>();
      for (const parent of parents) {
        const auntsUncles = siblingsOf(parent);
        for (const au of auntsUncles) {
          for (const cid of au.childrenIds) {
            if (cid) cousinIds.add(cid);
          }
        }
      }
      // remove siblings/self
      cousinIds.delete(p.id);
      for (const s of siblingsOf(p)) cousinIds.delete(s.id);
      return Array.from(cousinIds).map(get).filter(Boolean) as Person[];
    };

    return { get, parentsOf, spousesOf, childrenOf, siblingsOf, cousinsOf };
  }, [memberMap]);

  const openEditor = (mode: EditorMode) => {
    setEditor(mode);
    if (mode.kind === 'edit') {
      const p = memberMap.get(mode.personId);
      if (p) {
        const {
          id: _id,
          createdAt: _c,
          updatedAt: _u,
          childrenIds: _kids,
          nameCN,
          nameEN,
          name,
          relationship,
          ...rest
        } = p;
        setForm({
          ...rest,
          id: p.id,
          nameCN: nameCN || name || '',
          nameEN: nameEN || name || '',
          relationship: relationship || 'unknown',
        });
      }
    } else {
      setForm(emptyForm());
      if (mode.kind === 'create-root') {
        setForm((prev) => ({ ...prev, side: 'self', relationship: 'self', parentIds: [] }));
      }
      if (mode.kind === 'create-child') {
        setForm((prev) => ({ ...prev, parentIds: [mode.parentId], relationship: 'direct' }));
      }
      if (mode.kind === 'create-parent') {
        // parent is a root-ish node: no parentIds by default
        setForm((prev) => ({ ...prev, parentIds: [], relationship: 'direct' }));
        const child = memberMap.get(mode.childId);
        if (child) {
          // inherit side unless child is 'self'
          setForm((prev) => ({ ...prev, side: child.side === 'self' ? 'paternal' : child.side }));
        }
      }
      if (mode.kind === 'create-sibling') {
        const p = memberMap.get(mode.personId);
        if (p) {
          setForm((prev) => ({ ...prev, parentIds: [...p.parentIds], side: p.side, relationship: 'sibling' }));
        }
      }
      if (mode.kind === 'create-spouse') {
        // default spouse side follows the person
        const p = memberMap.get(mode.personId);
        if (p) setForm((prev) => ({ ...prev, side: p.side, relationship: 'married' }));
      }
    }
  };

  const upsertWithRelations = async (mode: EditorMode, data: PersonFormData) => {
    const now = new Date();
    const id = data.id || generateId();

    const existing = memberMap.get(id);
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
      parentIds: data.parentIds,
      spouseIds: data.spouseIds,
      childrenIds: existing?.childrenIds || [],
      order: data.order,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    if (mode.kind === 'create-root') {
      await saveMember(person);
      await updateTree({ rootPersonId: person.id });
      return;
    }

    if (mode.kind === 'create-child') {
      const parent = memberMap.get(mode.parentId);
      const siblings = (parent?.childrenIds || []).map((cid) => memberMap.get(cid)).filter(Boolean) as Person[];
      const nextOrder = siblings.length ? Math.max(...siblings.map((s) => s.order || 1)) + 1 : 1;
      person.parentIds = [mode.parentId];
      person.order = nextOrder;

      await saveMember(person);

      if (parent) {
        const updatedParent: Person = {
          ...parent,
          childrenIds: Array.from(new Set([...parent.childrenIds, person.id])),
          updatedAt: now,
        };
        await saveMember(updatedParent);
      }
      return;
    }

    if (mode.kind === 'create-parent') {
      const child = memberMap.get(mode.childId);

      const updatedParent: Person = {
        ...person,
        childrenIds: child ? Array.from(new Set([...person.childrenIds, child.id])) : person.childrenIds,
        updatedAt: now,
      };
      await saveMember(updatedParent);

      if (child) {
        const updatedChild: Person = {
          ...child,
          parentIds: Array.from(new Set([...child.parentIds, person.id])),
          updatedAt: now,
        };
        await saveMember(updatedChild);

        if (child.id === rootId) {
          await updateTree({ rootPersonId: updatedParent.id });
        }
      }
      return;
    }

    if (mode.kind === 'create-sibling') {
      const target = memberMap.get(mode.personId);
      if (!target) {
        await saveMember(person);
        return;
      }
      // copy parents; set birth order after current max among these parents
      person.parentIds = [...target.parentIds];
      const siblingGroup = rel.siblingsOf(target);
      const all = [target, ...siblingGroup];
      const nextOrder = all.length ? Math.max(...all.map((s) => s.order || 1)) + 1 : 1;
      person.order = nextOrder;

      await saveMember(person);
      // ensure parents include this child
      for (const pid of target.parentIds) {
        const parent = memberMap.get(pid);
        if (!parent) continue;
        const updatedParent: Person = {
          ...parent,
          childrenIds: Array.from(new Set([...parent.childrenIds, person.id])),
          updatedAt: now,
        };
        await saveMember(updatedParent);
      }
      return;
    }

    if (mode.kind === 'create-spouse') {
      const p = memberMap.get(mode.personId);
      if (!p) {
        await saveMember(person);
        return;
      }

      await saveMember(person);
      const updatedA: Person = { ...p, spouseIds: [person.id], updatedAt: now };
      const updatedB: Person = { ...person, spouseIds: [p.id], parentIds: [], order: 1, childrenIds: [], createdAt: person.createdAt, updatedAt: now };
      await saveMember(updatedA);
      await saveMember(updatedB);
      return;
    }

    // edit
    await saveMember(person);
  };

  const handleDelete = async (personId: string) => {
    if (!confirm(t('tree.confirmDelete'))) return;
    await deleteMember(personId);
    setSelected(null);
  };

  const relationHint = (() => {
    if (!editor || editor.kind === 'edit') return '';
    if (editor.kind === 'create-root') return '正在添加家族树根成员。';
    const target = editor.kind === 'create-child'
      ? memberMap.get(editor.parentId)
      : editor.kind === 'create-parent'
        ? memberMap.get(editor.childId)
        : memberMap.get(editor.personId);
    const targetName = target ? getDisplayName(target, lang) : t('person.unnamed');
    if (editor.kind === 'create-child') return `正在为 ${targetName} 添加子女。`;
    if (editor.kind === 'create-parent') return `正在为 ${targetName} 添加父/母。`;
    if (editor.kind === 'create-sibling') return `正在为 ${targetName} 添加兄弟姐妹。`;
    if (editor.kind === 'create-spouse') return `正在为 ${targetName} 添加配偶。`;
    return '';
  })();

  const filterButton = (key: SideFilter, label: string) => (
    <button
      className={`btn btn-sm ${sideFilter === key ? 'btn-primary' : 'btn-secondary'}`}
      onClick={() => setSideFilter(key)}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 16, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)' }}>
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
          onSelectPerson={(p) => setSelected(p)}
          onAddChild={(parentId) => openEditor({ kind: 'create-child', parentId })}
          onAddSpouse={(personId) => openEditor({ kind: 'create-spouse', personId })}
          onAddParent={(childId) => openEditor({ kind: 'create-parent', childId })}
          onAddSibling={(personId) => openEditor({ kind: 'create-sibling', personId })}
          onAddRoot={() => openEditor({ kind: 'create-root' })}
        />
      </div>
      </div>

      <aside style={{
        width: 340,
        maxWidth: '40vw',
        borderLeft: '1px solid var(--border-light)',
        background: 'var(--bg-card)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {!selected ? (
          <div className="empty-state" style={{ height: '100%' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M20 21v-2a4 4 0 0 0-3-3.87M4 21v-2a4 4 0 0 1 3-3.87" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <h3>选择成员</h3>
            <p>点击族谱上的成员查看详细信息</p>
          </div>
        ) : (
          <div style={{ padding: 16, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontFamily: 'var(--font-chinese)', fontWeight: 800, fontSize: 18 }}>
                  {getDisplayName(selected, lang) || t('person.unnamed')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {(selected.birthDate || selected.birthYear || '—')} · {getRelationshipLabel(selected.relationship ?? 'unknown', lang)}
                </div>
              </div>
              <button className="btn-icon" onClick={() => setSelected(null)} aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => openEditor({ kind: 'edit', personId: selected.id })}>{t('tree.edit')}</button>
              <button className="btn btn-secondary btn-sm" onClick={() => openEditor({ kind: 'create-parent', childId: selected.id })}>+ 父/母</button>
              <button className="btn btn-secondary btn-sm" onClick={() => openEditor({ kind: 'create-sibling', personId: selected.id })}>+ 兄弟姐妹</button>
              <button className="btn btn-secondary btn-sm" onClick={() => openEditor({ kind: 'create-spouse', personId: selected.id })}>+ 配偶</button>
              <button className="btn btn-secondary btn-sm" onClick={() => openEditor({ kind: 'create-child', parentId: selected.id })}>+ 子女</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(selected.id)}>{t('tree.delete')}</button>
            </div>

            <RelSection
              title="父母"
              people={rel.parentsOf(selected)}
              onPick={(p) => setSelected(p)}
              lang={lang}
              t={t}
            />
            <RelSection
              title="配偶"
              people={rel.spousesOf(selected)}
              onPick={(p) => setSelected(p)}
              lang={lang}
              t={t}
            />
            <RelSection
              title="子女"
              people={rel.childrenOf(selected)}
              onPick={(p) => setSelected(p)}
              lang={lang}
              t={t}
            />
            <RelSection
              title="兄弟姐妹"
              people={rel.siblingsOf(selected)}
              onPick={(p) => setSelected(p)}
              lang={lang}
              t={t}
            />
            <RelSection
              title="堂/表兄弟姐妹"
              people={rel.cousinsOf(selected)}
              onPick={(p) => setSelected(p)}
              lang={lang}
              t={t}
            />

            <div style={{ marginTop: 6 }}>
              <div className="form-label" style={{ marginBottom: 6 }}>备注</div>
              <div style={{
                whiteSpace: 'pre-wrap',
                fontFamily: 'var(--font-chinese)',
                color: selected.notes ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                lineHeight: 1.8,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-lg)',
                padding: 12,
              }}>
                {selected.notes || '暂无'}
              </div>
            </div>
          </div>
        )}
      </aside>

      <Modal
        open={!!editor}
        title={
          editor?.kind === 'edit' ? t('tree.edit')
            : editor?.kind === 'create-root' ? t('tree.addRoot')
              : editor?.kind === 'create-child' ? t('tree.addChild')
                : editor?.kind === 'create-parent' ? '+ 父/母'
                  : editor?.kind === 'create-sibling' ? '+ 兄弟姐妹'
                    : t('tree.addSpouse')
        }
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {relationHint ? (
            <div style={{ color: 'var(--text-tertiary)', fontSize: 13, lineHeight: 1.5 }}>
              {relationHint}
            </div>
          ) : null}
          <div className="form-group">
            <label className="form-label">{t('person.nameCN')}</label>
            <input className="form-input" value={form.nameCN} onChange={(e) => setForm((p) => ({ ...p, nameCN: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('person.nameEN')}</label>
            <input className="form-input" value={form.nameEN} onChange={(e) => setForm((p) => ({ ...p, nameEN: e.target.value }))} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">{t('person.gender')}</label>
              <select className="form-select" value={form.gender} onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value as 'male' | 'female' }))}>
                <option value="male">{t('person.male')}</option>
                <option value="female">{t('person.female')}</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('person.relationship')}</label>
              <select className="form-select" value={form.relationship} onChange={(e) => setForm((p) => ({ ...p, relationship: e.target.value as Person['relationship'] }))}>
                <option value="self">{t('relationship.self')}</option>
                <option value="direct">{t('relationship.direct')}</option>
                <option value="sibling">{t('relationship.sibling')}</option>
                <option value="collateral">{t('relationship.collateral')}</option>
                <option value="divorced">{t('relationship.divorced')}</option>
                <option value="married">{t('relationship.married')}</option>
                <option value="step">{t('relationship.step')}</option>
                <option value="adoptive">{t('relationship.adoptive')}</option>
                <option value="unknown">{t('relationship.unknown')}</option>
              </select>
            </div>
          </div>
          {form.relationship === 'collateral' ? (
            <div className="form-group">
              <label className="form-label">{t('person.side')}</label>
              <select className="form-select" value={form.side} onChange={(e) => setForm((p) => ({ ...p, side: e.target.value as Person['side'] }))}>
                <option value="paternal">{t('person.paternal')}</option>
                <option value="maternal">{t('person.maternal')}</option>
              </select>
            </div>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
              <input className="form-input" value={form.deathYear || ''} onChange={(e) => setForm((p) => ({ ...p, deathYear: e.target.value || null }))} />
            </div>
          </div>

          {editor?.kind === 'edit' || editor?.kind === 'create-root' ? (
            <div className="form-group">
              <label className="form-label">{t('person.parent')}</label>
              <select
                className="form-select"
                value={form.parentIds[0] || ''}
                onChange={(e) => setForm((p) => ({ ...p, parentIds: e.target.value ? [e.target.value] : [] }))}
              >
                <option value="">{t('person.noParent')}</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {getDisplayName(m, lang) || t('person.unnamed')}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="form-group">
            <label className="form-label">{t('person.notes')}</label>
            <textarea className="form-textarea" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder={t('person.notesPlaceholder')} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function RelSection({ title, people, onPick, lang, t }: { title: string; people: Person[]; onPick: (p: Person) => void; lang: Language; t: (key: TranslationKey) => string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: 'var(--font-chinese)', fontWeight: 700, color: 'var(--text-secondary)' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{people.length}</div>
      </div>
      {people.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>暂无</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {people.map((p) => (
            <button
              key={p.id}
              className="btn btn-secondary btn-sm"
              onClick={() => onPick(p)}
              style={{ padding: '6px 10px' }}
              title={getDisplayName(p, lang) || t('person.unnamed')}
            >
              {getDisplayName(p, lang) || t('person.unnamed')}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

