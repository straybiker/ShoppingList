
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import Home from './pages/Home';
import Profile from './pages/Profile';
import { User, ChevronLeft } from 'lucide-react';

function Header() {
  const location = useLocation();

  return (
    <header className="app-header">
      {/* Left placeholder/Back */}
      <div style={{ width: '40px' }}>
        {location.pathname !== '/' && (
          <a href="/" className="icon-btn" style={{ padding: 0, width: '40px', height: '40px' }}>
            <ChevronLeft size={24} />
          </a>
        )}
      </div>

      <div className="title-container">
        <h1>Shopping List</h1>
        <p className="subtitle">
          {location.pathname === '/config-lists' ? 'Configuration: Manage Lists' :
            location.pathname === '/config-users' ? 'Configuration: Manage Users' :
              'Stay organized, buy smart.'}
        </p>
      </div>

      <div className="header-right">
        <a
          href={location.pathname === '/profile' ? '/' : '/profile'}
          className="icon-btn"
          style={{ width: '40px', height: '40px', padding: 0 }}
          onClick={(e) => {
            e.preventDefault();
            window.location.href = location.pathname === '/profile' ? '/' : '/profile';
          }}
        >
          <User size={24} />
        </a>
      </div>
    </header>
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
          </Routes>
        </Layout>
      </Router>
    </ToastProvider>
  );
}

export default App;
