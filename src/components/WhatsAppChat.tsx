import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, X, Wifi, WifiOff } from 'lucide-react';
import { whatsAppService } from '../services/WhatsAppService';

const WhatsAppChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Array<{ text: string; isUser: boolean }>>([
    { text: 'Hello! How can I help you find your dream property?', isUser: false }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [qrCode, setQrCode] = useState<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    const unsubscribe = whatsAppService.onStatusChange(setConnectionStatus);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleQRCode = (code: string) => {
      setQrCode(code);
    };

    whatsAppService.onQRCode(handleQRCode);
    return () => whatsAppService.offQRCode(handleQRCode);
  }, []);

  useEffect(() => {
    if (connectionStatus === 'authenticated') {
      setQrCode(null);
    }
  }, [connectionStatus]);

  useEffect(() => {
    // Initialize connection when component mounts
    whatsAppService.initialize();

    const handleQRCode = (code: string) => {
      setQrCode(code);
      // Open chat window automatically when QR code is received
      setIsOpen(true);
    };

    whatsAppService.onQRCode(handleQRCode);
    return () => whatsAppService.offQRCode(handleQRCode);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    // Add user message
    setMessages(prev => [...prev, { text: message, isUser: true }]);
    
    // Get AI response
    const response = await whatsAppService.processAIQuery(message);
    setMessages(prev => [...prev, { text: response, isUser: false }]);
    
    setMessage('');
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-4 right-4 bg-emerald-600 text-white p-4 rounded-full shadow-lg hover:bg-emerald-700 transition-colors ${
          qrCode ? 'animate-bounce' : ''
        }`}
      >
        <MessageSquare className="w-6 h-6" />
        {qrCode && (
          <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full animate-ping" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 right-4 w-96 bg-white rounded-xl shadow-xl overflow-hidden"
          >
            <div className="bg-emerald-600 text-white p-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">WhatsApp Connection</h3>
                <button onClick={() => setIsOpen(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {qrCode && connectionStatus !== 'authenticated' && (
              <div className="p-6 flex flex-col items-center justify-center bg-white">
                <h3 className="text-lg font-semibold mb-2">Connect WhatsApp</h3>
                <p className="text-sm text-gray-500 text-center mb-4">
                  1. Open WhatsApp on your phone
                  <br />
                  2. Tap Menu or Settings and select WhatsApp Web
                  <br />
                  3. Point your phone camera at this QR code
                </p>
                <div className="bg-white p-4 rounded-lg shadow-lg mb-4">
                  <img
                    src={`data:image/png;base64,${qrCode}`}
                    alt="WhatsApp QR Code"
                    className="w-64 h-64"
                  />
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <span className="w-2 h-2 bg-yellow-400 rounded-full mr-2 animate-pulse" />
                  Waiting for connection...
                </div>
              </div>
            )}

            {connectionStatus === 'authenticated' && (
              <div className="h-96 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-xl px-4 py-2 ${
                        msg.isUser
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}

            {!qrCode && connectionStatus !== 'authenticated' && (
              <div className="p-8 flex flex-col items-center justify-center">
                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-gray-500">Initializing WhatsApp...</p>
              </div>
            )}

            {connectionStatus === 'authenticated' && (
              <form onSubmit={handleSubmit} className="p-4 border-t">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                  <button
                    type="submit"
                    className="bg-emerald-600 text-white p-2 rounded-xl hover:bg-emerald-700 transition-colors"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {qrCode && !isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-20 right-4 bg-white p-4 rounded-xl shadow-lg"
        >
          <p className="text-sm font-medium text-gray-900">WhatsApp QR Code Ready!</p>
          <p className="text-xs text-gray-500">Click the chat button to scan</p>
        </motion.div>
      )}
    </>
  );
};

export default WhatsAppChat;
