import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, RefreshCw } from 'lucide-react';
import { whatsAppService } from '../services/WhatsAppService';

const AdminWhatsApp: React.FC = () => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    const statusUnsubscribe = whatsAppService.onStatusChange(setStatus);
    const qrCodeUnsubscribe = whatsAppService.onQRCode(setQrCode);

    // Initialize connection
    whatsAppService.initialize();

    return () => {
      statusUnsubscribe();
      qrCodeUnsubscribe();
    };
  }, []);

  const handleRefresh = () => {
    whatsAppService.initialize();
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-12">
      <div className="max-w-3xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">WhatsApp Integration</h1>
          <p className="mt-2 text-gray-600">Connect your WhatsApp account to enable messaging features</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-5 h-5 text-emerald-600" />
                <h2 className="text-lg font-semibold">WhatsApp Connection Status</h2>
              </div>
              <button
                onClick={handleRefresh}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center mb-6">
              <div className={`w-3 h-3 rounded-full mr-3 ${
                status === 'authenticated' ? 'bg-green-500' :
                status === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                'bg-red-500'
              }`} />
              <span className="text-gray-700 capitalize">{status}</span>
            </div>

            {qrCode && status !== 'authenticated' ? (
              <div className="flex flex-col items-center p-8 bg-gray-50 rounded-xl">
                <h3 className="text-lg font-semibold mb-4">Scan QR Code</h3>
                <div className="bg-white p-4 rounded-lg shadow-lg mb-6">
                  <img
                    src={`data:image/png;base64,${qrCode}`}
                    alt="WhatsApp QR Code"
                    className="w-64 h-64"
                  />
                </div>
                <ol className="text-sm text-gray-600 space-y-2">
                  <li>1. Open WhatsApp on your phone</li>
                  <li>2. Go to Settings &gt; WhatsApp Web/Desktop</li>
                  <li>3. Point your phone camera at this QR code</li>
                </ol>
              </div>
            ) : status === 'authenticated' ? (
              <div className="text-center p-8 bg-green-50 rounded-xl">
                <p className="text-green-700">WhatsApp is connected and ready to use!</p>
              </div>
            ) : (
              <div className="text-center p-8">
                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Initializing WhatsApp...</p>
              </div>
            )}
          </div>
        </div>

        {status === 'authenticated' && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-4">Test Connection</h3>
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="space-y-4">
                <input
                  type="tel"
                  placeholder="Enter phone number to test"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <button className="w-full bg-emerald-600 text-white py-2 rounded-xl hover:bg-emerald-700">
                  Send Test Message
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminWhatsApp;
