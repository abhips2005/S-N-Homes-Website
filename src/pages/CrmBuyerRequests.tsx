import { useEffect, useState } from 'react';
import { BuyerRequestService, PropertyMatchService } from '../services/crmService';
import type { BuyerRequest, PropertyMatch, BuyerLeadStatus } from '../types/crm';
import { Users, Search, RefreshCw, MapPin, Star } from 'lucide-react';
import toast from 'react-hot-toast';

const ALL_STATUSES: BuyerLeadStatus[] = [
  'new','contacted','requirements_collected','matching',
  'visit_scheduled','negotiation','won','lost','on_hold',
];

function statusStyle(s: BuyerLeadStatus): string {
  const m: Record<BuyerLeadStatus, string> = {
    new: 'bg-blue-100 text-blue-800',
    contacted: 'bg-indigo-100 text-indigo-800',
    requirements_collected: 'bg-yellow-100 text-yellow-800',
    matching: 'bg-orange-100 text-orange-800',
    visit_scheduled: 'bg-purple-100 text-purple-800',
    negotiation: 'bg-pink-100 text-pink-800',
    won: 'bg-green-100 text-green-800',
    lost: 'bg-gray-100 text-gray-600',
    on_hold: 'bg-gray-100 text-gray-700',
  };
  return m[s] || 'bg-gray-100 text-gray-600';
}

function formatINR(amount?: number) {
  if (!amount) return '\u2014';
  if (amount >= 10000000) return '\u20b9' + (amount / 10000000).toFixed(1) + 'Cr';
  if (amount >= 100000) return '\u20b9' + (amount / 100000).toFixed(1) + 'L';
  return '\u20b9' + amount.toLocaleString('en-IN');
}

export default function CrmBuyerRequests() {
  const [requests, setRequests] = useState<BuyerRequest[]>([]);
  const [selected, setSelected] = useState<BuyerRequest | null>(null);
  const [matches, setMatches] = useState<PropertyMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await BuyerRequestService.getAll(100);
      setRequests(data);
    } catch { toast.error('Failed to load buyer requests'); }
    finally { setLoading(false); }
  };

  const selectRequest = async (req: BuyerRequest) => {
    setSelected(req);
    try {
      const m = await PropertyMatchService.getForRequest(req.id);
      setMatches(m);
    } catch { setMatches([]); }
  };

  const updateStatus = async (id: string, status: BuyerLeadStatus) => {
    try {
      await BuyerRequestService.updateStatus(id, status);
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
      if (selected?.id === id) setSelected(s => s ? { ...s, status } : s);
      toast.success('Status updated');
    } catch { toast.error('Failed to update status'); }
  };

  useEffect(() => { load(); }, []);

  const filtered = requests.filter(r => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const locs = (r.requirements.locations || []).join(' ').toLowerCase();
      const phone = (r.customer?.phone_e164 || '').toLowerCase();
      const name = (r.customer?.name || '').toLowerCase();
      if (!locs.includes(q) && !phone.includes(q) && !name.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden pt-16">
      {/* List panel */}
      <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Users size={20} className="text-blue-600" /> Buyer Requests
              <span className="text-sm font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full ml-1">
                {filtered.length}
              </span>
            </h2>
            <button onClick={load} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
              <RefreshCw size={16} />
            </button>
          </div>
          <div className="relative mb-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, phone, location…"
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="w-full border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All statuses</option>
            {ALL_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? <div className="p-8 text-center text-gray-400">Loading…</div> :
            filtered.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Users size={40} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No buyer requests</p>
              </div>
            ) : filtered.map(req => (
              <button key={req.id} onClick={() => selectRequest(req)}
                className={'w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors' +
                  (selected?.id === req.id ? ' bg-blue-50 border-l-4 border-l-blue-500' : '')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {req.customer?.name || req.customer?.phone_e164 || 'Unknown customer'}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {[
                        req.requirements.property_type,
                        req.requirements.district,
                        req.requirements.location || (req.requirements.locations || []).join(', '),
                        req.requirements.bedrooms_min ? `${req.requirements.bedrooms_min}+ BHK` : req.requirements.detail
                      ].filter(Boolean).join(' · ')}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Budget: {req.requirements.budget_label || (req.requirements.budget_min && req.requirements.budget_max ? `${formatINR(req.requirements.budget_min)} – ${formatINR(req.requirements.budget_max)}` : formatINR(req.requirements.budget_max))}
                    </p>
                  </div>
                  <span className={'text-xs px-2 py-0.5 rounded-full whitespace-nowrap font-medium ' + statusStyle(req.status)}>
                    {req.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{new Date(req.created_at).toLocaleDateString()}</p>
              </button>
            ))}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 overflow-y-auto p-6">
        {selected ? (
          <div className="max-w-2xl space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selected.customer?.name || 'Unknown Customer'}</h3>
                  <p className="text-gray-500">{selected.customer?.phone_e164}</p>
                </div>
                <select
                  value={selected.status}
                  onChange={e => updateStatus(selected.id, e.target.value as BuyerLeadStatus)}
                  className={'border rounded-lg py-1.5 px-3 text-sm font-medium focus:outline-none ' + statusStyle(selected.status)}>
                  {ALL_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h4 className="font-semibold text-gray-900 mb-4">Requirements</h4>
              <div className="grid grid-cols-2 gap-4">
                {([
                  ['Property Type', selected.requirements.property_type],
                  ['Purpose', selected.requirements.purpose],
                  ['District', selected.requirements.district],
                  ['Location', selected.requirements.location || (selected.requirements.locations || []).join(', ')],
                  ['Bedrooms / Preference', selected.requirements.bedrooms_min
                    ? `${selected.requirements.bedrooms_min}+ Bedrooms`
                    : selected.requirements.detail],
                  ['Budget', selected.requirements.budget_label || (selected.requirements.budget_min && selected.requirements.budget_max
                    ? `${formatINR(selected.requirements.budget_min)} – ${formatINR(selected.requirements.budget_max)}`
                    : (selected.requirements.budget_max ? formatINR(selected.requirements.budget_max) : undefined))],
                  ['Timeline', selected.requirements.timeline],
                ] as [string, string | undefined][]).filter(([, v]) => v && v !== '—').map(([label, value]) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                    <p className="text-sm font-medium text-gray-900">{value}</p>
                  </div>
                ))}
                {(selected.requirements.locations || []).length > 1 && (
                  <div className="bg-gray-50 rounded-xl p-3 col-span-2">
                    <p className="text-xs text-gray-500 mb-1">
                      <MapPin size={12} className="inline mr-1" />Preferred Locations
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {(selected.requirements.locations || []).map(l => (
                        <span key={l} className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">{l}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {selected.notes && (
                <div className="mt-4 p-3 bg-yellow-50 rounded-xl">
                  <p className="text-xs text-yellow-700 font-medium mb-1">Notes</p>
                  <p className="text-sm text-gray-800">{selected.notes}</p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Star size={16} className="text-yellow-500" /> Matched Properties
                <span className="text-sm font-normal text-gray-400">({matches.length} sent)</span>
              </h4>
              {matches.length === 0 ? (
                <p className="text-sm text-gray-400">No properties matched yet</p>
              ) : (
                <div className="space-y-3">
                  {matches.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div>
                        <p className="font-medium text-sm text-gray-900">{m.property_title}</p>
                        {m.match_reason && <p className="text-xs text-gray-500 mt-0.5">{m.match_reason}</p>}
                        {m.sent_at && <p className="text-xs text-gray-400">Sent: {new Date(m.sent_at).toLocaleString()}</p>}
                      </div>
                      <a href={m.property_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline whitespace-nowrap ml-2">View \u2192</a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400">
            <div className="text-center">
              <Users size={64} className="mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">Select a buyer request</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
