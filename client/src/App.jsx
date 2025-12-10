
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';

import { ToastProvider } from './context/ToastContext';
import Home from './pages/Home';
import Profile from './pages/Profile';
import { User, ChevronLeft, Star } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useToast } from './context/ToastContext';

import { useSearchParams } from 'react-router-dom';

function Header() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const listDetails = searchParams.get('list');
  const { showToast } = useToast();
  const [isFavorite, setIsFavorite] = useState(false);
  const user = localStorage.getItem('username');

  useEffect(() => {
    const checkStatus = async () => {
      if (!listDetails || !user) {
        setIsFavorite(false);
        return;
      }
      try {
        const res = await fetch(`/api/favorites/${user}`);
        if (res.ok) {
          const favs = await res.json();
          setIsFavorite(favs.includes(listDetails));
        }
      } catch (e) { }
    };
    checkStatus();
  }, [listDetails, user]);

  const handleToggleFavorite = async () => {
    if (!user || !listDetails) return;
    try {
      const res = await fetch(`/api/favorites/${user}/${listDetails}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        const newStatus = data.favorites.includes(listDetails);
        setIsFavorite(newStatus);
        showToast(newStatus ? 'List added to favorites' : 'List removed from favorites', 'success');
      }
    } catch (e) {
      showToast('Failed to toggle favorite', 'error');
    }
  };



  // Title Logic
  // Title Logic
  const getTitle = () => {
    if (location.pathname === '/profile') return 'User Profile';
    if (listDetails) {
      return localStorage.getItem('currentListName') || 'Shopping List';
    }
    return 'Shopping List';
  };

  // Subtitle Logic
  const getSubtitle = () => {
    if (location.pathname === '/profile') return 'Identify yourself to your shopping buddies.';
    if (location.pathname === '/' && !listDetails) {
      return 'Stay organized, buy smart.';
    }
    if (location.pathname === '/config-lists') return 'Configuration: Manage Lists';
    if (location.pathname === '/config-users') return 'Configuration: Manage Users';
    return null;
  };

  const isDashboard = location.pathname === '/' && !listDetails;
  const isProfile = location.pathname === '/profile';
  const isConfig = location.pathname.startsWith('/config');

  const showProfileIcon = location.pathname === '/' && !listDetails;
  const showBackButton = location.pathname === '/profile' || !!listDetails || isConfig;

  let headerClass = 'header-list';
  if (isDashboard || isConfig) headerClass = 'header-dashboard';
  if (isProfile) headerClass = 'header-profile';

  return (
    <header className={`app-header ${headerClass}`}>
      <div className="header-left">
        {showBackButton && (
          <a href="/" className="icon-btn back-btn">
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
        {showProfileIcon && (
          <a
            href="/profile"
            className="icon-btn"
            style={{ width: '40px', height: '40px', padding: 0 }}
          >
            <User size={24} />
          </a>
        )}
        {listDetails && user && (
          <>

            <button
              onClick={handleToggleFavorite}
              className={`icon-btn ${isFavorite ? 'text-yellow-400' : 'text-slate-500'}`}
              style={{ width: '40px', height: '40px', padding: 0 }}
            >
              <Star size={24} fill={isFavorite ? "currentColor" : "none"} />
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
  return (
    <ToastProvider>
      <Router>
        <Layout>
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/config-lists" element={<Home />} />
            <Route path="/config-users" element={<Home />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </Router>
    </ToastProvider>
  );
}

export default App;
