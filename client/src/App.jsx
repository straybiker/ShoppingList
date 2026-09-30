
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';

import { ToastProvider } from './context/ToastContext';
import Home from './pages/Home';
import Settings from './pages/Settings';
import { Settings as SettingsIcon, ChevronLeft, Share2, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useToast } from './context/ToastContext';
import { getMyListName, migrateLegacyProfile } from './utils/device';
import { shareList, deleteListForEveryone } from './utils/listActions';

import { useSearchParams } from 'react-router-dom';

function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const listId = searchParams.get('list');
  const { showToast } = useToast();
  const [, setRefresh] = useState(0);

  useEffect(() => {
    const handleChange = () => setRefresh(prev => prev + 1);
    window.addEventListener('myListsChanged', handleChange);
    return () => window.removeEventListener('myListsChanged', handleChange);
  }, []);

  const listName = listId ? getMyListName(listId) : '';

  const handleDelete = async () => {
    const deleted = await deleteListForEveryone(listId, listName, showToast);
    if (deleted) navigate('/');
  };

  // Title Logic
  const getTitle = () => {
    if (location.pathname === '/settings') return 'Settings';
    if (listId) return listName || 'Shopping List';
    return 'Shopping List';
  };

  // Subtitle Logic
  const getSubtitle = () => {
    if (location.pathname === '/settings') return 'Tell your shopping buddies who you are.';
    if (location.pathname === '/' && !listId) {
      return 'Stay organized, buy smart.';
    }
    if (location.pathname === '/config-lists') return 'Configuration: Manage Lists';
    return null;
  };

  const isDashboard = location.pathname === '/' && !listId;
  const isSettings = location.pathname === '/settings';
  const isConfig = location.pathname.startsWith('/config');

  const showBackButton = isSettings || !!listId || isConfig;

  let headerClass = 'header-list';
  if (isDashboard || isConfig) headerClass = 'header-dashboard';
  if (isSettings) headerClass = 'header-profile';

  return (
    <header className={`app-header ${headerClass}`}>
      <div className="header-left">
        {showBackButton && (
          <a href="/" className="icon-btn back-btn" aria-label="Back to your lists">
            <ChevronLeft size={24} />
          </a>
        )}
      </div>

      <div className="title-container">
        {getTitle() && <h1>{getTitle()}</h1>}
        {getSubtitle() && (
          <p className="subtitle">
            {getSubtitle()}
          </p>
        )}
      </div>


      <div className="header-right">
        {isDashboard && (
          <a
            href="/settings"
            className="icon-btn"
            style={{ width: '40px', height: '40px', padding: 0 }}
            aria-label="Settings"
          >
            <SettingsIcon size={24} />
          </a>
        )}
        {listId && !isConfig && (
          <>
            <button
              onClick={() => shareList(listId, listName, showToast)}
              className="icon-btn text-slate-500"
              style={{ width: '40px', height: '40px', padding: 0 }}
              aria-label="Share list"
            >
              <Share2 size={22} />
            </button>
            <button
              onClick={handleDelete}
              className="icon-btn text-slate-500"
              style={{ width: '40px', height: '40px', padding: 0 }}
              aria-label="Delete list for everyone"
            >
              <Trash2 size={22} />
            </button>
          </>
        )}
      </div>
    </header >
  );
}

function Layout({ children }) {
  return (
    <>
      <div className="background-gradient" />
      <main className="app-container">
        {children}
      </main>
    </>
  );
}

function App() {
  const [migrated, setMigrated] = useState(false);

  // Import the old username profile before the first render of the lists
  useEffect(() => {
    migrateLegacyProfile().finally(() => setMigrated(true));
  }, []);

  if (!migrated) return null;

  return (
    <ToastProvider>
      <Router>
        <Layout>
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={<Navigate to="/settings" replace />} />
            <Route path="/config-lists" element={<Home />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </Router>
    </ToastProvider>
  );
}

export default App;
