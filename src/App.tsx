import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import Home from './pages/Home';
import Properties from './pages/Properties';
import PropertyDetails from './pages/PropertyDetails';
import Dashboard from './pages/Dashboard';
import AddProperty from './pages/AddProperty';
import EditProperty from './pages/EditProperty';
import SavedProperties from './pages/SavedProperties';
import History from './pages/History';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Signup from './pages/Signup';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminProperties from './pages/AdminProperties';
import AdminReports from './pages/AdminReports';
import AdminUsers from './pages/AdminUsers';
import AdminSettings from './pages/AdminSettings';
import AdminNotifications from './pages/AdminNotifications';
import CrmOverview from './pages/CrmOverview';
import CrmInbox from './pages/CrmInbox';
import CrmBuyerRequests from './pages/CrmBuyerRequests';
import CrmSellerSubmissions from './pages/CrmSellerSubmissions';
import CrmFollowUps from './pages/CrmFollowUps';
import CrmAuditLogs from './pages/CrmAuditLogs';
import CrmProperties from './pages/CrmProperties';
import CrmSettings from './pages/CrmSettings';
import PalaAdPage from './pages/PalaAdPage';
import ErrorBoundary from './components/ErrorBoundary';

function AppLayout() {
  const location = useLocation();
  const isAds = location.pathname.startsWith('/ads');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {!isAds && <Navbar />}
      {!isAds && <PWAInstallPrompt />}
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/ads/pala" element={<PalaAdPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/admin-login" element={<AdminLogin />} />

          {/* Protected Routes */}
          <Route element={<PrivateRoute />}>
            <Route path="/properties" element={<Properties />} />
            <Route path="/property/:id" element={<PropertyDetails />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/add-property" element={<AddProperty />} />
            <Route path="/edit-property/:id" element={<EditProperty />} />
            <Route path="/saved" element={<SavedProperties />} />
            <Route path="/history" element={<History />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/settings" element={<Settings />} />
          </Route>

          {/* Admin Routes */}
          <Route element={<AdminRoute />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/properties" element={<AdminProperties />} />
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/notifications" element={<AdminNotifications />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            {/* CRM routes */}
            <Route path="/admin/crm" element={<CrmOverview />} />
            <Route path="/admin/crm/inbox" element={<CrmInbox />} />
            <Route path="/admin/crm/buyers" element={<CrmBuyerRequests />} />
            <Route path="/admin/crm/sellers" element={<CrmSellerSubmissions />} />
            <Route path="/admin/crm/followups" element={<CrmFollowUps />} />
            <Route path="/admin/crm/audit" element={<CrmAuditLogs />} />
            <Route path="/admin/crm/properties" element={<CrmProperties />} />
            <Route path="/admin/crm/settings" element={<CrmSettings />} />
          </Route>
        </Routes>
      </main>
      {!isAds && <Footer />}
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Toaster position="top-center" />
        <BrowserRouter>
          <AppLayout />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
