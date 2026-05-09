import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useI18n } from '../contexts/I18nContext';
import { useTree } from '../contexts/TreeContext';
import type { Person } from '../types';

function PersonCard({ person, onClick }: { person: Person; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-lg)',
        padding: 14,
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <div style={{ width: 46, height: 46, borderRadius: 9999, background: 'var(--bg-tertiary)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-chinese)', fontWeight: 700, color: 'var(--text-secondary)' }}>
        {person.name?.charAt(0) || '?'}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-chinese)', fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {person.name || '未命名'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {person.birthYear || '—'} · {person.side}
        </div>
      </div>
    </button>
  );
}

export default function GalleryPage() {
  const { t } = useI18n();
  const { activeTree, members } = useTree();
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  if (!activeTree) return <Navigate to="/" replace />;

  const filtered = useMemo(() => {
    const query = q.trim();
    if (!query) return members;
    return members.filter((m) => (m.name || '').includes(query) || (m.surname || '').includes(query));
  }, [members, q]);

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22 }}>{t('gallery.title')}</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{activeTree.name}</p>
        </div>
        <input className="form-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('gallery.search')} style={{ width: 260 }} />
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M20 21v-2a4 4 0 0 0-3-3.87M4 21v-2a4 4 0 0 1 3-3.87" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <h3>{t('gallery.noMembers')}</h3>
          <button className="btn btn-primary" onClick={() => navigate('/tree')}>
            {t('gallery.addFirst')}
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {filtered.map((m) => (
            <PersonCard key={m.id} person={m} onClick={() => navigate('/tree')} />
          ))}
        </div>
      )}
    </div>
  );
}

