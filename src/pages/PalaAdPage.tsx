import { useEffect } from 'react';
import {
  Phone,
  MapPin,
  Home,
  Compass,
  Building,
  ShieldCheck,
  Users,
  Zap,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

const WHATSAPP_NUMBER = '919605807960';
const DISPLAY_PHONE = '9605807960';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=Hi`;
const CALL_URL = `tel:+91${DISPLAY_PHONE}`;

export default function PalaAdPage() {
  useEffect(() => {
    document.title = 'S N Homes Pala | പ്രോപ്പർട്ടി വാങ്ങാനും വിൽക്കാനും ഇനി ഒരു Hi മതി!';

    // Set meta description
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute(
      'content',
      'പാലായിൽ വീട്, സ്ഥലം, അപ്പാർട്ട്മെന്റ് വാങ്ങാനും വിൽക്കാനും S N Homes. 9605807960 എന്ന നമ്പറിലേക്ക് WhatsApp-ൽ Hi അയക്കൂ.'
    );

    // Scroll to top on load
    window.scrollTo(0, 0);
  }, []);

  const handleWhatsAppClick = (source: string) => {
    // Track Google Ads conversion if gtag is loaded on page
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'conversion', {
        send_to: 'google_ads_conversion',
        event_category: 'lead',
        event_label: `whatsapp_${source}`,
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-amber-50/30 text-gray-900 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* ─── Top Brand Header ─── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
              <Home size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-black tracking-tight text-gray-900 leading-none">S N Homes</span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full border border-red-200">
                  പാലാ
                </span>
              </div>
              <p className="text-[10px] uppercase font-bold tracking-widest text-amber-600 mt-0.5">BUY · SELL · INVEST</p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2">
            <a
              href={CALL_URL}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Phone size={14} className="text-red-600" />
              <span>{DISPLAY_PHONE}</span>
            </a>

            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleWhatsAppClick('header')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/25 active:scale-95 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
              </svg>
              <span>WhatsApp</span>
            </a>
          </div>
        </div>
      </header>

      {/* ─── Hero Section ─── */}
      <section className="relative px-4 pt-6 pb-8 md:pt-10 md:pb-12 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Headlines & Primary Call To Action */}
          <div className="lg:col-span-7 space-y-5 text-center lg:text-left">
            {/* Location Tag */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm font-bold shadow-sm">
              <MapPin size={14} className="text-red-600 fill-red-100" />
              <span>പാലാ & കോട്ടയം പ്രോപ്പർട്ടി സർവീസ്</span>
            </div>

            {/* Main Title (Mirrors the Ad Banner) */}
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-gray-900 tracking-tight leading-tight">
                പ്രോപ്പർട്ടി വാങ്ങാനും വിൽക്കാനും
              </h1>
              <div className="inline-block relative">
                <div className="bg-gradient-to-r from-yellow-300 via-yellow-400 to-amber-300 text-emerald-950 font-black text-2xl sm:text-4xl md:text-5xl px-4 py-1.5 rounded-2xl shadow-lg border-2 border-yellow-200 transform -rotate-1 inline-block">
                  ഇനി ഒരു <span className="text-emerald-700 underline decoration-red-500 decoration-4">"Hi"</span> മതി!
                </div>
              </div>
            </div>

            <p className="text-sm sm:text-base text-gray-600 max-w-xl mx-auto lg:mx-0 leading-relaxed font-medium">
              പാലായിലും പരിസരപ്രദേശങ്ങളിലും വീട്, സ്ഥലം, കൊമേഴ്സ്യൽ പ്രോപ്പർട്ടികൾ ഏറ്റവും മികച്ച വിലയിൽ കണ്ടെത്താനും വിൽക്കാനും ഇന്നുതന്നെ S N Homes-മായി WhatsApp-ൽ ബന്ധപ്പെടൂ.
            </p>

            {/* ─── PRIMARY WHATSAPP CTA BUTTON ─── */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start items-center">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleWhatsAppClick('hero_main')}
                className="w-full sm:w-auto group relative inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-black text-lg sm:text-xl shadow-xl shadow-emerald-500/35 hover:shadow-2xl hover:shadow-emerald-500/45 transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all duration-200"
              >
                <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                  </svg>
                </span>
                <span className="flex flex-col text-left">
                  <span>WhatsApp-ൽ "Hi" അയക്കൂ!</span>
                  <span className="text-xs text-emerald-100 font-normal">തത്സമയം ചാറ്റ് ചെയ്യാം • 9605807960</span>
                </span>
              </a>

              {/* Secondary Direct Call Button */}
              <a
                href={CALL_URL}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold text-base shadow-lg shadow-red-500/25 active:scale-95 transition-all"
              >
                <Phone size={20} className="animate-bounce" />
                <span>{DISPLAY_PHONE}</span>
              </a>
            </div>

            {/* Quick Micro-Trust */}
            <div className="flex items-center justify-center lg:justify-start gap-4 text-xs font-semibold text-gray-500 pt-1">
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <CheckCircle2 size={14} /> 100% സൗജന്യ അന്വേഷണം
              </span>
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <CheckCircle2 size={14} /> വേഗത്തിലുള്ള മറുപടി
              </span>
            </div>
          </div>

          {/* Right Column: High-Impact Visual Ad Banner */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative group w-full max-w-sm lg:max-w-none">
              <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-amber-500 rounded-3xl blur-lg opacity-30 group-hover:opacity-50 transition duration-300"></div>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleWhatsAppClick('banner_image')}
                className="block relative overflow-hidden rounded-2xl bg-white shadow-2xl border-4 border-white cursor-pointer hover:scale-[1.01] transition-transform duration-200"
                title="Click to Chat on WhatsApp"
              >
                <img
                  src="/ads/pala-ad-square.jpg"
                  alt="S N Homes Pala Property Ads"
                  className="w-full h-auto object-cover rounded-xl"
                  loading="eager"
                />
                <div className="absolute bottom-3 left-3 right-3 bg-emerald-900/90 backdrop-blur-md text-white px-3 py-2 rounded-xl text-center shadow-lg border border-emerald-500/30">
                  <p className="text-xs font-bold flex items-center justify-center gap-1.5">
                    <Sparkles size={14} className="text-yellow-400" />
                    ഇവിടെ ക്ലിക്ക് ചെയ്ത് WhatsApp-ൽ സംസാരിക്കൂ
                  </p>
                </div>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 3 Main Property Categories (From Ad Graphics) ─── */}
      <section className="px-4 py-8 bg-white border-y border-gray-100">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900">
              ഏതുതരം പ്രോപ്പർട്ടിയാണ് നിങ്ങൾ നോക്കുന്നത്?
            </h2>
            <p className="text-sm text-gray-500 mt-1">നിങ്ങളുടെ ആവശ്യത്തിനനുസരിച്ച് നേരിട്ട് തിരഞ്ഞെടുക്കാം</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. വീട് (House) */}
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleWhatsAppClick('category_house')}
              className="group p-5 rounded-2xl bg-gradient-to-b from-amber-50/60 to-white border border-amber-200/80 hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-200 flex flex-col items-center text-center cursor-pointer"
            >
              <div className="w-16 h-16 rounded-2xl bg-amber-100/80 text-amber-800 flex items-center justify-center mb-3 shadow-inner group-hover:scale-110 transition-transform">
                <Home size={32} className="stroke-[2.2]" />
              </div>
              <h3 className="text-lg font-black text-gray-900">വീട് / വില്ലകൾ</h3>
              <p className="text-xs text-gray-500 mt-1 mb-4 leading-relaxed">
                പാലായിലും സമീപപ്രദേശങ്ങളിലും ബജറ്റ് വീടുകൾ, മോഡേൺ വില്ലകൾ, പരമ്പരാഗത വീടുകൾ
              </p>
              <span className="mt-auto inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                വിവരങ്ങൾക്ക് WhatsApp ചെയ്യൂ <ArrowRight size={13} />
              </span>
            </a>

            {/* 2. സ്ഥലം (Land / Plot) */}
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleWhatsAppClick('category_plot')}
              className="group p-5 rounded-2xl bg-gradient-to-b from-emerald-50/60 to-white border border-emerald-200/80 hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-200 flex flex-col items-center text-center cursor-pointer"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center mb-3 shadow-inner group-hover:scale-110 transition-transform">
                <Compass size={32} className="stroke-[2.2]" />
              </div>
              <h3 className="text-lg font-black text-gray-900">സ്ഥലം / പ്ലോട്ടുകൾ</h3>
              <p className="text-xs text-gray-500 mt-1 mb-4 leading-relaxed">
                റെസിഡൻഷ്യൽ പ്ലോട്ടുകൾ, റോഡ് ഫ്രണ്ടേജ് ലാൻഡ്, കൃഷിഭൂമി, വാണിജ്യ പ്ലോട്ടുകൾ
              </p>
              <span className="mt-auto inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                വിവരങ്ങൾക്ക് WhatsApp ചെയ്യൂ <ArrowRight size={13} />
              </span>
            </a>

            {/* 3. അപ്പാർട്ട്മെന്റ് / കൊമേഴ്സ്യൽ */}
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleWhatsAppClick('category_apartment')}
              className="group p-5 rounded-2xl bg-gradient-to-b from-sky-50/60 to-white border border-sky-200/80 hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-200 flex flex-col items-center text-center cursor-pointer"
            >
              <div className="w-16 h-16 rounded-2xl bg-sky-100/80 text-sky-800 flex items-center justify-center mb-3 shadow-inner group-hover:scale-110 transition-transform">
                <Building size={32} className="stroke-[2.2]" />
              </div>
              <h3 className="text-lg font-black text-gray-900">ഫ്ലാറ്റ് / കൊമേഴ്സ്യൽ</h3>
              <p className="text-xs text-gray-500 mt-1 mb-4 leading-relaxed">
                പാലാ ടൗൺ കേന്ദ്രീകരിച്ചുള്ള അപ്പാർട്ട്മെന്റുകൾ, ഷോപ്പുകൾ, ഓഫീസ് സ്പേസുകൾ
              </p>
              <span className="mt-auto inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                വിവരങ്ങൾക്ക് WhatsApp ചെയ്യൂ <ArrowRight size={13} />
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* ─── 4 Pillars of Trust (Matches bottom badges of Ad flyer) ─── */}
      <section className="px-4 py-10 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Badge 1 */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center mb-2.5">
              <ShieldCheck size={24} />
            </div>
            <h4 className="text-sm font-bold text-gray-900">വിശ്വസനീയ സേവനം</h4>
            <p className="text-[11px] text-gray-500 mt-0.5">100% സുതാര്യമായ ഇടപാടുകൾ</p>
          </div>

          {/* Badge 2 */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2.5">
              <Users size={24} />
            </div>
            <h4 className="text-sm font-bold text-gray-900">പ്രൊഫഷണൽ സഹായം</h4>
            <p className="text-[11px] text-gray-500 mt-0.5">അനുയോജ്യമായ പ്രോപ്പർട്ടി സെലക്ഷൻ</p>
          </div>

          {/* Badge 3 */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2.5">
              <Zap size={24} />
            </div>
            <h4 className="text-sm font-bold text-gray-900">വേഗത്തിലുള്ള സാക്ഷ്യത്തിലും</h4>
            <p className="text-[11px] text-gray-500 mt-0.5">തടസ്സമില്ലാത്ത ഡീലുകൾ</p>
          </div>

          {/* Badge 4 */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-2.5">
              <MapPin size={24} />
            </div>
            <h4 className="text-sm font-bold text-gray-900">പാലാ & കോട്ടയം മേഖല</h4>
            <p className="text-[11px] text-gray-500 mt-0.5">പ്രാദേശിക മാർക്കറ്റ് പരിചയം</p>
          </div>
        </div>
      </section>

      {/* ─── Key Localities in Pala ─── */}
      <section className="px-4 py-8 bg-gray-50 border-t border-gray-200/60">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs uppercase font-bold tracking-widest text-gray-400 mb-2">LOCAL COVERAGE</p>
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">
            പാലായിലും പരിസരത്തുമുള്ള പ്രധാന മേഖലകൾ
          </h3>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              'പാലാ ടൗൺ (Pala Town)',
              'ഭരണങ്ങാനം (Bharananganam)',
              'രാമപുരം (Ramapuram)',
              'മുത്തോലി (Mutholy)',
              'കടനാട് (Kadanad)',
              'കിടങ്ങൂർ (Kidangoor)',
              'കൊഴുവനാൽ (Kozhuvanal)',
              'പുലിയന്നൂർ (Puliyannoor)',
              'ളാലം (Lalam)',
              'മീനച്ചിൽ (Meenachil)',
              'പൂവരണി (Poovarany)',
            ].map((loc, idx) => (
              <span
                key={idx}
                className="bg-white border border-gray-200 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-full shadow-2xs"
              >
                📍 {loc}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works (3 Easy Steps) ─── */}
      <section className="px-4 py-12 max-w-4xl mx-auto w-full text-center">
        <h3 className="text-xl sm:text-2xl font-black text-gray-900 mb-2">
          എങ്ങനെ തുടങ്ങാം? വളരെ എളുപ്പമാണ്!
        </h3>
        <p className="text-sm text-gray-500 mb-8">നിങ്ങളുടെ പ്രോപ്പർട്ടി ആവശ്യങ്ങൾ നിമിഷങ്ങൾക്കകം പങ്കുവെക്കാം</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative">
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center mx-auto mb-3 text-lg">
              1
            </div>
            <h4 className="font-bold text-base text-gray-900">WhatsApp-ൽ "Hi" അയക്കൂ</h4>
            <p className="text-xs text-gray-500 mt-1">
              9605807960 എന്ന നമ്പറിലേക്ക് ഒരു "Hi" അയക്കുക.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative">
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center mx-auto mb-3 text-lg">
              2
            </div>
            <h4 className="font-bold text-base text-gray-900">ആവശ്യങ്ങൾ തിരഞ്ഞെടുക്കൂ</h4>
            <p className="text-xs text-gray-500 mt-1">
              വാങ്ങാനാണോ വിൽക്കാനാണോ, വീടാണോ സ്ഥലമാണോ എന്ന് വ്യക്തമാക്കൂ.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative">
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center mx-auto mb-3 text-lg">
              3
            </div>
            <h4 className="font-bold text-base text-gray-900">നേരിട്ടുള്ള സഹായം</h4>
            <p className="text-xs text-gray-500 mt-1">
              ഞങ്ങളുടെ എക്സ്പെർട്ട് ടീം നിങ്ങളെ ഉടൻ ബന്ധപ്പെട്ട് മികച്ച ഡീലുകൾ നൽകുന്നു.
            </p>
          </div>
        </div>

        {/* Big Final Call to Action */}
        <div className="mt-10 p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10 max-w-xl mx-auto space-y-4">
            <h3 className="text-xl sm:text-3xl font-black">
              ഇന്ന് തന്നെ നിങ്ങളുടെ പ്രോപ്പർട്ടി കണ്ടെത്തൂ!
            </h3>
            <p className="text-emerald-100 text-xs sm:text-sm">
              S N Homes വഴി പാലായിൽ പ്രോപ്പർട്ടികൾ സുരക്ഷിതമായി സ്വന്തമാക്കൂ അല്ലെങ്കിൽ വേഗത്തിൽ വിൽക്കൂ.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center items-center">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleWhatsAppClick('footer_cta')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl bg-white text-emerald-800 font-black text-base shadow-lg hover:bg-yellow-300 transition-colors"
              >
                <span>WhatsApp-ൽ "Hi" അയക്കൂ</span>
                <ArrowRight size={18} />
              </a>
              <a
                href={CALL_URL}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-800/80 hover:bg-emerald-900 text-white font-bold text-sm border border-emerald-400/30 transition-colors"
              >
                <Phone size={16} />
                <span>വിളിക്കൂ: {DISPLAY_PHONE}</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Google Ads Policy Footer ─── */}
      <footer className="mt-auto border-t border-gray-200 bg-white py-8 px-4 text-center text-xs text-gray-500">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="flex items-center justify-center gap-2 font-bold text-gray-800">
            <span>S N Homes</span>
            <span>·</span>
            <span>Pala & Kottayam, Kerala</span>
            <span>·</span>
            <a href={CALL_URL} className="text-emerald-700 hover:underline">
              {DISPLAY_PHONE}
            </a>
          </div>

          <p className="text-gray-400 text-[11px] max-w-2xl mx-auto">
            നിരാകരണം: S N Homes ഒരു അംഗീകൃത റിയൽ എസ്റ്റേറ്റ് കൺസൾട്ടൻസി സ്ഥാപനമാണ്. എല്ലാ പ്രോപ്പർട്ടി വിവരങ്ങളും ഡോക്യുമെന്റുകളും കൃത്യത ഉറപ്പുവരുത്തിയതിന് ശേഷം മാത്രമേ പങ്കുവെക്കപ്പെടുകയുള്ളൂ.
          </p>

          <div className="flex items-center justify-center gap-4 text-gray-500 text-[11px] pt-1">
            <a href="https://snhomes.in" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-700 underline">
              Home Website
            </a>
            <span>·</span>
            <a href="https://snhomes.in/about" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-700 underline">
              About Us
            </a>
            <span>·</span>
            <a href="https://snhomes.in/contact" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-700 underline">
              Contact
            </a>
          </div>

          <p className="text-gray-400 text-[10px] pt-2">
            © {new Date().getFullYear()} S N Homes. All rights reserved.
          </p>
        </div>
      </footer>

      {/* ─── Sticky Mobile Action Bar (Google Ads Optimization) ─── */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-200 p-2.5 px-3 flex items-center gap-2 shadow-2xl">
        <a
          href={CALL_URL}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-3 rounded-xl bg-red-600 active:bg-red-700 text-white font-bold text-sm shadow-md"
        >
          <Phone size={16} />
          <span>വിളിക്കൂ</span>
        </a>

        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => handleWhatsAppClick('sticky_mobile')}
          className="flex-[2] inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 active:bg-emerald-700 text-white font-black text-sm shadow-md shadow-emerald-600/30 animate-pulse"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
          </svg>
          <span>WhatsApp-ൽ "Hi"</span>
        </a>
      </div>
    </div>
  );
}

