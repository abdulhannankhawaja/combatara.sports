import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Calculator, Loader2, Plane, Ship, Sparkles } from 'lucide-react';
import { EXPORT_PRODUCTS } from '../data/sialkotCatalog.ts';
import { ProductCategoryId } from '../types/exportHub.ts';

type FreightMode = 'air-express' | 'air-cargo' | 'sea-lcl';

interface DestinationProfile {
  country: string;
  regionLabel: string;
  airExpressPerKg: number;
  airCargoPerKg: number;
  seaLclPerKg: number;
  vatRate: number;
  dutyByCategory: Record<string, number>;
  preferenceNote: string;
}

const DESTINATION_PROFILES: DestinationProfile[] = [
  {
    country: 'Germany',
    regionLabel: 'Germany (EU · GSP+)',
    airExpressPerKg: 7.4,
    airCargoPerKg: 4.15,
    seaLclPerKg: 0.72,
    vatRate: 0.19,
    dutyByCategory: {
      'karate-suits': 0,
      footballs: 0,
      hockeys: 0,
      hotballs: 0,
      'apparels-leather': 0,
    },
    preferenceNote: 'Pakistan EU GSP+ (REX registered): 0% preferential customs duty on eligible Sialkot textiles, leather & sports goods.',
  },
  {
    country: 'United Kingdom',
    regionLabel: 'United Kingdom (DCTS)',
    airExpressPerKg: 7.6,
    airCargoPerKg: 4.25,
    seaLclPerKg: 0.75,
    vatRate: 0.2,
    dutyByCategory: {
      'karate-suits': 0,
      footballs: 0,
      hockeys: 0,
      hotballs: 0,
      'apparels-leather': 0,
    },
    preferenceNote: 'UK Developing Countries Trading Scheme (DCTS): 0% preferential duty for verified Pakistan-origin goods.',
  },
  {
    country: 'Netherlands',
    regionLabel: 'Netherlands / Rotterdam (EU · GSP+)',
    airExpressPerKg: 7.35,
    airCargoPerKg: 4.1,
    seaLclPerKg: 0.68,
    vatRate: 0.21,
    dutyByCategory: {
      'karate-suits': 0,
      footballs: 0,
      hockeys: 0,
      hotballs: 0,
      'apparels-leather': 0,
    },
    preferenceNote: 'EU GSP+ REX statement grants 0% tariff entry via Schiphol or Port of Rotterdam.',
  },
  {
    country: 'France',
    regionLabel: 'France (EU · GSP+)',
    airExpressPerKg: 7.55,
    airCargoPerKg: 4.2,
    seaLclPerKg: 0.74,
    vatRate: 0.2,
    dutyByCategory: {
      'karate-suits': 0,
      footballs: 0,
      hockeys: 0,
      hotballs: 0,
      'apparels-leather': 0,
    },
    preferenceNote: 'EU GSP+ REX statement grants 0% customs duty for verified Pakistan-origin goods.',
  },
  {
    country: 'Spain',
    regionLabel: 'Spain (EU · GSP+)',
    airExpressPerKg: 7.65,
    airCargoPerKg: 4.3,
    seaLclPerKg: 0.76,
    vatRate: 0.21,
    dutyByCategory: {
      'karate-suits': 0,
      footballs: 0,
      hockeys: 0,
      hotballs: 0,
      'apparels-leather': 0,
    },
    preferenceNote: 'EU GSP+ REX statement grants 0% customs duty via Madrid / Valencia / Barcelona ports.',
  },
  {
    country: 'United States',
    regionLabel: 'United States (MFN)',
    airExpressPerKg: 8.5,
    airCargoPerKg: 5.1,
    seaLclPerKg: 0.95,
    vatRate: 0,
    dutyByCategory: {
      'karate-suits': 0.165,
      footballs: 0,
      hockeys: 0,
      hotballs: 0.032,
      'apparels-leather': 0.06,
    },
    preferenceNote: 'MFN rates apply (0% on match footballs & hockey sticks; ~6% on leather jackets; ~16.5% on cotton karate uniforms).',
  },
  {
    country: 'United Arab Emirates',
    regionLabel: 'UAE / Dubai (GCC)',
    airExpressPerKg: 4.8,
    airCargoPerKg: 2.35,
    seaLclPerKg: 0.45,
    vatRate: 0.05,
    dutyByCategory: {
      'karate-suits': 0.05,
      footballs: 0.05,
      hockeys: 0.05,
      hotballs: 0.05,
      'apparels-leather': 0.05,
    },
    preferenceNote: 'Standard 5% GCC unified customs tariff + 5% VAT; direct short-haul air flights from Sialkot (SKT) to DXB.',
  },
  {
    country: 'Saudi Arabia',
    regionLabel: 'Saudi Arabia (GCC)',
    airExpressPerKg: 5.1,
    airCargoPerKg: 2.55,
    seaLclPerKg: 0.5,
    vatRate: 0.15,
    dutyByCategory: {
      'karate-suits': 0.05,
      footballs: 0.05,
      hockeys: 0.05,
      hotballs: 0.05,
      'apparels-leather': 0.05,
    },
    preferenceNote: 'GCC 5% customs tariff + 15% KSA VAT; direct Sialkot SKT air freight into Riyadh/Jeddah.',
  },
  {
    country: 'Japan',
    regionLabel: 'Japan (GSP)',
    airExpressPerKg: 8.2,
    airCargoPerKg: 4.85,
    seaLclPerKg: 0.88,
    vatRate: 0.1,
    dutyByCategory: {
      'karate-suits': 0.074,
      footballs: 0,
      hockeys: 0,
      hotballs: 0,
      'apparels-leather': 0.1,
    },
    preferenceNote: '0% duty on sports balls & hockey equipment; Form A GSP certificate reduces garment duties.',
  },
  {
    country: 'Australia',
    regionLabel: 'Australia',
    airExpressPerKg: 8.4,
    airCargoPerKg: 4.95,
    seaLclPerKg: 0.9,
    vatRate: 0.1,
    dutyByCategory: {
      'karate-suits': 0.05,
      footballs: 0.05,
      hockeys: 0,
      hotballs: 0.05,
      'apparels-leather': 0.05,
    },
    preferenceNote: 'Standard 5% general tariff (0% on select hockey gear) plus 10% Australian GST on CIF + Duty.',
  },
  {
    country: 'Canada',
    regionLabel: 'Canada (GPT)',
    airExpressPerKg: 8.7,
    airCargoPerKg: 5.2,
    seaLclPerKg: 0.98,
    vatRate: 0.05,
    dutyByCategory: {
      'karate-suits': 0.17,
      footballs: 0,
      hockeys: 0,
      hotballs: 0.065,
      'apparels-leather': 0.07,
    },
    preferenceNote: '0% duty on soccer/hockey equipment; 5% federal GST applies at border (provincial PST varies).',
  },
];

const UNIT_WEIGHT_KG: Record<string, number> = {
  'karate-suits': 0.9,
  footballs: 0.44,
  hockeys: 0.56,
  hotballs: 0.35,
  'apparels-leather': 1.45,
};

const DEFAULT_FOB_PER_KG: Record<string, number> = {
  'karate-suits': 18,
  footballs: 16,
  hockeys: 42,
  hotballs: 14,
  'apparels-leather': 48,
};

interface CostCalculatorProps {
  orderQuantity: number;
  initialCountry?: string;
  initialCategory?: ProductCategoryId;
  onAttachEstimate: (destinationCountry: string, summaryText: string) => void;
}

export const CostCalculator: React.FC<CostCalculatorProps> = ({
  orderQuantity,
  initialCountry = '',
  initialCategory,
  onAttachEstimate,
}) => {
  const resolveCountry = (raw: string) => {
    const clean = raw.trim().toLowerCase();
    if (!clean) return undefined;
    return DESTINATION_PROFILES.find(
      (d) =>
        d.country.toLowerCase() === clean ||
        clean.includes(d.country.toLowerCase()) ||
        (clean === 'uk' && d.country === 'United Kingdom') ||
        ((clean === 'usa' || clean === 'us') && d.country === 'United States') ||
        (clean === 'uae' && d.country === 'United Arab Emirates')
    )?.country;
  };

  const [destination, setDestination] = useState(resolveCountry(initialCountry) || 'Germany');
  const [categoryId, setCategoryId] = useState<string>(
    initialCategory && initialCategory !== 'custom' ? initialCategory : EXPORT_PRODUCTS[0].id
  );
  const [weightKg, setWeightKg] = useState<number>(150);
  const [freightMode, setFreightMode] = useState<FreightMode>('air-cargo');
  const [fobUsd, setFobUsd] = useState<number>(2700);
  const [fobManual, setFobManual] = useState(false);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiAdvisory, setAiAdvisory] = useState<{
    preferentialProgram: string;
    requiredDocuments: string;
    logisticsTip: string;
  } | null>(null);
  const [attachedNotice, setAttachedNotice] = useState(false);

  useEffect(() => {
    const matched = resolveCountry(initialCountry);
    if (matched) {
      setDestination(matched);
      setAiAdvisory(null);
    }
  }, [initialCountry]);

  useEffect(() => {
    if (initialCategory && initialCategory !== 'custom') {
      setCategoryId(initialCategory);
      setFobManual(false);
      setAiAdvisory(null);
    }
  }, [initialCategory]);

  const selectedProduct = useMemo(
    () => EXPORT_PRODUCTS.find((p) => p.id === categoryId) || EXPORT_PRODUCTS[0],
    [categoryId]
  );

  const profile = useMemo(
    () => DESTINATION_PROFILES.find((d) => d.country === destination) || DESTINATION_PROFILES[0],
    [destination]
  );

  const effectiveFob = useMemo(() => {
    if (fobManual) return Math.max(0, fobUsd);
    return Math.round(Math.max(1, weightKg) * (DEFAULT_FOB_PER_KG[categoryId] || 20));
  }, [categoryId, fobManual, fobUsd, weightKg]);

  const breakdown = useMemo(() => {
    const safeWeight = Math.max(1, Number(weightKg) || 1);

    // Volume break discount for heavier shipments
    const breakDiscount =
      safeWeight >= 1000 ? 0.82 : safeWeight >= 300 ? 0.9 : safeWeight >= 100 ? 0.95 : 1;

    let baseFee = 45;
    let ratePerKg = profile.airCargoPerKg;
    let transitDays = '6–9 business days';
    let routeLabel = 'Sialkot Intl Airport (SKT) Air Cargo';

    if (freightMode === 'air-express') {
      baseFee = 38;
      ratePerKg = profile.airExpressPerKg;
      transitDays = '4–6 business days';
      routeLabel = 'SKT Air Express Courier (Door-to-Door)';
    } else if (freightMode === 'sea-lcl') {
      baseFee = 145;
      ratePerKg = profile.seaLclPerKg;
      transitDays = '24–34 days';
      routeLabel = 'Sialkot Dry Port -> Port Qasim Sea Freight (LCL)';
    }

    const freightCost = Math.round((baseFee + safeWeight * ratePerKg * breakDiscount) * 100) / 100;
    const insuranceCost = Math.max(18, Math.round((effectiveFob + freightCost) * 0.0045 * 100) / 100);
    const cifValue = Math.round((effectiveFob + freightCost + insuranceCost) * 100) / 100;

    const dutyRate = profile.dutyByCategory[categoryId] ?? 0.05;
    const customsDuty = Math.round(cifValue * dutyRate * 100) / 100;
    const importVat = Math.round((cifValue + customsDuty) * profile.vatRate * 100) / 100;

    const totalLanded = Math.round((cifValue + customsDuty + importVat) * 100) / 100;
    const landedPerKg = Math.round((totalLanded / safeWeight) * 100) / 100;

    return {
      safeWeight,
      freightCost,
      insuranceCost,
      cifValue,
      dutyRatePct: Math.round(dutyRate * 1000) / 10,
      customsDuty,
      vatRatePct: Math.round(profile.vatRate * 1000) / 10,
      importVat,
      totalLanded,
      landedPerKg,
      transitDays,
      routeLabel,
    };
  }, [categoryId, effectiveFob, freightMode, profile, weightKg]);

  const handleSyncFromOrderQty = () => {
    const unitW = UNIT_WEIGHT_KG[categoryId] || 0.7;
    const estWeight = Math.max(5, Math.round(Math.max(1, orderQuantity) * unitW));
    setWeightKg(estWeight);
    setFobManual(false);
  };

  const handleAiVerify = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/cost-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationCountry: profile.country,
          productName: selectedProduct.name,
          hsCode: selectedProduct.hsCode,
          weightKg: breakdown.safeWeight,
          freightMode: breakdown.routeLabel,
          fobUsd: effectiveFob,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to verify tariff details.');
      setAiAdvisory(data.advisory);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI tariff check unavailable.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAttachToInquiry = () => {
    const summary = `[Cost Estimate: ${selectedProduct.shortLabel} | ${breakdown.safeWeight} kg to ${profile.country} via ${breakdown.routeLabel} | FOB $${effectiveFob.toLocaleString()} | Est. Freight $${breakdown.freightCost.toFixed(2)} | Est. Duty (${breakdown.dutyRatePct}%) $${breakdown.customsDuty.toFixed(2)} | Est. Total Landed $${breakdown.totalLanded.toLocaleString()}]`;
    onAttachEstimate(profile.country, summary);
    setAttachedNotice(true);
    window.setTimeout(() => setAttachedNotice(false), 2600);
  };

  return (
    <div className="space-y-4 border border-white/10 bg-[#101829] rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
            <Calculator className="w-3.5 h-3.5" />
            <span>Sialkot Export Shipping &amp; Customs Duty Calculator</span>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Estimate SKT air cargo or Port Qasim sea freight alongside destination customs duties and import VAT.
          </p>
        </div>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Destination Country
          </label>
          <select
            value={destination}
            onChange={(e) => {
              setDestination(e.target.value);
              setAiAdvisory(null);
            }}
            className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
          >
            {DESTINATION_PROFILES.map((d) => (
              <option key={d.country} value={d.country}>
                {d.regionLabel}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Sialkot Product Line (HS Code)
          </label>
          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setAiAdvisory(null);
            }}
            className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
          >
            {EXPORT_PRODUCTS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.shortLabel} · HS {p.hsCode}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-300">Shipment Weight (kg)</label>
            <button
              type="button"
              onClick={handleSyncFromOrderQty}
              className="text-[11px] text-sky-300 hover:text-sky-200"
            >
              Estimate from {orderQuantity} units
            </button>
          </div>
          <input
            type="number"
            min={1}
            max={100000}
            value={weightKg}
            onChange={(e) => setWeightKg(Math.max(1, Number(e.target.value) || 1))}
            className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white font-mono tabular-nums focus:outline-none focus:border-amber-400"
          />
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {[25, 150, 500, 2000].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWeightKg(w)}
                className={`px-2 py-0.5 text-[11px] font-mono tabular-nums rounded border transition-colors ${
                  weightKg === w
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                    : 'bg-[#090d16] border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                {w} kg
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-300">Goods Value (FOB USD)</label>
            {fobManual && (
              <button
                type="button"
                onClick={() => setFobManual(false)}
                className="text-[11px] text-slate-400 hover:text-white"
              >
                Auto-calc
              </button>
            )}
          </div>
          <input
            type="number"
            min={10}
            max={10000000}
            value={effectiveFob}
            onChange={(e) => {
              setFobManual(true);
              setFobUsd(Math.max(0, Number(e.target.value) || 0));
            }}
            className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white font-mono tabular-nums focus:outline-none focus:border-amber-400"
          />
          <div className="mt-1.5 text-[11px] text-slate-400">
            HS {selectedProduct.hsCode} · ~{UNIT_WEIGHT_KG[categoryId] || 0.7} kg/unit avg
          </div>
        </div>
      </div>

      {/* Freight Mode Selector */}
      <div>
        <label className="block text-xs font-medium text-slate-300 mb-1.5">Freight Mode</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setFreightMode('air-express')}
            className={`p-2.5 rounded-lg border text-left transition-colors ${
              freightMode === 'air-express'
                ? 'bg-amber-500/15 border-amber-400 text-white'
                : 'bg-[#090d16] border-white/10 text-slate-300 hover:border-white/25'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
              <Plane className="w-3.5 h-3.5" />
              <span>Air Express</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">4–6 days · Door-to-Door</div>
          </button>

          <button
            type="button"
            onClick={() => setFreightMode('air-cargo')}
            className={`p-2.5 rounded-lg border text-left transition-colors ${
              freightMode === 'air-cargo'
                ? 'bg-amber-500/15 border-amber-400 text-white'
                : 'bg-[#090d16] border-white/10 text-slate-300 hover:border-white/25'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
              <Plane className="w-3.5 h-3.5" />
              <span>SKT Air Cargo</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">6–9 days · Airport-to-Airport</div>
          </button>

          <button
            type="button"
            onClick={() => setFreightMode('sea-lcl')}
            className={`p-2.5 rounded-lg border text-left transition-colors ${
              freightMode === 'sea-lcl'
                ? 'bg-amber-500/15 border-amber-400 text-white'
                : 'bg-[#090d16] border-white/10 text-slate-300 hover:border-white/25'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
              <Ship className="w-3.5 h-3.5" />
              <span>Sea Freight LCL</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">24–34 days · Bulk Savings</div>
          </button>
        </div>
      </div>

      {/* Cost Breakdown Table */}
      <div className="rounded-xl border border-white/10 bg-[#090d16] p-3.5 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-300">
          <span>Route &amp; Transit</span>
          <span className="text-white font-medium text-right">
            {breakdown.routeLabel} · {breakdown.transitDays}
          </span>
        </div>

        <div className="border-t border-white/10 pt-2 space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-slate-300">
            <span>Declared FOB Sialkot Value</span>
            <span className="font-mono tabular-nums text-white">${effectiveFob.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span>Estimated International Freight ({breakdown.safeWeight} kg)</span>
            <span className="font-mono tabular-nums text-white">${breakdown.freightCost.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span>Transit Insurance (0.45%)</span>
            <span className="font-mono tabular-nums text-white">${breakdown.insuranceCost.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-white/5">
            <span>Estimated CIF Valuation</span>
            <span className="font-mono tabular-nums text-slate-200">${breakdown.cifValue.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span>Customs Duty ({breakdown.dutyRatePct}% est.)</span>
            <span className="font-mono tabular-nums text-amber-300">${breakdown.customsDuty.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span>Destination Import VAT / GST ({breakdown.vatRatePct}%)</span>
            <span className="font-mono tabular-nums text-slate-200">${breakdown.importVat.toFixed(2)}</span>
          </div>
        </div>

        <div className="pt-2.5 border-t border-amber-500/30 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-white">Total Estimated Landed Cost</div>
            <div className="text-[11px] font-mono tabular-nums text-slate-400">
              ${breakdown.landedPerKg.toFixed(2)} / kg effective landed rate
            </div>
          </div>
          <div className="text-lg font-bold font-mono tabular-nums text-amber-300">
            ${breakdown.totalLanded.toLocaleString()}
          </div>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed pt-1 border-t border-white/5">
          {profile.preferenceNote}
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleAttachToInquiry}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-400 transition-colors"
        >
          <span>{attachedNotice ? 'Added to Order Form' : 'Attach Estimate to Order Form'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          disabled={aiLoading}
          onClick={() => void handleAiVerify()}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white/10 text-white rounded-lg hover:bg-white/15 disabled:opacity-60 transition-colors"
        >
          {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-300" />}
          <span>AI Tariff &amp; Docs Check</span>
        </button>
      </div>

      {aiError && (
        <div className="p-2.5 rounded-lg border border-red-500/30 bg-red-950/30 text-xs text-red-200">
          {aiError}
        </div>
      )}

      {aiAdvisory && (
        <div className="rounded-lg border border-sky-500/30 bg-[#090d16] p-3 space-y-1.5 text-xs">
          <div className="font-semibold text-sky-300">AI Customs &amp; Compliance Verification</div>
          <p className="text-slate-300 leading-relaxed">
            <span className="text-white font-medium">Tariff Program: </span>
            {aiAdvisory.preferentialProgram}
          </p>
          <p className="text-slate-300 leading-relaxed">
            <span className="text-white font-medium">Documents: </span>
            {aiAdvisory.requiredDocuments}
          </p>
          <p className="text-slate-300 leading-relaxed">
            <span className="text-white font-medium">Freight Tip: </span>
            {aiAdvisory.logisticsTip}
          </p>
        </div>
      )}
    </div>
  );
};
