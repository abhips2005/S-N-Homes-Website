import { useEffect, useState } from 'react';
import { BuyerRequestService, PropertyMatchService } from '../services/crmService';
import type { BuyerRequest, PropertyMatch, BuyerLeadStatus } from '../types/crm';
import { Users, Search, RefreshCw, MapPin, Star, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import CrmBottomNav from '../components/CrmBottomNav';

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
    <div className="flex h-screen bg-gray-50 overflow-hidden pt-16 pb-16 md:pb-0">
      {/* List panel */}
      <div className={`w-full md:w-96 bg-white border-r border-gray-200 flex flex-col ${selected ? 'hidden md:flex' : 'flex'}`}>
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
      <div className={`flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6 ${selected ? 'block' : 'hidden md:block'}`}>
        {selected ? (
          <div className="max-w-2xl space-y-6">
            {/* Mobile back button */}
            <button
              onClick={() => setSelected(null)}
              className="md:hidden mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg active:scale-95 transition-transform"
            >
              <ChevronLeft size={16} /> Back to requests
            </button>
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
              {/* Call & WhatsApp buttons */}
              {selected.customer?.phone_e164 && (
                <div className="flex gap-2 mt-4">
                  <a
                    href={`tel:${selected.customer.phone_e164}`}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-sm font-medium hover:bg-blue-100 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.61 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    Call
                  </a>
                  <a
                    href={`https://wa.me/${selected.customer.phone_e164.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${selected.customer?.name || ''}, Welcome to S N Homes`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 bg-green-50 text-green-700 rounded-xl text-sm font-medium hover:bg-green-100 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
                    WhatsApp
                  </a>
                </div>
              )}
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
          <div className="h-full hidden md:flex items-center justify-center text-gray-400">
            <div className="text-center">
              <Users size={64} className="mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">Select a buyer request</p>
            </div>
          </div>
        )}
      </div>
      <CrmBottomNav />
    </div>
  );
}
