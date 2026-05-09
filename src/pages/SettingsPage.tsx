import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useTree } from '../contexts/TreeContext';

export default function SettingsPage() {
  const { t } = useI18n();
  const { logout, isDemo } = useAuth();
  const { activeTree, updateTree, deleteTree } = useTree();
  const navigate = useNavigate();
  const [treeName, setTreeName] = useState(activeTree?.name || '');
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

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 760 }}>
      <div>
        <h2 style={{ fontSize: 22 }}>{t('settings.title')}</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{activeTree.name}</p>
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h3 style={{ fontSize: 16 }}>{t('settings.treeName')}</h3>
        <input className="form-input" value={treeName} onChange={(e) => setTreeName(e.target.value)} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            className="btn btn-primary"
            onClick={async () => {
              await updateTree({ name: treeName.trim() || activeTree.name });
            }}
          >
            {t('settings.save')}
          </button>
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h3 style={{ fontSize: 16 }}>{t('settings.share')}</h3>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, letterSpacing: 1, padding: '8px 12px', borderRadius: 10, background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)' }}>
            {activeTree.shareCode}
          </div>
          <button className="btn btn-secondary" onClick={copy}>
            {copied ? t('settings.copied') : t('settings.copyLink')}
          </button>
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

