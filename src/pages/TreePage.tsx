import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import TreeView from '../components/TreeView/TreeView';
import Modal from '../components/common/Modal';
import { useI18n } from '../contexts/I18nContext';
import { useTree } from '../contexts/TreeContext';
import type { Person, PersonFormData, SideFilter } from '../types';
import { generateId } from '../utils/helpers';

type EditorMode =
  | { kind: 'create-root' }
  | { kind: 'create-child'; parentId: string }
  | { kind: 'create-spouse'; personId: string }
  | { kind: 'edit'; personId: string };

const emptyForm = (): PersonFormData => ({
  name: '',
  surname: '',
  gender: 'male',
  birthYear: '',
  deathYear: null,
  photoUrl: null,
  notes: '',
  side: 'paternal',
  parentIds: [],
  spouseIds: [],
  order: 1,
});

export default function TreePage() {
  const { t } = useI18n();
  const { activeTree, members, sideFilter, setSideFilter, saveMember, deleteMember, updateTree } = useTree();

  const [selected, setSelected] = useState<Person | null>(null);
  const [editor, setEditor] = useState<EditorMode | null>(null);
  const [form, setForm] = useState<PersonFormData>(emptyForm);

  const rootId = activeTree?.rootPersonId || '';
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  if (!activeTree) return <Navigate to="/" replace />;

  const openEditor = (mode: EditorMode) => {
    setSelected(null);
    setEditor(mode);
    if (mode.kind === 'edit') {
      const p = memberMap.get(mode.personId);
      if (p) {
        const { id: _id, createdAt: _c, updatedAt: _u, childrenIds: _kids, ...rest } = p;
        setForm({ ...rest, id: p.id });
      }
    } else {
      setForm(emptyForm());
      if (mode.kind === 'create-root') {
        setForm((prev) => ({ ...prev, side: 'paternal', parentIds: [] }));
      }
      if (mode.kind === 'create-child') {
        setForm((prev) => ({ ...prev, parentIds: [mode.parentId] }));
      }
      if (mode.kind === 'create-spouse') {
        // default spouse side follows the person
        const p = memberMap.get(mode.personId);
        if (p) setForm((prev) => ({ ...prev, side: p.side }));
      }
    }
  };

  const upsertWithRelations = async (mode: EditorMode, data: PersonFormData) => {
    const now = new Date();
    const id = data.id || generateId();

    const existing = memberMap.get(id);
    const person: Person = {
      id,
      name: data.name,
      surname: data.surname,
      gender: data.gender,
      birthYear: data.birthYear,
      deathYear: data.deathYear,
      photoUrl: data.photoUrl,
      notes: data.notes,
      side: data.side,
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

  const filterButton = (key: SideFilter, label: string) => (
    <button
      className={`btn btn-sm ${sideFilter === key ? 'btn-primary' : 'btn-secondary'}`}
      onClick={() => setSideFilter(key)}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' }}>
      <div style={{ padding: 16, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <h2 style={{ fontSize: 18 }}>{t('tree.title')}</h2>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{activeTree.name}</span>
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
          onSelectPerson={(p) => setSelected(p)}
          onAddChild={(parentId) => openEditor({ kind: 'create-child', parentId })}
          onAddSpouse={(personId) => openEditor({ kind: 'create-spouse', personId })}
          onAddRoot={() => openEditor({ kind: 'create-root' })}
        />
      </div>

      {selected ? (
        <div style={{ position: 'sticky', bottom: 0, borderTop: '1px solid var(--border-light)', background: 'var(--bg-card)', padding: 12, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontFamily: 'var(--font-chinese)', fontWeight: 700 }}>{selected.name || '未命名'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{selected.birthYear || '—'} · {selected.side}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => openEditor({ kind: 'edit', personId: selected.id })}>
              {t('tree.edit')}
            </button>
            <button className="btn btn-danger" onClick={() => handleDelete(selected.id)}>
              {t('tree.delete')}
            </button>
          </div>
        </div>
      ) : null}

      <Modal
        open={!!editor}
        title={
          editor?.kind === 'edit' ? t('tree.edit')
            : editor?.kind === 'create-root' ? t('tree.addRoot')
              : editor?.kind === 'create-child' ? t('tree.addChild')
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
              disabled={!form.name.trim()}
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
          <div className="form-group">
            <label className="form-label">{t('person.name')}</label>
            <input className="form-input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
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
              <label className="form-label">{t('person.side')}</label>
              <select className="form-select" value={form.side} onChange={(e) => setForm((p) => ({ ...p, side: e.target.value as Person['side'] }))}>
                <option value="paternal">{t('person.paternal')}</option>
                <option value="maternal">{t('person.maternal')}</option>
                <option value="self">{t('person.self')}</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">{t('person.birthYear')}</label>
              <input className="form-input" value={form.birthYear} onChange={(e) => setForm((p) => ({ ...p, birthYear: e.target.value }))} />
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
                    {m.name || '未命名'}
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

