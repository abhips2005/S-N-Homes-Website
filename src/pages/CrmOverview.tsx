import { useState, useEffect } from 'react';
import { getDashboardSummary, BACKEND_URL } from '../services/crmService';
import type { DashboardSummary } from '../types/crm';
import { Link } from 'react-router-dom';
import {
  MessageSquare, Users, Building2, CalendarCheck,
  AlertCircle, Home, RefreshCw, ArrowRight, Wifi
} from 'lucide-react';
import toast from 'react-hot-toast';
import CrmBottomNav from '../components/CrmBottomNav';

function StatCard({ icon, label, value, color, linkTo }: {
  icon: React.ReactNode; label: string; value: number;
  color: string; linkTo?: string;
}) {
  const content = (
    <div className={"bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100 hover:shadow-md active:scale-[0.98] transition-all" + (linkTo ? " cursor-pointer" : "")}>
      <div className="flex items-center justify-between mb-2 md:mb-3">
        <div className={color + " w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center"}>{icon}</div>
        {linkTo && <ArrowRight size={14} className="text-gray-400" />}
      </div>
      <p className="text-2xl md:text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-xs md:text-sm text-gray-500 mt-1 line-clamp-1">{label}</p>
    </div>
  );
  return linkTo ? <Link to={linkTo}>{content}</Link> : content;
}

export default function CrmOverview() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [waStatus, setWaStatus] = useState<{ configured: boolean; ai_configured: boolean } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getDashboardSummary();
      setSummary(data);
    } catch { toast.error('Failed to load dashboard'); }
    finally { setLoading(false); }
  };

  const checkServer = async () => {
    try {
      const url = BACKEND_URL ? `${BACKEND_URL}/api/health` : '/api/health';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setWaStatus({ configured: data.whatsapp_configured, ai_configured: data.ai_configured });
      }
    } catch { /* server not running — expected in dev without starting it */ }
  };

  useEffect(() => { load(); checkServer(); }, []);

  return (
    <div className="min-h-screen bg-gray-50 pt-20 px-4 pb-28 md:pt-24 md:px-6 md:pb-12">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">WhatsApp CRM Overview</h1>
            <p className="text-gray-500 text-sm mt-0.5">Real-time snapshot of your S&N Homes CRM</p>
          </div>
          <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Server status */}
        {waStatus !== null && (
          <div className={"mb-6 p-4 rounded-2xl border " + (waStatus.configured ? "bg-green-50 border-green-200" : "bg-orange-50 border-orange-200")}>
            <div className="flex items-center gap-3">
              <Wifi size={18} className={waStatus.configured ? 'text-green-600' : 'text-orange-500'} />
              <div>
                <p className={"font-medium text-sm " + (waStatus.configured ? "text-green-800" : "text-orange-800")}>
                  WhatsApp Server: {waStatus.configured ? '✅ Connected' : '⚠️ Not configured'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  AI (Gemini): {waStatus.ai_configured ? '✅ Ready' : '⚠️ GEMINI_API_KEY not set'} ·
                  WhatsApp API: {waStatus.configured ? '✅ Ready' : '⚠️ WHATSAPP_ACCESS_TOKEN not set'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stat cards */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-pulse h-28" />
            ))}
          </div>
        ) : summary ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <StatCard icon={<Users size={20} className="text-blue-600" />} label="New Buyer Requests"
              value={summary.new_buyer_requests} color="bg-blue-100" linkTo="/admin/crm/buyers" />
            <StatCard icon={<Building2 size={20} className="text-purple-600" />} label="Pending Seller Reviews"
              value={summary.pending_seller_submissions} color="bg-purple-100" linkTo="/admin/crm/sellers" />
            <StatCard icon={<MessageSquare size={20} className="text-green-600" />} label="Active Conversations"
              value={summary.active_conversations} color="bg-green-100" linkTo="/admin/crm/inbox" />
            <StatCard icon={<AlertCircle size={20} className="text-red-600" />} label="Need Attention (Paused)"
              value={summary.conversations_needing_attention} color="bg-red-100" linkTo="/admin/crm/inbox" />
            <StatCard icon={<CalendarCheck size={20} className="text-teal-600" />} label="Follow-ups Due Today"
              value={summary.follow_ups_due_today} color="bg-teal-100" linkTo="/admin/crm/followups" />
            <StatCard icon={<AlertCircle size={20} className="text-orange-600" />} label="Failed Jobs"
              value={summary.failed_jobs} color="bg-orange-100" />
          </div>
        ) : null}

        {/* Quick links */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Inbox', icon: <MessageSquare size={18} />, to: '/admin/crm/inbox', color: 'bg-green-50 text-green-700 hover:bg-green-100' },
              { label: 'Buyer Requests', icon: <Users size={18} />, to: '/admin/crm/buyers', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
              { label: 'Seller Submissions', icon: <Building2 size={18} />, to: '/admin/crm/sellers', color: 'bg-purple-50 text-purple-700 hover:bg-purple-100' },
              { label: 'Follow-ups', icon: <CalendarCheck size={18} />, to: '/admin/crm/followups', color: 'bg-teal-50 text-teal-700 hover:bg-teal-100' },
              { label: 'Properties', icon: <Home size={18} />, to: '/admin/crm/properties', color: 'bg-orange-50 text-orange-700 hover:bg-orange-100' },
              { label: 'Audit Logs', icon: <Wifi size={18} />, to: '/admin/crm/audit', color: 'bg-gray-50 text-gray-700 hover:bg-gray-100' },
              { label: 'Settings', icon: <AlertCircle size={18} />, to: '/admin/crm/settings', color: 'bg-slate-50 text-slate-700 hover:bg-slate-100' },
            ].map((item) => (
              <Link key={item.label} to={item.to}
                className={item.color + " flex items-center gap-2.5 p-3.5 rounded-xl font-medium text-sm transition-colors"}>
                {item.icon} {item.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Setup guide (shown when server is unconfigured) */}
        {waStatus && !waStatus.configured && (
          <div className="mt-6 bg-white rounded-2xl p-6 shadow-sm border border-orange-100">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <AlertCircle size={18} className="text-orange-500" /> Setup Required
            </h2>
            <p className="text-sm text-gray-600 mb-3">Set these environment variables in your <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">.env</code> file to activate WhatsApp:</p>
            <div className="space-y-1.5 font-mono text-xs bg-gray-900 text-gray-100 rounded-xl p-4">
              <p><span className="text-yellow-400">WHATSAPP_ACCESS_TOKEN</span>=your_token_from_meta</p>
              <p><span className="text-yellow-400">WHATSAPP_PHONE_NUMBER_ID</span>=your_phone_number_id</p>
              <p><span className="text-yellow-400">WHATSAPP_VERIFY_TOKEN</span>=my_verify_token</p>
              <p><span className="text-yellow-400">META_APP_SECRET</span>=your_app_secret</p>
              <p><span className="text-yellow-400">GEMINI_API_KEY</span>=your_gemini_key</p>
            </div>
            <p className="text-xs text-gray-500 mt-3">Then run: <code className="bg-gray-100 px-1.5 py-0.5 rounded">npm run server</code></p>
          </div>
        )}
      </div>
      <CrmBottomNav />
    </div>
  );
}
