import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useTree } from '../contexts/TreeContext';
import { getTreeDisplayName } from '../utils/helpers';

export default function SettingsPage() {
  const { t, lang } = useI18n();
  const { logout, isDemo } = useAuth();
  const { activeTree, updateTree, deleteTree, shareTree, revokeShare } = useTree();
  const navigate = useNavigate();
  const [treeName, setTreeName] = useState(activeTree ? getTreeDisplayName(activeTree, lang) : '');
  const [shareTarget, setShareTarget] = useState('');
  const [shareRole, setShareRole] = useState<'viewer' | 'editor'>('viewer');
  const [copied, setCopied] = useState(false);

  if (!activeTree) return <Navigate to="/" replace />;

  const shareText = useMemo(() => activeTree.shareCode, [activeTree.shareCode]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  const addShare = async () => {
    if (!shareTarget.trim()) return;
    await shareTree({
      userId: shareTarget.trim(),
      email: shareTarget.trim(),
      displayName: shareTarget.trim(),
      role: shareRole,
    });
    setShareTarget('');
    setShareRole('viewer');
  };

  const activeShares = activeTree.shares || [];

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 760 }}>
      <div>
        <h2 style={{ fontSize: 22 }}>{t('settings.title')}</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{getTreeDisplayName(activeTree, lang)}</p>
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h3 style={{ fontSize: 16 }}>{t('settings.treeName')}</h3>
        <input className="form-input" value={treeName} onChange={(e) => setTreeName(e.target.value)} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            className="btn btn-primary"
            onClick={async () => {
              await updateTree({
                [lang === 'zh' ? 'nameCN' : 'nameEN']: treeName.trim() || getTreeDisplayName(activeTree, lang),
              });
            }}
          >
            {t('settings.save')}
          </button>
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h3 style={{ fontSize: 16 }}>{t('settings.share')}</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, letterSpacing: 1, padding: '8px 12px', borderRadius: 10, background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)' }}>
            {activeTree.shareCode}
          </div>
          <button className="btn btn-secondary" onClick={copy}>
            {copied ? t('settings.copied') : t('settings.copyLink')}
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="form-input"
            style={{ flex: '1 1 240px', marginRight: 12 }}
            value={shareTarget}
            onChange={(e) => setShareTarget(e.target.value)}
            placeholder={t('settings.shareEmail')}
          />
          <select className="form-select" value={shareRole} onChange={(e) => setShareRole(e.target.value as 'viewer' | 'editor')}>
            <option value="viewer">{t('settings.roleViewer')}</option>
            <option value="editor">{t('settings.roleEditor')}</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={addShare} disabled={!shareTarget.trim()}>
          {t('settings.addShare')}
        </button>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{t('settings.sharedWith')}</div>
          {activeShares.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{t('settings.sharedListEmpty')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {activeShares.map((share) => (
                <div key={share.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-chinese)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {share.displayName || share.email || share.userId}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {share.email || share.userId} · {share.role === 'editor' ? t('settings.roleEditor') : t('settings.roleViewer')}
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={async () => { await revokeShare(share.userId); }}>
                    {t('settings.revoke')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        {isDemo ? <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Demo 模式：分享码仅用于本机浏览器测试。</div> : null}
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h3 style={{ fontSize: 16, color: 'var(--accent-red)' }}>{t('settings.dangerZone')}</h3>
        <button
          className="btn btn-danger"
          onClick={async () => {
            if (!confirm(t('settings.deleteConfirm'))) return;
            await deleteTree();
            navigate('/');
          }}
        >
          {t('settings.deleteTree')}
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className="btn btn-secondary"
          onClick={async () => {
            await logout();
            navigate('/auth');
          }}
        >
          {t('settings.signOut')}
        </button>
      </div>
    </div>
  );
}

