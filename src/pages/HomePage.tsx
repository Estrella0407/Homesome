import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../contexts/I18nContext';
import { useTree } from '../contexts/TreeContext';
import Modal from '../components/common/Modal';

export default function HomePage() {
  const { t } = useI18n();
  const { trees, activeTree, setActiveTree, createTree, joinTree, loading } = useTree();
  const navigate = useNavigate();

  const [createOpen, setCreateOpen] = useState(false);
  const [treeName, setTreeName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const ownedTrees = useMemo(() => trees, [trees]);

  const handleOpenTree = (treeId: string) => {
    const tree = trees.find((t) => t.id === treeId) || null;
    setActiveTree(tree);
    navigate('/tree');
  };

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22 }}>{t('home.myTrees')}</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{t('app.tagline')}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => setCreateOpen(true)}>
            {t('home.createTree')}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        {ownedTrees.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="5" r="3" />
              <line x1="12" y1="8" x2="12" y2="14" />
              <circle cx="6" cy="19" r="3" />
              <circle cx="18" cy="19" r="3" />
              <path d="M12 14l-6 2M12 14l6 2" />
            </svg>
            <h3>{t('home.noTrees')}</h3>
            <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
              {t('home.createTree')}
            </button>
          </div>
        ) : (
          ownedTrees.map((tree) => (
            <button
              key={tree.id}
              onClick={() => handleOpenTree(tree.id)}
              style={{
                textAlign: 'left',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-lg)',
                padding: 16,
                boxShadow: 'var(--shadow-sm)',
                transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-chinese)', fontSize: 16, fontWeight: 700 }}>{tree.name}</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {tree.shareCode} · {tree.rootPersonId ? '已设置根节点' : '未设置根节点'}
                  </div>
                </div>
                {activeTree?.id === tree.id ? (
                  <span className="side-tag self">Active</span>
                ) : null}
              </div>
            </button>
          ))
        )}
      </div>

      <div style={{ marginTop: 8, background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 16 }}>{t('home.joinTree')}</h3>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            className="form-input"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder={t('home.joinPlaceholder')}
            style={{ flex: '1 1 220px' }}
          />
          <button
            className="btn btn-primary"
            disabled={!joinCode.trim() || loading}
            onClick={async () => {
              setError(null);
              const tree = await joinTree(joinCode.trim());
              if (!tree) {
                setError('分享码无效');
                return;
              }
              setActiveTree(tree);
              navigate('/tree');
            }}
          >
            {t('home.join')}
          </button>
        </div>
        {error ? <div style={{ color: 'var(--accent-red)', fontSize: 12 }}>{error}</div> : null}
      </div>

      <Modal
        open={createOpen}
        title={t('home.createTree')}
        onClose={() => { setCreateOpen(false); setTreeName(''); }}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => { setCreateOpen(false); setTreeName(''); }}>
              {t('home.cancel')}
            </button>
            <button
              className="btn btn-primary"
              disabled={!treeName.trim()}
              onClick={async () => {
                const tree = await createTree(treeName.trim());
                setCreateOpen(false);
                setTreeName('');
                setActiveTree(tree);
                navigate('/tree');
              }}
            >
              {t('home.create')}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">{t('home.treeName')}</label>
          <input
            className="form-input"
            value={treeName}
            onChange={(e) => setTreeName(e.target.value)}
            placeholder={t('home.treeNamePlaceholder')}
            autoFocus
          />
        </div>
      </Modal>
    </div>
  );
}

