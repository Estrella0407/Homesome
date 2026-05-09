import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import heroImg from '../assets/hero.png';

export default function AuthPage() {
  const { signInWithGoogle, isDemo, user } = useAuth();
  const { t } = useI18n();

  if (user) return <Navigate to="/" replace />;

  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100%', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 520, background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
        <div style={{ padding: 24, borderBottom: '1px solid var(--border-light)', display: 'flex', gap: 16, alignItems: 'center' }}>
          <img src={heroImg} alt="" width={72} height={72} style={{ borderRadius: 14 }} />
          <div>
            <h2 style={{ fontSize: 22 }}>{t('auth.welcome')}</h2>
            <p style={{ marginTop: 6, color: 'var(--text-secondary)' }}>{t('auth.description')}</p>
          </div>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button className="btn btn-primary" onClick={signInWithGoogle}>
            <span>{t('auth.signInGoogle')}</span>
          </button>
          {isDemo && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              Firebase 未配置：当前为本地 Demo 模式（数据保存在浏览器）。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

