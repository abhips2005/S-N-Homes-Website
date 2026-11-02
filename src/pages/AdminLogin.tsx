import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, EyeOff, Eye, Shield, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { AuthService } from '../services/authService';
import { UserService } from '../services/userService';

const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loginAsAdmin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // If already logged in with admin privileges, navigate directly
  useEffect(() => {
    if (user && isAdmin) {
      navigate('/admin/crm', { replace: true });
    }
  }, [user, isAdmin, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const authSvc = new AuthService();

      // Check 1: Real Supabase Auth login
      try {
        const authUser = await authSvc.login(email, password);
        if (authUser) {
          const isEmailAdmin =
            authUser.email === 'abhips1108@gmail.com' ||
            (import.meta.env.VITE_ADMIN_EMAIL && authUser.email === import.meta.env.VITE_ADMIN_EMAIL);

          let profile = await UserService.getUserProfile(authUser.id);
          const isRoleAdmin = profile?.role === 'admin' || Boolean(isEmailAdmin);

          if (!isRoleAdmin) {
            toast.error('Access denied. This account does not have administrator privileges.');
            await authSvc.logout();
            return;
          }

          if (profile && isEmailAdmin && profile.role !== 'admin') {
            await UserService.updateUserProfile(authUser.id, { role: 'admin' });
            profile.role = 'admin';
          }

          if (profile) {
            loginAsAdmin(profile);
          }
          toast.success('Admin login successful!');
          navigate('/admin/crm');
          return;
        }
      } catch (supabaseErr: any) {
        // Check 2: Environment variables credentials fallback
        const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;
        const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD;

        if (adminEmail && adminPassword && email === adminEmail && password === adminPassword) {
          const adminData = {
            id: 'admin1',
            name: 'Admin User',
            email: email,
            phone: '+919876543210',
            phoneVerified: true,
            role: 'admin' as const,
            created_at: new Date().toISOString(),
            verified: true,
            savedProperties: [],
            viewingHistory: []
          };
          loginAsAdmin(adminData);
          toast.success('Admin login successful!');
          navigate('/admin/crm');
          return;
        }

        // If neither worked
        const msg = supabaseErr?.message || 'Invalid admin credentials';
        toast.error(msg);
      }
    } catch (error) {
      console.error('Admin login error:', error);
      toast.error('Failed to login as admin');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsGoogleLoading(true);
      const authSvc = new AuthService();
      await authSvc.signInWithGoogle();
    } catch (err: any) {
      toast.error(err.message || 'Google login failed');
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12">
      <div className="max-w-md mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100"
        >
          <div className="p-8">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl mx-auto flex items-center justify-center mb-3">
                <Shield size={24} />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Admin Portal</h1>
              <p className="text-gray-500 text-sm">Sign in to manage S&N Homes CRM & properties</p>
            </div>

            {/* Quick action if already logged in as recognized admin */}
            {user && (user.role === 'admin' || user.email === 'abhips1108@gmail.com') && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-xs text-emerald-800 font-semibold mb-1">Signed in as:</p>
                <p className="text-sm font-bold text-gray-900 truncate">{user.name || user.email}</p>
                <button
                  type="button"
                  onClick={() => {
                    loginAsAdmin({ ...user, role: 'admin' });
                    navigate('/admin/crm');
                  }}
                  className="mt-3 w-full bg-emerald-600 text-white py-2 px-3 rounded-lg text-sm font-semibold hover:bg-emerald-700 flex items-center justify-center gap-1.5 transition-colors"
                >
                  Enter Admin CRM <ArrowRight size={14} />
                </button>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Admin Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@snhomes.com"
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>
              </div>
              
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-emerald-600 text-white py-3 rounded-xl hover:bg-emerald-700 transition-colors font-medium text-sm flex justify-center items-center shadow-sm"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  'Sign In as Admin'
                )}
              </button>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-white text-gray-400 uppercase tracking-wider">Or</span>
                </div>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isGoogleLoading}
                  className="w-full flex justify-center items-center py-2.5 px-4 border border-gray-300 rounded-xl shadow-sm bg-white hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
                >
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg"
                    alt="Google"
                    className="w-4 h-4 mr-2"
                  />
                  {isGoogleLoading ? 'Connecting…' : 'Sign in with Google'}
                </button>
              </div>
            </div>

            <div className="mt-6 text-center">
              <Link to="/login" className="text-xs text-gray-500 hover:text-gray-700">
                ← Back to standard user login
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AdminLogin;
