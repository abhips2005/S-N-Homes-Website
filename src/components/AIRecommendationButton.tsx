import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import AIPropertyRecommendations from './AIPropertyRecommendations';
import { useAuth } from '../contexts/AuthContext';
import type { Property } from '../types';

interface Props {
  properties: Property[];
}

const AIRecommendationButton: React.FC<Props> = ({ properties }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <>
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleOpen}
        className="fixed bottom-6 right-6 bg-emerald-600 text-white rounded-full shadow-lg p-4 flex items-center space-x-2 z-40"
      >
        <Sparkles className="w-5 h-5" />
        <span className="font-medium">Find your perfect property</span>
      </motion.button>

      <AIPropertyRecommendations
        properties={properties}
        isOpen={isOpen}
        onClose={handleClose}
      />
    </>
  );
};

export default AIRecommendationButton; 