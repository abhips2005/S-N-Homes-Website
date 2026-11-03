import { supabase } from '../supabase-config';
import type { BuyerRequest, SellerSubmission } from '../types/crm';

export interface ScoredPropertyMatch {
  property_id: string;
  title: string;
  price?: number;
  property_type?: string;
  district?: string;
  location?: string;
  bedrooms?: number;
  land_area?: number | string;
  land_area_unit?: string;
  images?: string[];
  match_score: number; // 0 - 100
  match_reasons: string[];
  property_url: string;
}

export interface ScoredBuyerMatch {
  buyer_request_id: string;
  buyer_name?: string;
  buyer_phone?: string;
  customer_id?: string;
  budget_max?: number;
  budget_label?: string;
  property_type?: string;
  district?: string;
  location?: string;
  bedrooms_min?: number;
  land_area?: number | string;
  match_score: number; // 0 - 100
  match_reasons: string[];
}

function normalizeStr(s?: string | null): string {
  return (s || '').trim().toLowerCase();
}

function formatINR(v?: number): string {
  if (!v) return '—';
  if (v >= 10000000) return '₹' + (v / 10000000).toFixed(2) + ' Cr';
  if (v >= 100000) return '₹' + (v / 100000).toFixed(2) + ' L';
  return '₹' + v.toLocaleString('en-IN');
}

// ─── Find Matched Properties for a Buyer Lead ─────────────────────────────────

export async function findMatchesForBuyer(buyerReq: BuyerRequest): Promise<ScoredPropertyMatch[]> {
  const reqs = buyerReq.requirements || {};
  const reqType = normalizeStr(reqs.property_type);
  const reqDistrict = normalizeStr(reqs.district);
  const reqLocation = normalizeStr(reqs.location);
  const budgetMax = reqs.budget_max ? Number(reqs.budget_max) : null;
  const bedroomsMin = reqs.bedrooms_min ? Number(reqs.bedrooms_min) : null;

  // Query active/available properties
  const { data: props, error } = await supabase
    .from('properties')
    .select('id, title, property_type, district, location, price, bedrooms, bathrooms, land_area, land_area_unit, area, images, status')
    .in('status', ['active', 'available', 'pending'])
    .limit(100);

  if (error || !props) return [];

  const baseUrl = (typeof window !== 'undefined' ? window.location.origin : 'https://snhomes.in');
  const matches: ScoredPropertyMatch[] = [];

  for (const p of props) {
    let score = 0;
    const reasons: string[] = [];

    const pType = normalizeStr(p.property_type);
    const pDistrict = normalizeStr(p.district);
    const pLocation = normalizeStr(p.location);
    const pPrice = p.price ? Number(p.price) : 0;
    const pBedrooms = p.bedrooms ? Number(p.bedrooms) : 0;

    // 1. Property Type match (35 pts)
    if (reqType && pType) {
      if (reqType === pType) {
        score += 35;
        reasons.push(`Type: ${p.property_type}`);
      } else if (
        ['house', 'villa', 'home'].includes(reqType) && ['house', 'villa', 'home'].includes(pType)
      ) {
        score += 30;
        reasons.push(`Compatible Type (${p.property_type})`);
      } else {
        // Incompatible property type
        continue;
      }
    } else {
      score += 20; // Type not specified
    }

    // 2. District & Location match (35 pts)
    if (reqDistrict && pDistrict) {
      if (reqDistrict === pDistrict) {
        score += 25;
        reasons.push(`District: ${p.district}`);
      } else {
        // District mismatch is a heavy barrier
        score -= 15;
      }
    } else {
      score += 15;
    }

    if (reqLocation && pLocation) {
      if (pLocation.includes(reqLocation) || reqLocation.includes(pLocation)) {
        score += 10;
        reasons.push(`Location: ${p.location}`);
      }
    }

    // 3. Budget match (20 pts)
    if (budgetMax && pPrice > 0) {
      if (pPrice <= budgetMax) {
        const ratio = pPrice / budgetMax;
        if (ratio >= 0.6) {
          score += 20;
          reasons.push(`Budget match (${formatINR(pPrice)})`);
        } else {
          score += 16;
          reasons.push(`Well under budget (${formatINR(pPrice)})`);
        }
      } else if (pPrice <= budgetMax * 1.15) {
        score += 10;
        reasons.push(`Slightly above budget (${formatINR(pPrice)})`);
      } else {
        score -= 10;
      }
    } else {
      score += 10;
    }

    // 4. Specifications match (10 pts)
    if (bedroomsMin && pBedrooms > 0) {
      if (pBedrooms >= bedroomsMin) {
        score += 10;
        reasons.push(`${pBedrooms} Bedrooms`);
      } else if (pBedrooms === bedroomsMin - 1) {
        score += 5;
        reasons.push(`${pBedrooms} Bedrooms (close)`);
      }
    } else if (reqs.land_area && p.land_area) {
      score += 10;
      reasons.push(`${p.land_area} ${p.land_area_unit || 'Cent'}`);
    } else {
      score += 5;
    }

    const finalScore = Math.min(100, Math.max(0, Math.round(score)));

    // Only include matches that reach at least 50%
    if (finalScore >= 50) {
      matches.push({
        property_id: p.id,
        title: p.title || 'Property Listing',
        price: p.price,
        property_type: p.property_type,
        district: p.district,
        location: p.location,
        bedrooms: p.bedrooms,
        land_area: p.land_area,
        land_area_unit: p.land_area_unit,
        images: Array.isArray(p.images) ? p.images : [],
        match_score: finalScore,
        match_reasons: reasons,
        property_url: `${baseUrl}/property/${p.id}`,
      });
    }
  }

  // Sort descending by match score
  matches.sort((a, b) => b.match_score - a.match_score);
  return matches;
}

// ─── Find Matched Buyers for a Seller Lead ────────────────────────────────────

export async function findMatchesForSeller(sellerSub: SellerSubmission): Promise<ScoredBuyerMatch[]> {
  const d = sellerSub.details || {};
  const sellerType = normalizeStr(d.property_type);
  const sellerDistrict = normalizeStr(d.district);
  const sellerLocation = normalizeStr(d.location);
  const askingPrice = d.asking_price ? Number(d.asking_price) : 0;
  const sellerBedrooms = d.bedrooms ? Number(d.bedrooms) : 0;

  // Query active buyer requests with customer details
  const { data: buyers, error } = await supabase
    .from('crm_buyer_requests')
    .select(`
      id,
      customer_id,
      status,
      requirements,
      customer:crm_customers(id, name, phone_e164)
    `)
    .not('status', 'in', '("fulfilled","cancelled","lost")')
    .limit(100);

  if (error || !buyers) return [];

  const matches: ScoredBuyerMatch[] = [];

  for (const b of buyers) {
    const reqs = (b.requirements || {}) as Record<string, unknown>;
    const bType = normalizeStr(reqs.property_type as string);
    const bDistrict = normalizeStr(reqs.district as string);
    const bLocation = normalizeStr(reqs.location as string);
    const budgetMax = reqs.budget_max ? Number(reqs.budget_max) : null;
    const bedroomsMin = reqs.bedrooms_min ? Number(reqs.bedrooms_min) : null;

    let score = 0;
    const reasons: string[] = [];

    // 1. Property Type match (35 pts)
    if (sellerType && bType) {
      if (sellerType === bType) {
        score += 35;
        reasons.push(`Looking for ${bType}`);
      } else if (
        ['house', 'villa', 'home'].includes(sellerType) && ['house', 'villa', 'home'].includes(bType)
      ) {
        score += 30;
        reasons.push(`Looking for ${bType}`);
      } else {
        continue; // Incompatible
      }
    } else {
      score += 20;
    }

    // 2. District & Location match (35 pts)
    if (sellerDistrict && bDistrict) {
      if (sellerDistrict === bDistrict) {
        score += 25;
        reasons.push(`District: ${reqs.district}`);
      } else {
        score -= 15;
      }
    } else {
      score += 15;
    }

    if (sellerLocation && bLocation) {
      if (sellerLocation.includes(bLocation) || bLocation.includes(sellerLocation)) {
        score += 10;
        reasons.push(`Location: ${reqs.location}`);
      }
    }

    // 3. Budget vs Asking Price match (20 pts)
    if (budgetMax && askingPrice > 0) {
      if (budgetMax >= askingPrice) {
        score += 20;
        reasons.push(`Budget (${formatINR(budgetMax)}) covers asking price`);
      } else if (budgetMax >= askingPrice * 0.88) {
        score += 12;
        reasons.push(`Budget (${formatINR(budgetMax)}) close to asking`);
      } else {
        score -= 10;
      }
    } else {
      score += 10;
    }

    // 4. Bedrooms / land area match (10 pts)
    if (bedroomsMin && sellerBedrooms > 0) {
      if (sellerBedrooms >= bedroomsMin) {
        score += 10;
        reasons.push(`Has ${sellerBedrooms} Bedrooms (wants ${bedroomsMin}+)`);
      }
    } else {
      score += 5;
    }

    const finalScore = Math.min(100, Math.max(0, Math.round(score)));

    if (finalScore >= 50) {
      const cust = b.customer as { name?: string; phone_e164?: string } | undefined;
      matches.push({
        buyer_request_id: b.id,
        buyer_name: cust?.name || 'Interested Buyer',
        buyer_phone: cust?.phone_e164,
        customer_id: b.customer_id,
        budget_max: budgetMax || undefined,
        budget_label: (reqs.budget_label as string) || (budgetMax ? formatINR(budgetMax) : undefined),
        property_type: reqs.property_type as string,
        district: reqs.district as string,
        location: reqs.location as string,
        bedrooms_min: bedroomsMin || undefined,
        land_area: (reqs.land_area as string | number) || undefined,
        match_score: finalScore,
        match_reasons: reasons,
      });
    }
  }

  matches.sort((a, b) => b.match_score - a.match_score);
  return matches;
}

// ─── Direct WhatsApp Redirect URLs (No API used) ──────────────────────────────

export function cleanPhoneForWhatsApp(phone?: string): string {
  if (!phone) return '';
  return phone.replace(/[^0-9]/g, '');
}

/**
 * Builds direct WhatsApp URL to send a matched property to a buyer
 */
export function buildSendPropertyToBuyerWhatsAppUrl(
  buyerPhone: string,
  buyerName: string | undefined,
  property: ScoredPropertyMatch,
): string {
  const cleanPhone = cleanPhoneForWhatsApp(buyerPhone);
  const name = buyerName ? buyerName.trim() : 'Customer';
  const priceText = property.price ? formatINR(property.price) : 'Contact for price';
  const specs = [
    property.bedrooms ? `🛏️ ${property.bedrooms} Bedrooms` : '',
    property.land_area ? `📐 ${property.land_area} ${property.land_area_unit || 'Cent'}` : '',
  ].filter(Boolean).join(' | ');

  const text =
    `Hi ${name},\n\n` +
    `We found a property matching your requirement in S N Homes! 🏡\n\n` +
    `*${property.title}*\n` +
    `📍 Location: ${property.location ? property.location + ', ' : ''}${property.district || 'Kerala'}\n` +
    `💰 Price: ${priceText}\n` +
    (specs ? `${specs}\n` : '') +
    `Please let us know if you would like to arrange a site visit or have any questions! 🙏`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}

/**
 * Builds direct WhatsApp URL to share a seller's property with a matching buyer
 */
export function buildShareSellerPropertyWithBuyerWhatsAppUrl(
  buyerPhone: string,
  buyerName: string | undefined,
  sellerSub: SellerSubmission,
): string {
  const cleanPhone = cleanPhoneForWhatsApp(buyerPhone);
  const name = buyerName ? buyerName.trim() : 'Customer';
  const d = sellerSub.details || {};
  const priceText = d.asking_price ? formatINR(d.asking_price) : 'Contact for price';
  const typeText = d.property_type ? d.property_type.charAt(0).toUpperCase() + d.property_type.slice(1) : 'Property';
  const specs = [
    d.bedrooms ? `🛏️ ${d.bedrooms} Bedrooms` : '',
    d.land_area ? `📐 ${d.land_area} ${d.land_area_unit || 'Cent'}` : '',
  ].filter(Boolean).join(' | ');

  const text =
    `Hi ${name},\n\n` +
    `A new property matching your requirement is now available on S N Homes! 🏡\n\n` +
    `*${typeText} in ${d.location || d.district || 'Kerala'}*\n` +
    `📍 Location: ${d.location ? d.location + ', ' : ''}${d.district || 'Kerala'}\n` +
    `💰 Asking Price: ${priceText}\n` +
    (specs ? `${specs}\n` : '') +
    (d.description ? `📝 Details: ${d.description}\n\n` : '\n') +
    `Would you be interested in viewing this property? Please let us know! 🙏`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}

/**
 * Builds direct WhatsApp URL to notify a seller that an interested buyer has been found
 */
export function buildNotifySellerOfBuyerWhatsAppUrl(
  sellerPhone: string,
  sellerName: string | undefined,
  buyer: ScoredBuyerMatch,
  sellerSub: SellerSubmission,
): string {
  const cleanPhone = cleanPhoneForWhatsApp(sellerPhone);
  const name = sellerName ? sellerName.trim() : 'Sir/Madam';
  const d = sellerSub.details || {};
  const bBudget = buyer.budget_label || (buyer.budget_max ? formatINR(buyer.budget_max) : 'specified budget');

  const text =
    `Hi ${name},\n\n` +
    `Great news from S N Homes! 🏡\n\n` +
    `We have an interested buyer matching your property in ${d.location || d.district || 'Kerala'}.\n` +
    `👤 Buyer requirement: Looking for ${buyer.property_type || d.property_type || 'property'} with budget ${bBudget}.\n\n` +
    `Our team is coordinating the details and will contact you shortly to schedule a visit. Thank you! 🙏`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}
