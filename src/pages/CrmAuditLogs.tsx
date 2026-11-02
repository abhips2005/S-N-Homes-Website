import { useEffect, useState } from 'react';
import { Shield, RefreshCw, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { AuditLogService } from '../services/crmService';
import CrmBottomNav from '../components/CrmBottomNav';

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entity_id: string;
  actor: string;
  details?: Record<string, unknown>;
  created_at: { seconds: number } | string;
}

function formatTs(ts: { seconds: number } | string): string {
  if (!ts) return '-';
  const d = typeof ts === 'string' ? new Date(ts) : new Date((ts as { seconds: number }).seconds * 1000);
  return d.toLocaleString();
}

const ACTION_COLORS: Record<string, string> = {
  submission_approved: 'bg-green-100 text-green-800',
  submission_rejected: 'bg-red-100 text-red-800',
  submission_published: 'bg-blue-100 text-blue-800',
  submission_created: 'bg-yellow-100 text-yellow-800',
  bot_paused: 'bg-orange-100 text-orange-800',
  bot_resumed: 'bg-teal-100 text-teal-800',
  manual_reply: 'bg-indigo-100 text-indigo-800',
  opt_out: 'bg-gray-100 text-gray-700',
  buyer_request_updated: 'bg-purple-100 text-purple-800',
};

export default function CrmAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await AuditLogService.getAll(200, entityFilter || undefined);
      setLogs(data as AuditLog[]);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [entityFilter]);

  const filtered = logs.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return l.action.includes(q) || l.entity.includes(q) ||
      l.actor.includes(q) || l.entity_id.includes(q);
  });

  const entities = [...new Set(logs.map(l => l.entity))];

  return (
    <div className="min-h-screen bg-gray-50 pt-20 px-4 pb-28 md:pt-24 md:px-6 md:pb-12">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Shield size={28} className="text-gray-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
              <p className="text-gray-500 text-sm">All CRM actions with actor and timestamp</p>
            </div>
          </div>
          <button onClick={load}
            className="p-2 rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50">
            <RefreshCw size={16} />
          </button>
        </div>

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by action, actor, entity ID..."
              className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white" />
          </div>
          <select value={entityFilter} onChange={e => setEntityFilter(e.target.value)}
            className="border border-gray-200 rounded-xl py-2 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-400">
            <option value="">All entities</option>
            {entities.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Shield size={40} className="mx-auto mb-2 opacity-30" />
              <p>No audit records found</p>
            </div>
          ) : (
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Timestamp</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Action</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Entity</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Entity ID</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                      {formatTs(log.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' +
                        (ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600')}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{log.entity.replace(/crm_/g, '')}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-gray-400 truncate block max-w-32">
                        {log.entity_id}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{log.actor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <CrmBottomNav />
    </div>
  );
}
