import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { I18nProvider } from './contexts/I18nContext';
import { TreeProvider, useTree } from './contexts/TreeContext';

const LAST_PAGE_KEY = 'homesome_last_page';
import Sidebar from './components/sidebar/Sidebar';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import TreePage from './pages/TreePage';
import GalleryPage from './pages/GalleryPage';
import SettingsPage from './pages/SettingsPage';

function AppFrame() {
  const { user, loading } = useAuth();
  const { activeTree, treesLoaded } = useTree();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const pageKey =
    location.pathname.startsWith('/tree') ? 'tree'
      : location.pathname.startsWith('/gallery') ? 'gallery'
        : location.pathname.startsWith('/settings') ? 'settings'
          : 'home';

  useEffect(() => {
    if (location.pathname.startsWith('/settings') || location.pathname.startsWith('/auth')) return;
    if (location.pathname === '/tree' && !activeTree) return;
    localStorage.setItem(LAST_PAGE_KEY, location.pathname);
  }, [location.pathname, activeTree]);

  useEffect(() => {
    if (location.pathname !== '/') return;
    const lastPage = localStorage.getItem(LAST_PAGE_KEY);
    if (!lastPage || lastPage === '/' || lastPage.startsWith('/settings') || lastPage.startsWith('/auth')) return;
    if (lastPage === '/tree' && !treesLoaded) return;
    navigate(lastPage, { replace: true });
  }, [location.pathname, navigate, treesLoaded]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <div>Loading…</div>
      </div>
    );
  }

  if (!user && location.pathname !== '/auth') {
    return <Navigate to="/auth" replace />;
  }

  if (user && location.pathname === '/auth') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="app-layout">
      <Sidebar
        currentPage={pageKey}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNavigate={(page: string) => {
          if (page === 'home') navigate('/');
          else navigate('/' + page);
        }}
      />
      <main className="app-main">
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-card)', position: 'sticky', top: 0, zIndex: 200 }}>
          <button className="btn-icon" onClick={() => setSidebarOpen((v) => !v)} aria-label="Menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
            <span style={{ fontFamily: 'var(--font-chinese)', fontWeight: 700, color: 'var(--text-primary)' }}>家馨</span>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Homesome</span>
          </div>
        </header>

        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/tree" element={<TreePage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <I18nProvider>
        <AuthProvider>
          <TreeProvider>
            <AppFrame />
          </TreeProvider>
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  );
}
