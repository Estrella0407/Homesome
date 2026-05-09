import { useI18n } from '../../contexts/I18nContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTree } from '../../contexts/TreeContext';
import './Sidebar.css';

interface Props {
  currentPage: string;
  onNavigate: (page: string) => void;
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ currentPage, onNavigate, open, onClose }: Props) {
  const { t, lang, toggleLang } = useI18n();
  const { user, isDemo } = useAuth();
  const { activeTree, setActiveTree } = useTree();

  const nav = (page: string) => { onNavigate(page); onClose(); };

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`app-sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-icon">族</div>
          <div className="brand-text">
            <span className="brand-name">{t('app.name')}</span>
            <span className="brand-sub">{t('app.subtitle')}</span>
          </div>
        </div>

        {activeTree && (
          <div className="sidebar-tree-name">
            <span className="tree-name-text">{activeTree.name}</span>
            <button className="btn-icon" title="Back" onClick={() => { setActiveTree(null); nav('home'); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
          </div>
        )}

        <nav className="sidebar-nav">
          {!activeTree ? (
            <button className={`nav-item${currentPage === 'home' ? ' active' : ''}`} onClick={() => nav('home')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
              {t('nav.home')}
            </button>
          ) : (
            <>
              <button className={`nav-item${currentPage === 'tree' ? ' active' : ''}`} onClick={() => nav('tree')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="3"/><line x1="12" y1="8" x2="12" y2="14"/><circle cx="6" cy="19" r="3"/><circle cx="18" cy="19" r="3"/><path d="M12 14l-6 2M12 14l6 2"/></svg>
                {t('nav.tree')}
              </button>
              <button className={`nav-item${currentPage === 'gallery' ? ' active' : ''}`} onClick={() => nav('gallery')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                {t('nav.gallery')}
              </button>
              <button className={`nav-item${currentPage === 'settings' ? ' active' : ''}`} onClick={() => nav('settings')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                {t('settings.title')}
              </button>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <button className="lang-toggle" onClick={toggleLang}>
            {lang === 'zh' ? 'EN' : '中'}
          </button>
          {user && (
            <div className="sidebar-user">
              <div className="user-avatar">
                {user.displayName?.charAt(0) || '?'}
              </div>
              <span className="user-name">{user.displayName || user.email}</span>
              {isDemo && <span className="demo-badge">Demo</span>}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
