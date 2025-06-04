import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Send, Image, ArrowRight, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

// Mock data for chats
const mockChats = [
  {
    id: 'chat1',
    propertyId: 'KE-123456-789',
    propertyTitle: 'Luxury Villa in Kochi',
    propertyImage: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
    lastMessage: 'I would like to know more about this property.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    unread: 2,
    messages: [
      {
        id: 'msg1',
        sender: 'user',
        text: 'Hello, I am interested in this property.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
      },
      {
        id: 'msg2',
        sender: 'admin',
        text: 'Hello! Thank you for your interest. How can I help you?',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2.5).toISOString(), // 2.5 hours ago
      },
      {
        id: 'msg3',
        sender: 'user',
        text: 'I would like to know more about this property.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
      }
    ]
  },
  {
    id: 'chat2',
    propertyId: 'KE-654321-987',
    propertyTitle: 'Modern Apartment in Trivandrum',
    propertyImage: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
    lastMessage: 'Is the price negotiable?',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    unread: 0,
    messages: [
      {
        id: 'msg4',
        sender: 'user',
        text: 'Hi, I am interested in this apartment.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(), // 26 hours ago
      },
      {
        id: 'msg5',
        sender: 'admin',
        text: 'Hello! This is a great choice. What would you like to know?',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString(), // 25 hours ago
      },
      {
        id: 'msg6',
        sender: 'user',
        text: 'Is the price negotiable?',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 24 hours ago
      }
    ]
  }
];

interface Message {
  id: string;
  sender: 'user' | 'admin';
  text: string;
  timestamp: string;
  image?: string;
}

interface Chat {
  id: string;
  propertyId: string;
  propertyTitle: string;
  propertyImage: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
  messages: Message[];
}

const MessageCenter: React.FC = () => {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app, this would be an API call to fetch the user's chats
    // For now, we'll use mock data
    setTimeout(() => {
      setChats(mockChats);
      setLoading(false);
    }, 1000);
  }, []);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !selectedChat) return;
    
    const newMsg: Message = {
      id: `msg${Date.now()}`,
      sender: 'user',
      text: newMessage.trim(),
      timestamp: new Date().toISOString()
    };
    
    // Update the selected chat with the new message
    const updatedChat = {
      ...selectedChat,
      lastMessage: newMessage.trim(),
      timestamp: new Date().toISOString(),
      messages: [...selectedChat.messages, newMsg]
    };
    
    // Update the chats array
    setChats(prevChats => 
      prevChats.map(chat => 
        chat.id === selectedChat.id ? updatedChat : chat
      )
    );
    
    // Update the selected chat
    setSelectedChat(updatedChat);
    
    // Clear the input
    setNewMessage('');
    
    // In a real app, this would send the message to the server
    toast.success('Message sent');
  };

  const handleChatSelect = (chat: Chat) => {
    // Mark the chat as read
    const updatedChat = {
      ...chat,
      unread: 0
    };
    
    // Update the chats array
    setChats(prevChats => 
      prevChats.map(c => 
        c.id === chat.id ? updatedChat : c
      )
    );
    
    // Set the selected chat
    setSelectedChat(updatedChat);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !selectedChat) return;
    
    // In a real app, this would upload the image to a server
    // For now, we'll just create a local URL
    const file = files[0];
    const imageUrl = URL.createObjectURL(file);
    
    const newMsg: Message = {
      id: `msg${Date.now()}`,
      sender: 'user',
      text: 'Image sent',
      timestamp: new Date().toISOString(),
      image: imageUrl
    };
    
    // Update the selected chat with the new message
    const updatedChat = {
      ...selectedChat,
      lastMessage: 'Image sent',
      timestamp: new Date().toISOString(),
      messages: [...selectedChat.messages, newMsg]
    };
    
    // Update the chats array
    setChats(prevChats => 
      prevChats.map(chat => 
        chat.id === selectedChat.id ? updatedChat : chat
      )
    );
    
    // Update the selected chat
    setSelectedChat(updatedChat);
    
    toast.success('Image sent');
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    
    // If the message is from today, show the time
    if (date.toDateString() === now.toDateString()) {
      return format(date, 'h:mm a');
    }
    
    // If the message is from yesterday, show "Yesterday"
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    // Otherwise, show the date
    return format(date, 'MMM d');
  };

  const openWhatsApp = () => {
    if (!selectedChat) return;
    
    // Create WhatsApp message with property details
    const message = `Hi I need more details of the property - ${selectedChat.propertyId} at ${selectedChat.propertyTitle}.`;
    const encodedMessage = encodeURIComponent(message);
    
    // Open WhatsApp with the pre-written message
    // In a real app, you would use the agent's phone number
    window.open(`https://wa.me/919876543210?text=${encodedMessage}`, '_blank');
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Please login to view your messages</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-3 h-[600px]">
        {/* Chat List */}
        <div className="border-r border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Messages</h2>
          </div>
          
          <div className="overflow-y-auto h-[calc(600px-64px)]">
            {chats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-4">
                <MessageSquare className="w-12 h-12 text-gray-300 mb-2" />
                <p className="text-gray-500 text-center">No messages yet</p>
                <p className="text-gray-400 text-sm text-center mt-1">
                  Your conversations will appear here
                </p>
              </div>
            ) : (
              chats.map(chat => (
                <div
                  key={chat.id}
                  className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                    selectedChat?.id === chat.id ? 'bg-emerald-50' : ''
                  }`}
                  onClick={() => handleChatSelect(chat)}
                >
                  <div className="flex items-start space-x-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                      <img
                        src={chat.propertyImage}
                        alt={chat.propertyTitle}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h3 className="font-medium truncate">{chat.propertyTitle}</h3>
                        <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                          {formatTimestamp(chat.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 truncate mt-1">
                        {chat.lastMessage}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-500">
                          ID: {chat.propertyId}
                        </span>
                        {chat.unread > 0 && (
                          <span className="bg-emerald-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                            {chat.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Window */}
        <div className="col-span-2 flex flex-col">
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg overflow-hidden">
                    <img
                      src={selectedChat.propertyImage}
                      alt={selectedChat.propertyTitle}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="font-medium">{selectedChat.propertyTitle}</h3>
                    <p className="text-xs text-gray-500">ID: {selectedChat.propertyId}</p>
                  </div>
                </div>
                <button
                  onClick={openWhatsApp}
                  className="bg-green-500 text-white px-3 py-1 rounded-lg text-sm flex items-center space-x-1 hover:bg-green-600 transition-colors"
                >
                  <span>Continue on WhatsApp</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {selectedChat.messages.map(message => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-xl px-4 py-2 ${
                        message.sender === 'user'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {message.image && (
                        <img
                          src={message.image}
                          alt="Sent"
                          className="rounded-lg mb-2 max-w-full"
                        />
                      )}
                      <p>{message.text}</p>
                      <div
                        className={`text-xs mt-1 ${
                          message.sender === 'user' ? 'text-emerald-100' : 'text-gray-500'
                        } flex items-center justify-end`}
                      >
                        <Clock className="w-3 h-3 mr-1" />
                        {formatTimestamp(message.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Message Input */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 flex space-x-2">
                <label className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 cursor-pointer">
                  <Image className="w-5 h-5 text-gray-600" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </label>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className={`p-2 rounded-full ${
                    newMessage.trim()
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-4">
              <MessageSquare className="w-16 h-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-1">No chat selected</h3>
              <p className="text-gray-500 text-center">
                Select a conversation to start chatting
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageCenter; 