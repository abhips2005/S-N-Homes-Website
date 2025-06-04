import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { AuthService } from '../services/authService';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const authService = new AuthService();
  const navigate = useNavigate();
  const { login: contextLogin } = useAuth();

  // Check if already logged in
  useEffect(() => {
    const user = authService.getCurrentUser();
    if (user) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (!email || !password) {
        setError('Please enter both email and password');
        toast.error('Please enter both email and password');
        return;
      }

      setIsLoading(true);
      setError(null);
      
      // Authenticate with Firebase
      const user = await authService.login(email, password);
      
      if (!user) {
        throw new Error('Authentication failed');
      }
      
      // Create user data from Firebase user
      const userData = {
        id: user.uid,
        name: user.displayName || email.split('@')[0],
        email: user.email || '',
        phone: user.phoneNumber || '',
        role: 'user' as const,
        created_at: user.metadata.creationTime || new Date().toISOString(),
        verified: user.emailVerified,
        savedProperties: [],
        viewingHistory: []
      };

      // Update auth context
      await contextLogin(userData);
      toast.success('Login successful!');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error?.message || 'Invalid email or password');
      toast.error(error?.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsGoogleLoading(true);
      setError(null);
      
      // Sign in with Google
      const user = await authService.signInWithGoogle();
      
      // Create user data from Google user
      const userData = {
        id: user.uid,
        name: user.displayName || 'User',
        email: user.email || '',
        phone: user.phoneNumber || '',
        role: 'user' as const,
        created_at: user.metadata.creationTime || new Date().toISOString(),
        verified: true,
        savedProperties: [],
        viewingHistory: []
      };

      // Update auth context
      await contextLogin(userData);
      toast.success('Google login successful!');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Google login error:', error);
      setError(error?.message || 'Failed to sign in with Google');
      toast.error(error?.message || 'Failed to sign in with Google');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="login-form">
      {error && <div className="error-message text-red-500 mb-4">{error}</div>}
      
      <form onSubmit={handleLogin} className="space-y-4">
        <div className="form-group">
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            disabled={isLoading}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            disabled={isLoading}
            required
          />
        </div>
        
        <button 
          type="submit" 
          disabled={isLoading}
          className="w-full bg-emerald-600 text-white py-2 rounded-md hover:bg-emerald-700 transition-colors flex justify-center items-center"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            'Sign In'
          )}
        </button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">Or</span>
        </div>
      </div>

      <button 
        onClick={handleGoogleLogin}
        disabled={isGoogleLoading}
        className="w-full bg-white border border-gray-300 text-gray-700 py-2 rounded-md hover:bg-gray-50 transition-colors flex justify-center items-center gap-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24px" height="24px">
          <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
          <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
          <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
          <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
        </svg>
        {isGoogleLoading ? 'Connecting...' : 'Sign in with Google'}
      </button>
    </div>
  );
};

export default Login;
