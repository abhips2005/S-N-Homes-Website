import { useEffect, useState, useRef } from 'react';
import { ConversationService, MessageService } from '../services/crmService';
import type { Conversation, CrmMessage } from '../types/crm';
import { MessageSquare, Play, Pause, Send, User, Bot, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CrmInbox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<CrmMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const data = await ConversationService.getAll(50);
      setConversations(data);
    } catch {
      toast.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const selectConversation = async (conv: Conversation) => {
    setSelected(conv);
    try {
      const msgs = await MessageService.getForConversation(conv.id, 100);
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch {
      toast.error('Failed to load messages');
    }
  };

  const togglePause = async () => {
    if (!selected) return;
    try {
      await ConversationService.setPaused(selected.id, !selected.automation_paused);
      const updated = { ...selected, automation_paused: !selected.automation_paused };
      setSelected(updated);
      setConversations(prev => prev.map(c => c.id === selected.id ? updated : c));
      toast.success(updated.automation_paused ? 'Bot paused' : 'Bot resumed');
    } catch {
      toast.error('Failed to update automation status');
    }
  };

  const sendManualReply = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      const phone = selected.customer?.phone_e164 || '';
      const res = await fetch('/api/v1/conversations/' + selected.id + '/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phone, message: reply.trim() }),
      });
      if (!res.ok) throw new Error('send failed');
      const newMsg: CrmMessage = {
        id: Date.now().toString(),
        conversation_id: selected.id,
        direction: 'outbound',
        message_type: 'text',
        body: reply.trim(),
        provider_status: 'sent',
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, newMsg]);
      setReply('');
      toast.success('Message sent');
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => { loadConversations(); }, []);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare size={20} className="text-green-600" /> Inbox
          </h2>
          <button onClick={loadConversations} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <RefreshCw size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading…</div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <MessageSquare size={40} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs mt-1">WhatsApp messages will appear here</p>
            </div>
          ) : (
            conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => selectConversation(conv)}
                className={'w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors' +
                  (selected?.id === conv.id ? ' bg-green-50 border-l-4 border-l-green-500' : '')}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <User size={14} className="text-green-700" />
                  </div>
                  <span className="font-medium text-sm text-gray-900 truncate flex-1">
                    {conv.customer?.name || conv.customer?.phone_e164 || 'Unknown'}
                  </span>
                  {conv.automation_paused && (
                    <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Paused</span>
                  )}
                </div>
                <div className="flex gap-1 ml-10">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-700">
                    {conv.intent}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    {conv.workflow_status.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-xs text-gray-400 ml-10 mt-1">
                  {new Date(conv.last_message_at).toLocaleString()}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {selected ? (
          <>
            <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">
                  {selected.customer?.name || selected.customer?.phone_e164 || 'Customer'}
                </h3>
                <p className="text-sm text-gray-500">{selected.customer?.phone_e164}</p>
              </div>
              <button
                onClick={togglePause}
                className={'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ' +
                  (selected.automation_paused
                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                    : 'bg-orange-100 text-orange-800 hover:bg-orange-200')}
              >
                {selected.automation_paused
                  ? <><Play size={14} /> Resume Bot</>
                  : <><Pause size={14} /> Pause Bot</>}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="text-center text-gray-400 py-16">
                  <MessageSquare size={40} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No messages yet</p>
                </div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={'flex ' + (msg.direction === 'outbound' ? 'justify-end' : 'justify-start')}>
                    {msg.direction === 'inbound' && (
                      <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                        <User size={12} className="text-green-700" />
                      </div>
                    )}
                    <div className={'max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm shadow-sm ' +
                      (msg.direction === 'outbound'
                        ? 'bg-green-600 text-white rounded-br-sm'
                        : 'bg-white text-gray-900 rounded-bl-sm border border-gray-200')}>
                      {msg.body || '[media]'}
                      <p className={'text-xs mt-1 ' + (msg.direction === 'outbound' ? 'text-green-200' : 'text-gray-400')}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {msg.direction === 'outbound' && (
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center ml-2 flex-shrink-0 mt-1">
                        <Bot size={12} className="text-gray-600" />
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="bg-white border-t border-gray-200 p-4">
              {!selected.automation_paused && (
                <p className="text-xs text-orange-600 mb-2 flex items-center gap-1">
                  <Bot size={12} /> Bot is active — pause to reply manually
                </p>
              )}
              <div className="flex gap-3">
                <textarea
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  placeholder={selected.automation_paused ? 'Type a message…' : 'Pause the bot to reply manually'}
                  disabled={!selected.automation_paused}
                  rows={2}
                  className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50 disabled:text-gray-400"
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendManualReply(); } }}
                />
                <button
                  onClick={sendManualReply}
                  disabled={!selected.automation_paused || !reply.trim() || sending}
                  className="px-5 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <Send size={16} /> {sending ? 'Sending…' : 'Send'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <MessageSquare size={64} className="mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">Select a conversation</p>
              <p className="text-sm">Click on a conversation to view messages</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
