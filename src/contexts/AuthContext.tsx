import React, { createContext, useContext, useState, useEffect } from 'react';
import { User as SupabaseAuthUser } from '@supabase/supabase-js';
import { User } from '../types/user';
import { AuthService } from '../services/authService';
import { UserService } from '../services/userService';

interface AuthContextType {
  user: User | null;
  /** The raw Supabase auth user (replaces firebaseUser). */
  firebaseUser: SupabaseAuthUser | null;
  isAdmin: boolean;
  loading: boolean;
  login: (userData: User) => void;
  loginAsAdmin: (adminData: User) => void;
  logout: () => void;
  checkAuth: () => boolean;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<SupabaseAuthUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const authService = new AuthService();

  // ── Load from localStorage for immediate UI (before DB responds) ──────────
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedIsAdmin = localStorage.getItem('isAdmin');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
        setIsAdmin(storedIsAdmin === 'true');
      } catch {
        localStorage.removeItem('user');
        localStorage.removeItem('isAdmin');
      }
    }
  }, []);

  // ── Subscribe to Supabase auth state changes ─────────────────────────────
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged(async (authUser) => {
      setFirebaseUser(authUser);

      if (authUser) {
        try {
          // Fetch profile from the users table (using Supabase UUID as the user ID)
          let userProfile = await UserService.getUserProfile(authUser.id);

          if (!userProfile) {
            // Auto-create profile for new OAuth (Google) users
            await UserService.createUserProfile(authUser.id, {
              name: authUser.user_metadata?.['full_name'] || authUser.user_metadata?.['name'] || '',
              email: authUser.email || '',
              phone: '',
              role: 'user',
            });
            userProfile = await UserService.getUserProfile(authUser.id);
          }

          if (userProfile) {
            setUser(userProfile);
            setIsAdmin(userProfile.role === 'admin');
            await UserService.updateLastLogin(authUser.id);
            localStorage.setItem('user', JSON.stringify(userProfile));
            localStorage.setItem('isAdmin', (userProfile.role === 'admin').toString());
          }
        } catch (error) {
          console.error('Error loading user profile:', error);
        }
      } else {
        setUser(null);
        setIsAdmin(false);
        localStorage.removeItem('user');
        localStorage.removeItem('isAdmin');
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // ── Listen for user refresh events from other parts of the app ─────────────
  useEffect(() => {
    const handleRefreshUser = () => {
      if (firebaseUser) refreshUserProfile();
    };
    window.addEventListener('refreshUser', handleRefreshUser);
    return () => window.removeEventListener('refreshUser', handleRefreshUser);
  }, [firebaseUser]);

  const login = (userData: User) => {
    if (!userData.id || !userData.email) throw new Error('Invalid user data');
    setUser(userData);
    setIsAdmin(userData.role === 'admin');
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('isAdmin', (userData.role === 'admin').toString());
  };

  const loginAsAdmin = (adminData: User) => {
    if (!adminData.id || !adminData.email || adminData.role !== 'admin') {
      throw new Error('Invalid admin data');
    }
    setUser(adminData);
    setIsAdmin(true);
    localStorage.setItem('user', JSON.stringify(adminData));
    localStorage.setItem('isAdmin', 'true');
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    setUser(null);
    setFirebaseUser(null);
    setIsAdmin(false);
    localStorage.removeItem('user');
    localStorage.removeItem('isAdmin');
  };

  const checkAuth = (): boolean => !!user && !!firebaseUser;

  const refreshUserProfile = async () => {
    if (firebaseUser) {
      try {
        const userProfile = await UserService.getUserProfile(firebaseUser.id);
        if (userProfile) {
          setUser(userProfile);
          setIsAdmin(userProfile.role === 'admin');
          localStorage.setItem('user', JSON.stringify(userProfile));
          localStorage.setItem('isAdmin', (userProfile.role === 'admin').toString());
        }
      } catch (error) {
        console.error('Error refreshing user profile:', error);
      }
    }
  };

  const value: AuthContextType = {
    user,
    firebaseUser,
    isAdmin,
    loading,
    login,
    loginAsAdmin,
    logout,
    checkAuth,
    refreshUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
