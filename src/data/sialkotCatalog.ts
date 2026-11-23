import { ExportProductSpec, ProductCategoryId } from '../types/exportHub.ts';

export const SIALKOT_COORDS = { lat: 32.4945, lng: 74.5229 };

export const EXPORT_PRODUCTS: ExportProductSpec[] = [
  {
    id: 'karate-suits',
    name: 'Karate Suits & Martial Arts Gi',
    shortLabel: 'Karate Suits',
    hsCode: '6203.22 / 6204.22',
    moq: '100 Sets (Custom Sizing & Embroidery)',
    leadTime: '18–25 Days ex-Sialkot',
    certifications: ['WKF Cut-Spec Compliant', 'OEKO-TEX Standard 100', 'Pre-Shrunk 100% Cotton'],
    materials: '10oz–16oz Brushed Cotton Canvas & Ripstop Pearl Weave',
    customOemOptions: 'Woven dojo labels, custom lapel stitching, rank stripes, private-label packaging',
    finishes: [
      { id: 'bleached-white', label: 'Tournament White', primaryHex: '#f4f2ec', accentHex: '#18181b', roughness: 0.85, metalness: 0.02 },
      { id: 'unbleached-ecru', label: 'Heavy Unbleached', primaryHex: '#dfd7c5', accentHex: '#27272a', roughness: 0.9, metalness: 0.02 },
      { id: 'dojo-obsidian', label: 'Master Obsidian', primaryHex: '#1c2029', accentHex: '#d4af37', roughness: 0.78, metalness: 0.08 },
    ],
    inspectableParts: [
      { partKey: 'gi-lapel', title: 'Reinforced 6-Row Stitched Lapel', spec: 'Heavyweight 14oz cotton twill collar engineered for tournament grip resistance.' },
      { partKey: 'obi-belt', title: '9-Row Quilted Obi Black Belt', spec: 'Core-stiffened black belt with embroidered metallic gold Dan rank bars.' },
      { partKey: 'crest-patch', title: 'Custom OEM Woven Crest', spec: 'High-density satin damask label stitched for academy & federation branding.' },
    ],
  },
  {
    id: 'footballs',
    name: 'Match & Training Footballs',
    shortLabel: 'Footballs',
    hsCode: '9506.62',
    moq: '250 Balls (Custom Club Graphics)',
    leadTime: '20–28 Days ex-Sialkot',
    certifications: ['FIFA Quality Pro Geometry', 'IMS Match Spec', 'Latex Zero-Leak Bladder'],
    materials: '1.6mm Japanese PU Microfiber, 4-Ply Poly-Cotton Lining, Hand-Stitched or Thermo-Bonded',
    customOemOptions: '32-panel or 12-panel graphics, club crest screen-printing, custom box packaging',
    finishes: [
      { id: 'classic-match', label: 'Classic Monochrome', primaryHex: '#f5f5f4', accentHex: '#14171f', roughness: 0.42, metalness: 0.06 },
      { id: 'heritage-crimson', label: 'Sialkot Crimson', primaryHex: '#f4f1ea', accentHex: '#991b1b', roughness: 0.38, metalness: 0.08 },
      { id: 'championship-gold', label: 'Tournament Gold', primaryHex: '#181c24', accentHex: '#d4af37', roughness: 0.34, metalness: 0.28 },
    ],
    inspectableParts: [
      { partKey: 'panels', title: '32-Panel Hand-Stitched Shell', spec: 'Waxed 5-ply polyester thread locks each 1.6mm PU panel for true flight stability.' },
      { partKey: 'valve', title: 'Butyl Air-Lock Valve', spec: 'Precision recessed double-lock valve maintaining 0.8–1.0 bar match pressure.' },
      { partKey: 'stand', title: 'Brushed Brass Display Cradle', spec: 'CNC-turned showcase ring representing Sialkot export presentation quality.' },
    ],
  },
  {
    id: 'hockeys',
    name: 'Composite Field Hockey Sticks',
    shortLabel: 'Hockeys',
    hsCode: '9506.99',
    moq: '100 Sticks (Custom Bow & Carbon %)',
    leadTime: '22–30 Days ex-Sialkot',
    certifications: ['FIH Dimensions Compliant', '3K–12K Toray Carbon Layup', 'Shock-Absorb EVA Grip'],
    materials: '90% Carbon / 5% Kevlar / 5% Aramid Composite & Traditional Mulberry Wood Options',
    customOemOptions: 'Low/Extreme-Low/Mid bow molds, custom water-transfer decals, private brand grip',
    finishes: [
      { id: 'carbon-gold', label: '3K Carbon & Brass', primaryHex: '#171b22', accentHex: '#d4af37', roughness: 0.28, metalness: 0.42 },
      { id: 'emerald-turf', label: 'Turf Emerald', primaryHex: '#0f2922', accentHex: '#34d399', roughness: 0.32, metalness: 0.35 },
      { id: 'ivory-heritage', label: 'Classic Ash & Navy', primaryHex: '#d8c9ae', accentHex: '#1e3a5f', roughness: 0.55, metalness: 0.08 },
    ],
    inspectableParts: [
      { partKey: 'blade-hook', title: '24mm Low-Bow Drag-Flick Toe', spec: 'Aramid-reinforced striking face engineered for high-velocity turf drag flicks.' },
      { partKey: 'grip-wrap', title: 'Anti-Slip Chamois PU Grip', spec: 'Micro-perforated spiral overgrip over dual-density foam vibration damper.' },
      { partKey: 'turf-ball', title: 'Dimpled Match Hockey Ball', spec: 'Seamless rotationally-molded PVC shell with water-dispersion dimple matrix.' },
    ],
  },
  {
    id: 'hotballs',
    name: 'Hotballs & Indoor Match Balls',
    shortLabel: 'Hotballs',
    hsCode: '9506.69',
    moq: '200 Units (Custom Durometer & Color)',
    leadTime: '15–22 Days ex-Sialkot',
    certifications: ['High-Visibility UV Pigments', 'Low-Bounce / High-Rebound Options', 'ISO 9001 Batch Tested'],
    materials: 'Thermoplastic Elastomer Core with Textured High-Grip Matte Shell',
    customOemOptions: 'Custom Shore A hardness, neon/night visibility blends, embossed club logo',
    finishes: [
      { id: 'ember-orange', label: 'High-Vis Ember', primaryHex: '#ea580c', accentHex: '#18181b', roughness: 0.45, metalness: 0.05 },
      { id: 'volt-amber', label: 'Tournament Amber', primaryHex: '#eab308', accentHex: '#1e293b', roughness: 0.4, metalness: 0.08 },
      { id: 'cobalt-pro', label: 'Arena Cobalt', primaryHex: '#2563eb', accentHex: '#f8fafc', roughness: 0.38, metalness: 0.1 },
    ],
    inspectableParts: [
      { partKey: 'equator-band', title: 'Thermal-Welded Seam Band', spec: 'Zero-stitch aerodynamic equatorial seal eliminating moisture absorption.' },
      { partKey: 'dimple-shell', title: 'Micro-Textured Grip Shell', spec: 'High-friction elastomer skin calibrated for wet turf and indoor court control.' },
      { partKey: 'cradle', title: 'Machined Steel Presentation Base', spec: 'Balanced three-axis inspection mount for buyer showcase review.' },
    ],
  },
  {
    id: 'apparels-leather',
    name: 'Performance Apparel & Leather Jackets',
    shortLabel: 'Apparel & Leather',
    hsCode: '4203.10 / 6110.30',
    moq: '50 Jackets / 150 Apparel Pieces',
    leadTime: '21–30 Days ex-Sialkot',
    certifications: ['Full-Grain Drum-Dyed Hide', 'CE Armor Pocket Ready', 'Sublimation Colorfast Grade 4.5'],
    materials: '1.2mm Top-Grain Cowhide / Lambskin, YKK Brass Hardware, 260gsm Moisture-Wick Polyester',
    customOemOptions: 'Custom pattern grading, embossed leather patches, varsity chenille, full teamwear kits',
    finishes: [
      { id: 'obsidian-brass', label: 'Obsidian & Brass', primaryHex: '#15171c', accentHex: '#c9a248', roughness: 0.48, metalness: 0.12 },
      { id: 'oxblood-hide', label: 'Oxblood Aniline', primaryHex: '#4a181c', accentHex: '#d4af37', roughness: 0.42, metalness: 0.1 },
      { id: 'cognac-saddle', label: 'Saddle Cognac', primaryHex: '#6b3e26', accentHex: '#e2e8f0', roughness: 0.52, metalness: 0.08 },
    ],
    inspectableParts: [
      { partKey: 'jacket-lapel', title: 'Full-Grain Moto & Varsity Collar', spec: '1.2mm drum-dyed Sialkot leather with twin-needle topstitching.' },
      { partKey: 'brass-zip', title: 'Heavy-Gauge Brass Zipper Track', spec: 'Anti-tarnish #8 metallic zip hardware tested for 15,000+ open/close cycles.' },
      { partKey: 'rib-trim', title: 'High-Recovery Knit Cuffs & Hem', spec: '2x2 heavyweight cotton-elastane ribbing for tailored athletic fit.' },
    ],
  },
];

export const CATEGORY_LABELS: Record<ProductCategoryId, string> = {
  'karate-suits': 'Karate Suits & Martial Arts Gi',
  footballs: 'Match & Training Footballs',
  hockeys: 'Field Hockey Sticks',
  hotballs: 'Hotballs & Indoor Balls',
  'apparels-leather': 'Apparels & Leather Jackets',
  custom: 'Custom Sialkot Manufacturing',
};

export const TARGET_HUB_MARKETS = [
  { name: 'Munich / DACH Sports Hub', country: 'Germany', lat: 48.1351, lng: 11.582 },
  { name: 'Manchester / UK Kit Importers', country: 'United Kingdom', lat: 53.4808, lng: -2.2426 },
  { name: 'Rotterdam / EU Port Distribution', country: 'Netherlands', lat: 51.9244, lng: 4.4777 },
  { name: 'Los Angeles / US West Apparel', country: 'United States', lat: 34.0522, lng: -118.2437 },
  { name: 'Dubai / GCC Sports Wholesale', country: 'United Arab Emirates', lat: 25.2048, lng: 55.2708 },
  { name: 'Tokyo / Martial Arts Federations', country: 'Japan', lat: 35.6762, lng: 139.6503 },
  { name: 'Melbourne / Oceania Turf & Clubs', country: 'Australia', lat: -37.8136, lng: 144.9631 },
];

export const CONTINUOUS_SCAN_KEYWORDS: {
  keyword: string;
  category: ProductCategoryId;
  regionHint: string;
}[] = [
  { keyword: 'buy karate suits', category: 'karate-suits', regionHint: 'Europe, UK & North America' },
  { keyword: 'import footballs from Pakistan', category: 'footballs', regionHint: 'Global Sporting Goods Importers' },
  { keyword: 'Sialkot apparel suppliers', category: 'apparels-leather', regionHint: 'USA, Europe & GCC' },
  { keyword: 'hockey equipment wholesale', category: 'hockeys', regionHint: 'Netherlands, UK, Australia & Germany' },
  { keyword: 'leather jackets manufacturer Sialkot', category: 'apparels-leather', regionHint: 'Europe, UK & North America' },
  { keyword: 'custom martial arts gi OEM supplier', category: 'karate-suits', regionHint: 'Germany, France & Japan' },
  { keyword: 'indoor match hotballs wholesale', category: 'hotballs', regionHint: 'UK, Europe & UAE' },
];

export function getTariffAdvantageForCountry(
  country: string,
  category: ProductCategoryId
): string {
  const c = (country || '').toLowerCase();
  if (/germany|france|netherlands|spain|italy|belgium|austria|sweden|poland|eu|europe/.test(c)) {
    return 'EU GSP+ (REX) · 0% Preferential Duty';
  }
  if (/uk|united kingdom|england|britain|scotland/.test(c)) {
    return 'UK DCTS · 0% Preferential Duty';
  }
  if (/united states|usa|u\.s\.|america|canada/.test(c)) {
    if (category === 'footballs' || category === 'hockeys') {
      return '0% MFN Duty on Match Balls & Hockey';
    }
    return 'SKT Direct Air & Sea Corridor';
  }
  if (/uae|dubai|emirates|saudi|qatar|gcc/.test(c)) {
    return 'GCC 5% Tariff · Direct SKT–DXB Air';
  }
  if (/japan/.test(c)) {
    return category === 'footballs' || category === 'hockeys' || category === 'hotballs'
      ? 'Japan 0% Duty on Sports Gear'
      : 'Japan GSP Form A Eligible';
  }
  if (/australia|new zealand/.test(c)) {
    return category === 'hockeys'
      ? '0% Duty on Field Hockey Gear'
      : '5% General Tariff · Oceania Corridor';
  }
  return 'FOB Sialkot / SKT Air Express';
}
