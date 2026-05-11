import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { I18nProvider } from './contexts/I18nContext';
import { TreeProvider } from './contexts/TreeContext';
import Sidebar from './components/Sidebar/Sidebar';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import TreePage from './pages/TreePage';
import GalleryPage from './pages/GalleryPage';
import SettingsPage from './pages/SettingsPage';

function AppFrame() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const pageKey =
    location.pathname.startsWith('/tree') ? 'tree'
      : location.pathname.startsWith('/gallery') ? 'gallery'
        : location.pathname.startsWith('/settings') ? 'settings'
          : 'home';

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
        onNavigate={(page) => {
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
