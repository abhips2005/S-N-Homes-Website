import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Settings, ChevronLeft, CheckCircle, XCircle, AlertCircle, RefreshCw, Save } from 'lucide-react';

interface HealthStatus {
  ok: boolean;
  whatsapp_configured: boolean;
  ai_configured: boolean;
  firebase_configured: boolean;
  timestamp: string;
}

interface NotifPrefs {
  ownerPhone: string;
  ownerEmail: string;
  notifyNewBuyer: boolean;
  notifyNewSeller: boolean;
  notifyAgentRequest: boolean;
  notifyWorkerFailure: boolean;
}

const STORAGE_KEY = 'crm_notif_prefs';

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={'flex items-center gap-2 px-4 py-3 rounded-xl ' + (ok ? 'bg-green-50' : 'bg-red-50')}>
      {ok
        ? <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
        : <XCircle size={18} className="text-red-500 flex-shrink-0" />}
      <span className={'text-sm font-medium ' + (ok ? 'text-green-700' : 'text-red-600')}>{label}</span>
    </div>
  );
}

export default function CrmSettings() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState('');

  const [prefs, setPrefs] = useState<NotifPrefs>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (_) { /* ignore */ }
    return {
      ownerPhone: '',
      ownerEmail: '',
      notifyNewBuyer: true,
      notifyNewSeller: true,
      notifyAgentRequest: true,
      notifyWorkerFailure: true,
    };
  });
  const [savedPrefs, setSavedPrefs] = useState(false);

  async function loadHealth() {
    setHealthLoading(true);
    setHealthError('');
    try {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error('Server returned ' + res.status);
      setHealth(await res.json());
    } catch (e) {
      setHealthError(String(e));
    }
    setHealthLoading(false);
  }

  useEffect(() => { loadHealth(); }, []);

  function savePrefs() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    setSavedPrefs(true);
    setTimeout(() => setSavedPrefs(false), 2000);
  }

  function togglePref(key: keyof NotifPrefs) {
    setPrefs(p => ({ ...p, [key]: !p[key] }));
  }

  const TOGGLES: { key: keyof NotifPrefs; label: string; desc: string }[] = [
    { key: 'notifyNewBuyer', label: 'New buyer lead', desc: 'Alert when a buyer submits requirements' },
    { key: 'notifyNewSeller', label: 'New seller submission', desc: 'Alert when a seller submits a property' },
    { key: 'notifyAgentRequest', label: 'Human agent requested', desc: 'Alert when a customer asks for human help' },
    { key: 'notifyWorkerFailure', label: 'Worker job failures', desc: 'Alert when a job permanently fails after retries' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/admin/crm" className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft size={20} className="text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Settings size={24} className="text-gray-600" /> CRM Settings
            </h1>
            <p className="text-sm text-gray-500">Connection status, notifications, and workflow configuration</p>
          </div>
        </div>

        {/* System Health */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">System Health</h2>
            <button
              onClick={loadHealth}
              disabled={healthLoading}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
            >
              <RefreshCw size={14} className={healthLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          {healthError && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-xl px-4 py-3 text-sm">
              <AlertCircle size={16} /> {healthError}
            </div>
          )}

          {healthLoading && !health && (
            <p className="text-sm text-gray-400 text-center py-4">Checking server health…</p>
          )}

          {health && (
            <div className="space-y-2">
              <StatusBadge ok={health.ok} label={'Server: ' + (health.ok ? 'Online' : 'Offline')} />
              <StatusBadge ok={health.whatsapp_configured} label={'WhatsApp: ' + (health.whatsapp_configured ? 'Configured (Access Token + Phone ID set)' : 'Not configured — set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID')} />
              <StatusBadge ok={health.ai_configured} label={'AI (Gemini): ' + (health.ai_configured ? 'Configured' : 'Not configured — set GEMINI_API_KEY')} />
              <StatusBadge ok={health.firebase_configured} label={'Firebase Admin: ' + (health.firebase_configured ? 'Configured' : 'Not configured — set FIREBASE_SERVICE_ACCOUNT_JSON')} />
              <p className="text-xs text-gray-400 pt-1">Last checked: {new Date(health.timestamp).toLocaleTimeString('en-IN')}</p>
            </div>
          )}
        </div>

        {/* Contact details */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Owner Contact</h2>
          <p className="text-sm text-gray-500">
            Used for system notifications (new leads, agent requests). These are stored locally in your browser.
            For production, set <code className="bg-gray-100 px-1 rounded text-xs">OWNER_WHATSAPP_PHONE</code> and{' '}
            <code className="bg-gray-100 px-1 rounded text-xs">OWNER_EMAIL</code> in your server environment.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-gray-700">WhatsApp number (E.164)</label>
              <input
                type="tel"
                placeholder="+919876543210"
                value={prefs.ownerPhone}
                onChange={e => setPrefs(p => ({ ...p, ownerPhone: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Email address</label>
              <input
                type="email"
                placeholder="owner@snhomes.in"
                value={prefs.ownerEmail}
                onChange={e => setPrefs(p => ({ ...p, ownerEmail: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Notification preferences */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Notification Preferences</h2>
          <div className="divide-y divide-gray-50">
            {TOGGLES.map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
                <button
                  onClick={() => togglePref(key)}
                  className={'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ' +
                    (prefs[key] ? 'bg-blue-600' : 'bg-gray-200')}
                >
                  <span className={'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ' +
                    (prefs[key] ? 'translate-x-5' : 'translate-x-0')} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* WhatsApp webhook info */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-3">
          <h2 className="text-base font-semibold text-gray-900">WhatsApp Webhook Configuration</h2>
          <p className="text-sm text-gray-500">Configure these in your Meta Developer Console under WhatsApp &rarr; Configuration &rarr; Webhook.</p>
          <div className="space-y-2">
            {[
              { label: 'Webhook URL', value: (window.location.origin) + '/api/webhooks/whatsapp' },
              { label: 'Verify Token', value: 'Set via WHATSAPP_VERIFY_TOKEN env var' },
              { label: 'Subscribed Fields', value: 'messages, message_status' },
            ].map(row => (
              <div key={row.label} className="flex gap-3 text-sm">
                <span className="font-medium text-gray-700 w-40 flex-shrink-0">{row.label}</span>
                <code className="bg-gray-50 border border-gray-200 rounded px-2 py-0.5 text-xs text-gray-800 break-all">{row.value}</code>
              </div>
            ))}
          </div>
        </div>

        {/* Environment variable checklist */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-3">
          <h2 className="text-base font-semibold text-gray-900">Required Environment Variables</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
            {[
              'WHATSAPP_ACCESS_TOKEN',
              'WHATSAPP_PHONE_NUMBER_ID',
              'WHATSAPP_VERIFY_TOKEN',
              'META_APP_SECRET',
              'GEMINI_API_KEY',
              'FIREBASE_SERVICE_ACCOUNT_JSON',
              'VITE_FIREBASE_PROJECT_ID',
              'VITE_FIREBASE_STORAGE_BUCKET',
              'WEBSITE_BASE_URL',
              'OWNER_WHATSAPP_PHONE',
              'OWNER_EMAIL',
              'SENDGRID_API_KEY',
            ].map(v => (
              <span key={v} className="bg-gray-50 border border-gray-200 rounded px-2 py-1 text-gray-700">{v}</span>
            ))}
          </div>
          <p className="text-xs text-gray-400">Copy <code>.env.example</code> to <code>.env</code> and fill in all values before running the server.</p>
        </div>

        {/* Save button */}
        <div className="flex justify-end">
          <button
            onClick={savePrefs}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <Save size={16} />
            {savedPrefs ? 'Saved!' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  );
}
