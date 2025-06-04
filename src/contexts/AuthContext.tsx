import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/user';
import { AuthService } from '../services/authService';
import { UserService } from '../services/userService';
import { User as FirebaseUser } from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
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
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const authService = new AuthService();

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged(async (firebaseUser) => {
      setFirebaseUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          // Get user profile from Firestore
          const userProfile = await UserService.getUserProfile(firebaseUser.uid);
          
          if (userProfile) {
            setUser(userProfile);
            setIsAdmin(userProfile.role === 'admin');
            
            // Update last login
            await UserService.updateLastLogin(firebaseUser.uid);
            
            // Store in localStorage for persistence
            localStorage.setItem('user', JSON.stringify(userProfile));
            localStorage.setItem('isAdmin', (userProfile.role === 'admin').toString());
          } else {
            // Create user profile if it doesn't exist (for existing Firebase users)
            const newUserProfile = {
              name: firebaseUser.displayName || '',
              email: firebaseUser.email || '',
              phone: '', // Will need to be updated later
              role: 'user' as const
            };
            
            await UserService.createUserProfile(firebaseUser.uid, newUserProfile);
            
            // Get the created profile
            const createdProfile = await UserService.getUserProfile(firebaseUser.uid);
            if (createdProfile) {
              setUser(createdProfile);
              setIsAdmin(false);
              localStorage.setItem('user', JSON.stringify(createdProfile));
              localStorage.setItem('isAdmin', 'false');
            }
          }
        } catch (error) {
          console.error('Error loading user profile:', error);
        }
      } else {
        // User logged out
        setUser(null);
        setIsAdmin(false);
        localStorage.removeItem('user');
        localStorage.removeItem('isAdmin');
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Load user from localStorage on initial load (for faster UI)
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedIsAdmin = localStorage.getItem('isAdmin');
    
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
        setIsAdmin(storedIsAdmin === 'true');
      } catch (error) {
        console.error('Error parsing stored user:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('isAdmin');
      }
    }
  }, []);

  // Listen for user refresh events
  useEffect(() => {
    const handleRefreshUser = () => {
      if (firebaseUser) {
        refreshUserProfile();
      }
    };

    window.addEventListener('refreshUser', handleRefreshUser);
    return () => window.removeEventListener('refreshUser', handleRefreshUser);
  }, [firebaseUser]);

  const login = (userData: User) => {
    if (!userData.id || !userData.email) {
      throw new Error('Invalid user data');
    }

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

  const checkAuth = (): boolean => {
    return !!user && !!firebaseUser;
  };

  const refreshUserProfile = async () => {
    if (firebaseUser) {
      try {
        const userProfile = await UserService.getUserProfile(firebaseUser.uid);
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

  const value = {
    user,
    firebaseUser,
    isAdmin,
    loading,
    login,
    loginAsAdmin,
    logout,
    checkAuth,
    refreshUserProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
