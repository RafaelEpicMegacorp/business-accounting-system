import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import AccountingApp from './components/AccountingApp';
import ProtectedRoute from './components/ProtectedRoute';

function AppRoutes() {
  const { login } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login onLoginSuccess={login} />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AccountingApp />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster />
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
