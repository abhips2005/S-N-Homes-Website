import { useEffect, useState } from 'react';
import { SellerSubmissionService } from '../services/crmService';
import type { SellerSubmission, SellerReviewStatus } from '../types/crm';
import { Building2, RefreshCw, Check, X, MessageSquare, Image as ImageIcon, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

function statusStyle(s: SellerReviewStatus): string {
  const m: Record<SellerReviewStatus, string> = {
    incomplete: 'bg-gray-100 text-gray-600',
    pending_review: 'bg-yellow-100 text-yellow-800',
    needs_more_information: 'bg-orange-100 text-orange-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    converted_to_listing: 'bg-blue-100 text-blue-800',
  };
  return m[s] || 'bg-gray-100 text-gray-600';
}

function formatINR(amount?: number) {
  if (!amount) return '\u2014';
  if (amount >= 10000000) return '\u20b9' + (amount / 10000000).toFixed(1) + 'Cr';
  if (amount >= 100000) return '\u20b9' + (amount / 100000).toFixed(1) + 'L';
  return '\u20b9' + amount.toLocaleString('en-IN');
}

export default function CrmSellerSubmissions() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<SellerSubmission[]>([]);
  const [selected, setSelected] = useState<SellerSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await SellerSubmissionService.getAll(100);
      setSubmissions(data);
    } catch { toast.error('Failed to load submissions'); }
    finally { setLoading(false); }
  };

  const approve = async () => {
    if (!selected || !user) return;
    setActing(true);
    try {
      await SellerSubmissionService.approve(selected.id, user.id, reviewNotes || undefined);
      const updated = { ...selected, approval_status: 'approved' as SellerReviewStatus };
      setSelected(updated);
      setSubmissions(prev => prev.map(s => s.id === selected.id ? updated : s));
      toast.success('Submission approved');
    } catch { toast.error('Failed to approve'); }
    finally { setActing(false); }
  };

  const reject = async () => {
    if (!selected || !user || !reviewNotes.trim()) {
      toast.error('Please add a reason before rejecting'); return;
    }
    setActing(true);
    try {
      await SellerSubmissionService.reject(selected.id, user.id, reviewNotes);
      const updated = { ...selected, approval_status: 'rejected' as SellerReviewStatus };
      setSelected(updated);
      setSubmissions(prev => prev.map(s => s.id === selected.id ? updated : s));
      toast.success('Submission rejected');
    } catch { toast.error('Failed to reject'); }
    finally { setActing(false); }
  };

  const requestMoreInfo = async () => {
    if (!selected || !reviewNotes.trim()) {
      toast.error('Please describe what information is needed'); return;
    }
    setActing(true);
    try {
      await SellerSubmissionService.requestMoreInfo(selected.id, reviewNotes);
      const updated = { ...selected, approval_status: 'needs_more_information' as SellerReviewStatus };
      setSelected(updated);
      setSubmissions(prev => prev.map(s => s.id === selected.id ? updated : s));
      toast.success('Marked as needs more information');
    } catch { toast.error('Failed to update'); }
    finally { setActing(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = statusFilter
    ? submissions.filter(s => s.approval_status === statusFilter)
    : submissions;

  const STATUSES = ['incomplete','pending_review','needs_more_information','approved','rejected','converted_to_listing'];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* List */}
      <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Building2 size={20} className="text-purple-600" /> Seller Submissions
              <span className="text-sm font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{filtered.length}</span>
            </h2>
            <button onClick={load} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><RefreshCw size={16} /></button>
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="w-full border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? <div className="p-8 text-center text-gray-400">Loading\u2026</div> :
            filtered.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Building2 size={40} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No submissions</p>
              </div>
            ) : filtered.map(sub => (
              <button key={sub.id}
                onClick={() => { setSelected(sub); setReviewNotes(''); }}
                className={'w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors' +
                  (selected?.id === sub.id ? ' bg-purple-50 border-l-4 border-l-purple-500' : '')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {sub.customer?.name || sub.customer?.phone_e164 || 'Unknown seller'}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {[sub.details.property_type, sub.details.location].filter(Boolean).join(' \u00b7 ')}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatINR(sub.details.asking_price)}</p>
                  </div>
                  <span className={'text-xs px-2 py-0.5 rounded-full whitespace-nowrap font-medium ' + statusStyle(sub.approval_status)}>
                    {sub.approval_status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {sub.image_paths.length > 0 && (
                    <span className="text-xs text-gray-400 flex items-center gap-0.5">
                      <ImageIcon size={10} /> {sub.image_paths.length} photo{sub.image_paths.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">{new Date(sub.created_at).toLocaleDateString()}</span>
                </div>
              </button>
            ))}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-y-auto p-6">
        {selected ? (
          <div className="max-w-2xl space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selected.customer?.name || 'Unknown Seller'}</h3>
                  <p className="text-gray-500">{selected.customer?.phone_e164}</p>
                </div>
                <span className={'text-sm px-3 py-1 rounded-full font-medium ' + statusStyle(selected.approval_status)}>
                  {selected.approval_status.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h4 className="font-semibold text-gray-900 mb-4">Property Details</h4>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['Type', selected.details.property_type],
                  ['Location', selected.details.location],
                  ['Asking Price', formatINR(selected.details.asking_price)],
                  ['Land Area', selected.details.land_area
                    ? String(selected.details.land_area) + ' ' + (selected.details.land_area_unit || 'cent')
                    : undefined],
                  ['Built-up Area', selected.details.built_up_area
                    ? String(selected.details.built_up_area) + ' sq ft'
                    : undefined],
                  ['Bedrooms', selected.details.bedrooms?.toString()],
                  ['Bathrooms', selected.details.bathrooms?.toString()],
                  ['Road Access', selected.details.road_access !== undefined
                    ? (selected.details.road_access ? 'Yes' : 'No')
                    : undefined],
                ] as [string, string | undefined][]).filter(([, v]) => v).map(([label, value]) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                    <p className="text-sm font-medium text-gray-900">{value}</p>
                  </div>
                ))}
              </div>
              {selected.details.description && (
                <div className="mt-4 p-3 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-500 mb-1">Description</p>
                  <p className="text-sm text-gray-800">{selected.details.description}</p>
                </div>
              )}
            </div>

            {selected.image_paths.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <ImageIcon size={16} /> Photos ({selected.image_paths.length})
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {selected.image_paths.map((path, i) => (
                    <a key={i} href={path} target="_blank" rel="noopener noreferrer"
                      className="aspect-square bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center hover:opacity-80 transition-opacity">
                      <img src={path} alt={'Photo ' + (i + 1)} className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {(selected.approval_status === 'pending_review' || selected.approval_status === 'incomplete') && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h4 className="font-semibold text-gray-900 mb-4">Review</h4>
                <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)}
                  placeholder="Add notes (required for rejection or more-info request)\u2026"
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4" />
                <div className="flex gap-3">
                  <button onClick={approve} disabled={acting}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
                    <Check size={16} /> Approve
                  </button>
                  <button onClick={requestMoreInfo} disabled={acting}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-orange-100 text-orange-800 rounded-xl font-medium hover:bg-orange-200 disabled:opacity-50 transition-colors">
                    <MessageSquare size={16} /> Need More Info
                  </button>
                  <button onClick={reject} disabled={acting}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-100 text-red-800 rounded-xl font-medium hover:bg-red-200 disabled:opacity-50 transition-colors">
                    <X size={16} /> Reject
                  </button>
                </div>
              </div>
            )}

            {selected.review_notes && (
              <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100">
                <p className="text-xs text-orange-600 font-medium mb-1">Review Notes</p>
                <p className="text-sm text-gray-800">{selected.review_notes}</p>
              </div>
            )}

            {selected.property_id && (
              <div className="bg-green-50 rounded-2xl p-4 border border-green-100 flex items-center gap-3">
                <Check size={20} className="text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-800">Converted to listing</p>
                  <a href={'/property/' + selected.property_id} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-green-600 hover:underline flex items-center gap-1 mt-0.5">
                    View property <ExternalLink size={10} />
                  </a>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400">
            <div className="text-center">
              <Building2 size={64} className="mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">Select a submission</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
