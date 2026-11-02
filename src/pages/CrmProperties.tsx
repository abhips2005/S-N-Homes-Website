import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Plus, Search, Eye, Pencil, CheckCircle, Archive, XCircle, ChevronLeft } from 'lucide-react';
import { BACKEND_URL } from '../services/crmService';
import { supabase } from '../supabase-config';

const API = BACKEND_URL ? `${BACKEND_URL}/api/v1` : '/api/v1';

interface Property {
  id: string;
  title?: string;
  propertyType?: string;
  price?: number;
  location?: string;
  status?: string;
  bedrooms?: number;
  created_at?: { seconds?: number } | string;
}

const STATUS_COLORS: Record<string, string> = {
  active:    'bg-green-100 text-green-700',
  draft:     'bg-yellow-100 text-yellow-700',
  sold:      'bg-blue-100 text-blue-700',
  archived:  'bg-gray-100 text-gray-500',
  inactive:  'bg-red-100 text-red-700',
};

function formatINR(v?: number) {
  if (!v) return '—';
  if (v >= 10000000) return '₹' + (v / 10000000).toFixed(1) + ' Cr';
  if (v >= 100000) return '₹' + (v / 100000).toFixed(1) + ' L';
  return '₹' + v.toLocaleString('en-IN');
}

function fmtDate(ts?: { seconds?: number } | string) {
  if (!ts) return '—';
  if (typeof ts === 'string') return new Date(ts).toLocaleDateString('en-IN');
  if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleDateString('en-IN');
  return '—';
}

// ─── Edit / Create Modal ──────────────────────────────────────────────────────
function PropertyModal({ initial, onClose, onSaved }: {
  initial?: Partial<Property>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !initial?.id;
  const [form, setForm] = useState({
    title: initial?.title ?? '',
    propertyType: initial?.propertyType ?? 'house',
    price: initial?.price ? String(initial.price) : '',
    location: initial?.location ?? '',
    status: initial?.status ?? 'draft',
    bedrooms: initial?.bedrooms ? String(initial.bedrooms) : '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!form.title || !form.propertyType) { setError('Title and type are required'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        price: form.price ? Number(form.price) : null,
        bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
      };
      const url = isNew ? API + '/properties' : API + '/properties/' + initial!.id;
      const method = isNew ? 'POST' : 'PATCH';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      onSaved();
      onClose();
    } catch (e) {
      console.warn('[CRM] API save failed, falling back to Supabase:', e);
      try {
        if (isNew) {
          const { error: insErr } = await supabase.from('properties').insert({
            title: form.title,
            property_type: form.propertyType,
            price: form.price ? Number(form.price) : null,
            location: form.location,
            status: form.status,
            bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
          });
          if (insErr) throw insErr;
        } else {
          const { error: updErr } = await supabase.from('properties').update({
            title: form.title,
            property_type: form.propertyType,
            price: form.price ? Number(form.price) : null,
            location: form.location,
            status: form.status,
            bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
          }).eq('id', initial!.id);
          if (updErr) throw updErr;
        }
        onSaved();
        onClose();
      } catch (dbErr) {
        setError(String(dbErr));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
        <h2 className="text-xl font-bold text-gray-900">{isNew ? 'New Property' : 'Edit Property'}</h2>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {[
          { label: 'Title', key: 'title' as const, type: 'text' },
          { label: 'Location', key: 'location' as const, type: 'text' },
          { label: 'Price (₹)', key: 'price' as const, type: 'number' },
          { label: 'Bedrooms', key: 'bedrooms' as const, type: 'number' },
        ].map(f => (
          <div key={f.key}>
            <label className="text-sm font-medium text-gray-700">{f.label}</label>
            <input
              type={f.type}
              value={form[f.key]}
              onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Type</label>
            <select value={form.propertyType} onChange={e => setForm(p => ({ ...p, propertyType: e.target.value }))}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              {['house','flat','plot','commercial','villa','land'].map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Status</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              {['draft','active','inactive','sold','archived'].map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CrmProperties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [editProp, setEditProp] = useState<Property | null | undefined>(undefined);
  const [actionId, setActionId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const qs = filterStatus ? '?status=' + filterStatus : '';
      const res = await fetch(API + '/properties' + qs);
      if (!res.ok) throw new Error('API failed');
      const data = await res.json();
      setProperties(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.warn('[CRM] API load failed, falling back to Supabase:', err);
      let q = supabase
        .from('properties')
        .select('id, title, property_type, price, location, status, bedrooms, created_at')
        .order('created_at', { ascending: false });
      if (filterStatus) q = q.eq('status', filterStatus);
      const { data } = await q;
      setProperties((data || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        propertyType: r.property_type,
        price: Number(r.price),
        location: r.location,
        status: r.status,
        bedrooms: r.bedrooms,
        created_at: r.created_at,
      })));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filterStatus]);

  async function changeStatus(id: string, status: string) {
    setActionId(id);
    try {
      const res = await fetch(API + '/properties/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('API failed');
    } catch {
      await supabase.from('properties').update({ status }).eq('id', id);
    }
    await load();
    setActionId(null);
  }

  const filtered = properties.filter(p =>
    !search ||
    (p.title ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.location ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 pt-24 px-6 pb-12">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin/crm" className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronLeft size={20} className="text-gray-500" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Building2 size={24} className="text-blue-600" /> Properties
              </h1>
              <p className="text-sm text-gray-500">Create, edit, publish and archive listings</p>
            </div>
          </div>
          <button
            onClick={() => setEditProp(null)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus size={16} /> New Property
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="Search title or location…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
          >
            <option value="">All statuses</option>
            {['draft','active','inactive','sold','archived'].map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400">No properties found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Title','Type','Location','Price','Bedrooms','Status','Added','Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-48 truncate">{p.title ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{p.propertyType ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-36 truncate">{p.location ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-900 font-medium">{formatINR(p.price)}</td>
                      <td className="px-4 py-3 text-gray-600">{p.bedrooms ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={'px-2 py-1 rounded-full text-xs font-medium ' + (STATUS_COLORS[p.status ?? ''] ?? 'bg-gray-100 text-gray-500')}>
                          {p.status ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{fmtDate(p.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <a href={'/property/' + p.id} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500" title="View">
                            <Eye size={14} />
                          </a>
                          <button onClick={() => setEditProp(p)}
                            className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600" title="Edit">
                            <Pencil size={14} />
                          </button>
                          {p.status !== 'active' && (
                            <button onClick={() => changeStatus(p.id, 'active')} disabled={actionId === p.id}
                              className="p-1.5 hover:bg-green-50 rounded-lg text-green-600" title="Publish">
                              <CheckCircle size={14} />
                            </button>
                          )}
                          {p.status !== 'inactive' && p.status !== 'archived' && (
                            <button onClick={() => changeStatus(p.id, 'inactive')} disabled={actionId === p.id}
                              className="p-1.5 hover:bg-red-50 rounded-lg text-red-500" title="Mark inactive">
                              <XCircle size={14} />
                            </button>
                          )}
                          {p.status !== 'archived' && (
                            <button onClick={() => changeStatus(p.id, 'archived')} disabled={actionId === p.id}
                              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400" title="Archive">
                              <Archive size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {editProp !== undefined && (
        <PropertyModal
          initial={editProp ?? undefined}
          onClose={() => setEditProp(undefined)}
          onSaved={load}
        />
      )}
    </div>
  );
}
