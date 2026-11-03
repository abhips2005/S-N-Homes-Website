import { useEffect, useState } from 'react';
import { SellerSubmissionService } from '../services/crmService';
import {
  findMatchesForSeller,
  buildShareSellerPropertyWithBuyerWhatsAppUrl,
  buildNotifySellerOfBuyerWhatsAppUrl,
  type ScoredBuyerMatch,
} from '../services/crmMatchingService';
import type { SellerSubmission, SellerReviewStatus } from '../types/crm';
import {
  Building2,
  RefreshCw,
  Check,
  X,
  MessageSquare,
  Image as ImageIcon,
  ExternalLink,
  ChevronLeft,
  Users,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import CrmBottomNav from '../components/CrmBottomNav';

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
  if (!amount) return '—';
  if (amount >= 10000000) return '₹' + (amount / 10000000).toFixed(1) + 'Cr';
  if (amount >= 100000) return '₹' + (amount / 100000).toFixed(1) + 'L';
  return '₹' + amount.toLocaleString('en-IN');
}

export default function CrmSellerSubmissions() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<SellerSubmission[]>([]);
  const [selected, setSelected] = useState<SellerSubmission | null>(null);
  const [buyerMatches, setBuyerMatches] = useState<ScoredBuyerMatch[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
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

  const selectSubmission = async (sub: SellerSubmission) => {
    setSelected(sub);
    setReviewNotes(sub.review_notes || '');
    setLoadingMatches(true);
    try {
      const bm = await findMatchesForSeller(sub);
      setBuyerMatches(bm);
    } catch {
      setBuyerMatches([]);
    } finally {
      setLoadingMatches(false);
    }
  };

  const refreshMatches = async () => {
    if (!selected) return;
    setLoadingMatches(true);
    try {
      const bm = await findMatchesForSeller(selected);
      setBuyerMatches(bm);
      toast.success(`Found ${bm.length} matching buyer leads`);
    } catch {
      toast.error('Failed to find matches');
    } finally {
      setLoadingMatches(false);
    }
  };

  const approve = async () => {
    if (!selected || !user) return;
    setActing(true);
    try {
      await SellerSubmissionService.approve(selected.id, user.id, reviewNotes || undefined);
      // Auto-publish to listings after approval
      try {
        const { property_id } = await SellerSubmissionService.publish(selected.id);
        const updated = { ...selected, approval_status: 'converted_to_listing' as SellerReviewStatus, property_id };
        setSelected(updated);
        setSubmissions(prev => prev.map(s => s.id === selected.id ? updated : s));
        toast.success('Submission approved & published to listings');
      } catch {
        // If publish fails, still mark approved
        const updated = { ...selected, approval_status: 'approved' as SellerReviewStatus };
        setSelected(updated);
        setSubmissions(prev => prev.map(s => s.id === selected.id ? updated : s));
        toast.success('Submission approved (publish to listings separately)');
      }
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

  const publish = async () => {
    if (!selected) return;
    setActing(true);
    try {
      const result = await SellerSubmissionService.publish(selected.id) as { property_id: string; url?: string };
      const updated = { ...selected, approval_status: 'converted_to_listing' as SellerReviewStatus, property_id: result.property_id };
      setSelected(updated);
      setSubmissions(prev => prev.map(s => s.id === selected.id ? updated : s));
      toast.success('Published to listings!');
    } catch (e) { toast.error('Failed to publish: ' + String(e)); }
    finally { setActing(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = statusFilter
    ? submissions.filter(s => s.approval_status === statusFilter)
    : submissions;

  const STATUSES = ['incomplete','pending_review','needs_more_information','approved','rejected','converted_to_listing'];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden pt-16 pb-16 md:pb-0">
      {/* List */}
      <div className={`w-full md:w-96 bg-white border-r border-gray-200 flex flex-col ${selected ? 'hidden md:flex' : 'flex'}`}>
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
          {loading ? <div className="p-8 text-center text-gray-400">Loading…</div> :
            filtered.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Building2 size={40} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No submissions</p>
              </div>
            ) : filtered.map(sub => (
              <button key={sub.id}
                onClick={() => selectSubmission(sub)}
                className={'w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors' +
                  (selected?.id === sub.id ? ' bg-purple-50 border-l-4 border-l-purple-500' : '')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {sub.customer?.name || sub.customer?.phone_e164 || 'Unknown seller'}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {[
                        sub.details.property_type,
                        sub.details.district,
                        sub.details.location,
                        sub.details.bedrooms ? `${sub.details.bedrooms} BHK` : sub.details.detail,
                        sub.details.land_area ? `${sub.details.land_area} ${sub.details.land_area_unit || 'Cent'}` : undefined
                      ].filter(Boolean).join(' · ')}
                    </p>
                    <p className="text-xs font-semibold text-purple-700 mt-0.5">
                      Asking: {formatINR(sub.details.asking_price)}
                    </p>
                  </div>
                  <span className={'text-xs px-2 py-0.5 rounded-full whitespace-nowrap font-medium ' + statusStyle(sub.approval_status)}>
                    {sub.approval_status.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{new Date(sub.created_at).toLocaleDateString()}</p>
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
              className="md:hidden mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg active:scale-95 transition-transform"
            >
              <ChevronLeft size={16} /> Back to submissions
            </button>
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
              <h4 className="font-semibold text-gray-900 mb-4">Property Details</h4>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['Type', selected.details.property_type],
                  ['District', selected.details.district],
                  ['Location', selected.details.location],
                  ['Bedrooms', (selected.details.bedrooms?.toString() || (selected.details.property_type === 'house' ? selected.details.detail : undefined))
                    ? `${selected.details.bedrooms || selected.details.detail} Bedrooms`
                    : undefined],
                  ['Rooms', (selected.details.rooms?.toString() || (selected.details.property_type !== 'house' && selected.details.property_type !== 'plot' ? selected.details.detail : undefined))
                    ? `${selected.details.rooms || selected.details.detail} Rooms`
                    : undefined],
                  ['Asking Price', formatINR(selected.details.asking_price)],
                  ['Land Area', selected.details.land_area
                    ? String(selected.details.land_area) + ' ' + (selected.details.land_area_unit || 'cent')
                    : (selected.details.property_type === 'plot' ? selected.details.detail : undefined)],
                  ['Built-up Area', selected.details.built_up_area
                    ? String(selected.details.built_up_area) + ' sq ft'
                    : undefined],
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
                  {((selected as any).signed_image_urls?.length ? (selected as any).signed_image_urls : selected.image_paths).map((path: string, i: number) => (
                    <a key={i} href={path} target="_blank" rel="noopener noreferrer"
                      className="aspect-square bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center hover:opacity-80 transition-opacity">
                      <img src={path} alt={'Photo ' + (i + 1)} className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Matching Buyer Leads */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Users size={16} className="text-purple-600" /> Matching Buyer Leads
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                    {buyerMatches.length} Found
                  </span>
                </h4>
                <button
                  onClick={refreshMatches}
                  disabled={loadingMatches}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                >
                  <RefreshCw size={12} className={loadingMatches ? 'animate-spin' : ''} /> Refresh
                </button>
              </div>

              {loadingMatches ? (
                <div className="py-8 text-center text-gray-400 text-sm">
                  <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-purple-500 opacity-60" />
                  Finding matching buyers...
                </div>
              ) : buyerMatches.length === 0 ? (
                <div className="py-6 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <p className="text-sm font-medium text-gray-600">No buyer requests currently match this property</p>
                  <p className="text-xs text-gray-400 mt-1">Buyers looking for this type, district, or price range will appear here automatically.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {buyerMatches.map(m => {
                    const waShareBuyerUrl = m.buyer_phone
                      ? buildShareSellerPropertyWithBuyerWhatsAppUrl(m.buyer_phone, m.buyer_name, selected)
                      : '';
                    const waNotifySellerUrl = selected.customer?.phone_e164
                      ? buildNotifySellerOfBuyerWhatsAppUrl(
                          selected.customer.phone_e164,
                          selected.customer.name,
                          m,
                          selected,
                        )
                      : '';
                    const isHigh = m.match_score >= 80;
                    const isMed = m.match_score >= 65;

                    return (
                      <div key={m.buyer_request_id} className="p-4 bg-gray-50 hover:bg-gray-100/80 rounded-xl border border-gray-200 transition-all">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h5 className="font-semibold text-sm text-gray-900">{m.buyer_name}</h5>
                              {m.buyer_phone && <span className="text-xs text-gray-500">({m.buyer_phone})</span>}
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                                isHigh ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                isMed ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}>
                                <Sparkles size={11} /> {m.match_score}% Match
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-600 mt-1 flex-wrap">
                              <span className="font-semibold text-purple-700">Budget: {m.budget_label || formatINR(m.budget_max)}</span>
                              <span>·</span>
                              <span>Looking for: {m.property_type || 'Property'} in {m.district || 'Kerala'}</span>
                              {m.bedrooms_min && <span>· 🛏️ {m.bedrooms_min}+ BHK</span>}
                              {m.land_area && <span>· 📐 {m.land_area}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Reason tags */}
                        {m.match_reasons.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-3 mt-2">
                            {m.match_reasons.map((r, i) => (
                              <span key={i} className="text-[11px] bg-white border border-gray-200 px-2 py-0.5 rounded-md text-gray-600">
                                ✓ {r}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* WhatsApp Action Buttons */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-200 flex-wrap">
                          {m.buyer_phone ? (
                            <a
                              href={waShareBuyerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm active:scale-95 transition-all"
                              title="Send this property details directly to the buyer on WhatsApp"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                              </svg>
                              Share with Buyer
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400">Buyer has no phone</span>
                          )}

                          {selected.customer?.phone_e164 && (
                            <a
                              href={waNotifySellerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-medium transition-colors"
                              title="Notify seller about this matching buyer"
                            >
                              Notify Seller
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {(selected.approval_status === 'pending_review' || selected.approval_status === 'incomplete') && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h4 className="font-semibold text-gray-900 mb-4">Review</h4>
                <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)}
                  placeholder="Add notes (required for rejection or more-info request)…"
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4" />
                <div className="flex gap-3">
                  <button onClick={approve} disabled={acting}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
                    <Check size={16} /> Approve & Publish
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

            {/* Publish button for already-approved but not yet published submissions */}
            {selected.approval_status === 'approved' && !selected.property_id && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h4 className="font-semibold text-gray-900 mb-3">Publish to Listings</h4>
                <p className="text-sm text-gray-500 mb-4">This submission is approved. Publish it to make it visible in the property listings.</p>
                <button onClick={publish} disabled={acting}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  <ExternalLink size={16} /> Publish to Listings
                </button>
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
      <CrmBottomNav />
    </div>
  );
}
