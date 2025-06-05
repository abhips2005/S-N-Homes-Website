import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Search, User, Plus, Menu, X, Bell, Heart } from 'lucide-react';
import UserMenu from './UserMenu';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Check if we're on the home page
  const isHomePage = location.pathname === '/';

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleListPropertyClick = () => {
    if (!user) {
      toast.error('Please login or register to list a property');
      navigate('/login');
    } else {
      navigate('/add-property');
    }
  };

  // Determine navbar styling based on page and scroll state
  const shouldUseTransparentBg = isHomePage && !isScrolled;

  const navbarClasses = `fixed w-full z-50 transition-all duration-300 ${
    shouldUseTransparentBg ? 'bg-transparent' : 'bg-white/90 backdrop-blur-md shadow-lg'
  }`;

  const linkClasses = `flex items-center space-x-1 px-4 py-2 rounded-xl transition-colors ${
    shouldUseTransparentBg ? 'text-white hover:text-emerald-400' : 'text-gray-700 hover:text-emerald-600'
  }`;

  const buttonClasses = `flex items-center space-x-1 px-4 py-2 rounded-xl transition-colors ${
    shouldUseTransparentBg
      ? 'bg-white/20 backdrop-blur-md text-white hover:bg-white/30'
      : 'bg-emerald-600 text-white hover:bg-emerald-700'
  }`;

  const mobileMenuVariants = {
    closed: { opacity: 0, x: "100%" },
    open: { opacity: 1, x: 0 }
  };

  return (
    <>
      <nav className={navbarClasses}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-2">
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Home className={`h-8 w-8 ${shouldUseTransparentBg ? 'text-white' : 'text-emerald-600'}`} />
                </motion.div>
                <span className={`text-xl font-bold ${shouldUseTransparentBg ? 'text-white' : 'text-gray-900'}`}>
                  S N Homes
                </span>
              </Link>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-2">
              <Link to="/properties" className={linkClasses}>
                <Search className="h-5 w-5" />
                <span>Search</span>
              </Link>
              
              <button 
                onClick={handleListPropertyClick}
                className={buttonClasses}
              >
                <Plus className="h-5 w-5" />
                <span>List your property for free</span>
              </button>
              
              <Link to="/saved" className={linkClasses}>
                <Heart className="h-5 w-5" />
                <span>Saved</span>
              </Link>
              
              <Link to="/notifications" className={linkClasses}>
                <Bell className="h-5 w-5" />
                <span>Notifications</span>
              </Link>
              
              {user ? (
                <UserMenu isTransparent={shouldUseTransparentBg} />
              ) : (
                <Link to="/login" className={linkClasses}>
                  <User className="h-5 w-5" />
                  <span>Login</span>
                </Link>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className={`p-2 rounded-lg ${shouldUseTransparentBg ? 'text-white' : 'text-gray-700'}`}
              >
                {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial="closed"
            animate="open"
            exit="closed"
            variants={mobileMenuVariants}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-y-0 right-0 w-64 bg-white shadow-2xl z-40 md:hidden"
          >
            <div className="p-4 space-y-4">
              <Link
                to="/properties"
                className="flex items-center space-x-2 p-3 rounded-xl hover:bg-emerald-50 text-gray-700"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Search className="h-5 w-5" />
                <span>Search</span>
              </Link>
              
              <button
                onClick={() => {
                  handleListPropertyClick();
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center space-x-2 p-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 w-full"
              >
                <Plus className="h-5 w-5" />
                <span>List your property for free</span>
              </button>
              
              <Link
                to="/saved"
                className="flex items-center space-x-2 p-3 rounded-xl hover:bg-emerald-50 text-gray-700"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Heart className="h-5 w-5" />
                <span>Saved Properties</span>
              </Link>
              
              <Link
                to="/notifications"
                className="flex items-center space-x-2 p-3 rounded-xl hover:bg-emerald-50 text-gray-700"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Bell className="h-5 w-5" />
                <span>Notifications</span>
              </Link>
              
              <Link
                to="/dashboard"
                className="flex items-center space-x-2 p-3 rounded-xl hover:bg-emerald-50 text-gray-700"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <User className="h-5 w-5" />
                <span>Account</span>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default Navbar;