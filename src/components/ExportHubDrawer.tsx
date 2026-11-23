import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookmarkCheck,
  BookmarkPlus,
  Calculator,
  Check,
  Copy,
  Download,
  ExternalLink,
  Globe2,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  Pause,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  CATEGORY_LABELS,
  CONTINUOUS_SCAN_KEYWORDS,
  EXPORT_PRODUCTS,
  getTariffAdvantageForCountry,
} from '../data/sialkotCatalog.ts';
import { CustomOrderPanel } from './CustomOrderPanel.tsx';
import { ExportChatbotPanel } from './ExportChatbotPanel.tsx';
import { ExportInsightsPanel } from './ExportInsightsPanel.tsx';
import { HeritageSection } from './HeritageSection.tsx';
import {
  DeepAnalysisResult,
  DiscoveredLead,
  ExporterProfile,
  GroundingSource,
  LeadStatus,
  MapsPlaceChunk,
  ProductCategoryId,
  SavedExportLead,
  SearchCampaign,
} from '../types/exportHub.ts';

export type HubTabId =
  | 'discover'
  | 'maps'
  | 'outreach'
  | 'pipeline'
  | 'inquiry'
  | 'insights'
  | 'chat'
  | 'heritage'
  | 'register';

interface ExportHubDrawerProps {
  open: boolean;
  activeTab: HubTabId;
  onChangeTab: (tab: HubTabId) => void;
  onClose: () => void;
  user: User | null;
  onSignIn: () => Promise<void>;
  exporterProfile: ExporterProfile | null;
  onSaveProfile: (profileData: Omit<ExporterProfile, 'uid' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  discoveredLeads: DiscoveredLead[];
  onLeadsDiscovered: (
    leads: DiscoveredLead[],
    sources: GroundingSource[],
    summary: string,
    campaignMeta: {
      productCategory: ProductCategoryId;
      targetRegion: string;
      buyerType: string;
      customSpecs: string;
    },
    appendMode?: boolean
  ) => void;
  groundingSources: GroundingSource[];
  marketSummary: string;
  savedLeads: SavedExportLead[];
  campaigns: SearchCampaign[];
  onSaveLead: (lead: DiscoveredLead) => Promise<void>;
  onUpdateLeadStatus: (leadId: string, status: LeadStatus, pitch?: string, notes?: string) => Promise<void>;
  onDeleteLead: (leadId: string) => Promise<void>;
  onShowGlobeWithLeads: () => void;
}

const BUYER_TYPES = [
  'Distributors & Importers',
  'Martial Arts Academies & Federations',
  'Football & Field Hockey Clubs',
  'Private Label Sportswear Brands',
  'Wholesale Sporting Goods Retailers',
];

const QUICK_REGIONS = [
  'Germany & DACH',
  'United Kingdom',
  'United States',
  'United Arab Emirates',
  'Japan',
  'Australia',
  'Netherlands & Benelux',
];

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'sample_sent', label: 'Sample Sent' },
  { value: 'negotiating', label: 'Negotiating' },
  { value: 'won', label: 'Order Won' },
  { value: 'archived', label: 'Archived' },
];

const PRODUCT_WHATSAPP_SPECS: Record<ProductCategoryId, string> = {
  'karate-suits':
    'WKF-spec 10oz–16oz brushed cotton & ripstop Karate Gis with custom dojo embroidery and private-label obi belts',
  footballs:
    'FIFA-grade hand-stitched & thermo-bonded match/training footballs with custom club graphics and latex zero-leak bladders',
  hockeys:
    'FIH-compliant 3K–12K Toray carbon composite & traditional mulberry field hockey sticks with custom bow profiles',
  hotballs:
    'high-visibility thermal-welded indoor & turf hotballs with calibrated Shore A durometer and custom club embossing',
  'apparels-leather':
    '1.2mm drum-dyed full-grain cowhide/lambskin leather jackets, varsity outerwear, and custom sublimated sportswear',
  custom:
    'custom OEM Sialkot sporting goods, combat gear, and technical teamwear built to buyer tech-pack specifications',
};

function buildWhatsAppInquiryMessage(
  lead: {
    companyName: string;
    country: string;
    city?: string;
    productCategory: ProductCategoryId;
    matchedKeyword?: string;
    estimatedOrderVolume?: string;
  },
  exporterProfile: ExporterProfile | null
): string {
  const company = exporterProfile?.companyName || 'Sarwar Khawaja Industries Pvt Ltd';
  const director = exporterProfile?.directorName || 'Khawaja Irfan';
  const heritage = exporterProfile?.founderHeritage || 'Sarwar Khawaja';
  const productLabel = CATEGORY_LABELS[lead.productCategory] || 'Custom Sialkot Sports & Apparel';
  const productDetail = PRODUCT_WHATSAPP_SPECS[lead.productCategory] || PRODUCT_WHATSAPP_SPECS.custom;
  const locationLabel = lead.city ? `${lead.city}, ${lead.country}` : lead.country || 'your market';
  const volumeNote = lead.estimatedOrderVolume
    ? ` for volumes around ${lead.estimatedOrderVolume}`
    : '';
  const keywordNote = lead.matchedKeyword ? ` (${lead.matchedKeyword})` : '';

  return [
    `Hello ${lead.companyName} Sourcing Team,`,
    '',
    `Greetings from ${company} in Sialkot, Pakistan — led by ${director} and carrying forward the multi-generational manufacturing heritage of ${heritage}.`,
    '',
    `We noticed your active demand in ${locationLabel} for ${productLabel}${keywordNote}. As a direct Sialkot OEM factory, we manufacture ${productDetail}${volumeNote} with full custom branding, competitive FOB Sialkot / SKT Air Cargo rates, and pre-production sample dispatch.`,
    '',
    `Would you like us to share our latest OEM catalog, material swatches, and a tailored export quotation?`,
    '',
    `Best regards,`,
    `${director}`,
    `${company} · Sialkot, Pakistan`,
  ].join('\n');
}

function buildWhatsAppOutreachUrl(
  contactPhone: string | undefined,
  message: string
): string {
  const digits = (contactPhone || '').replace(/\D/g, '');
  const encodedText = encodeURIComponent(message);
  if (digits.length >= 7) {
    return `https://wa.me/${digits}?text=${encodedText}`;
  }
  return `https://wa.me/?text=${encodedText}`;
}

export const ExportHubDrawer: React.FC<ExportHubDrawerProps> = ({
  open,
  activeTab,
  onChangeTab,
  onClose,
  user,
  onSignIn,
  exporterProfile,
  onSaveProfile,
  discoveredLeads,
  onLeadsDiscovered,
  groundingSources,
  marketSummary,
  savedLeads,
  campaigns,
  onSaveLead,
  onUpdateLeadStatus,
  onDeleteLead,
  onShowGlobeWithLeads,
}) => {
  // Lead Finder & Continuous AI Keyword Scanner state
  const [productCategory, setProductCategory] = useState<ProductCategoryId>('karate-suits');
  const [customItemName, setCustomItemName] = useState('');
  const [targetRegion, setTargetRegion] = useState('Germany & DACH');
  const [buyerType, setBuyerType] = useState(BUYER_TYPES[0]);
  const [customSpecs, setCustomSpecs] = useState(
    'Custom OEM embroidery, private-label sizing, factory-direct Sialkot pricing'
  );
  const [searchKeyword, setSearchKeyword] = useState(CONTINUOUS_SCAN_KEYWORDS[0].keyword);
  const [autoScanActive, setAutoScanActive] = useState(false);
  const [scanIndex, setScanIndex] = useState(0);
  const [lastScannedKeyword, setLastScannedKeyword] = useState('');
  const [lastScanAt, setLastScanAt] = useState<string | null>(null);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [savingLeadId, setSavingLeadId] = useState<string | null>(null);
  const [batchSaving, setBatchSaving] = useState(false);
  const [leadFilterMode, setLeadFilterMode] = useState<'all' | 'high-fit' | 'has-phone' | 'has-email'>('all');
  const [leadFilterText, setLeadFilterText] = useState('');
  const discoverInFlightRef = useRef(false);

  // Maps Grounding state
  const [mapsQuery, setMapsQuery] = useState('martial arts uniform & sporting goods wholesalers');
  const [mapsCity, setMapsCity] = useState('Munich, Germany');
  const [mapsLatLng, setMapsLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [mapsLoading, setMapsLoading] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [mapsMarkdown, setMapsMarkdown] = useState('');
  const [mapsPlaces, setMapsPlaces] = useState<MapsPlaceChunk[]>([]);
  const [savingPlaceKey, setSavingPlaceKey] = useState<string | null>(null);

  // Deep Outreach & TTS state
  const [selectedLeadForPitch, setSelectedLeadForPitch] = useState<
    DiscoveredLead | SavedExportLead | null
  >(null);
  const [manualCompany, setManualCompany] = useState('');
  const [manualCountry, setManualCountry] = useState('Germany');
  const [manualSignal, setManualSignal] = useState('');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<DeepAnalysisResult | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [browserSpeaking, setBrowserSpeaking] = useState(false);
  const [ttsVoice, setTtsVoice] = useState<'Charon' | 'Kore' | 'Puck' | 'Fenrir'>('Charon');

  // Pipeline state
  const [pipelineSearch, setPipelineSearch] = useState('');
  const [pipelineFilter, setPipelineFilter] = useState<LeadStatus | 'all'>('all');

  // Cost calculator prefill from a lead card
  const [calcPrefill, setCalcPrefill] = useState<{
    country?: string;
    category?: ProductCategoryId;
    nonce: number;
  } | null>(null);

  // Registration form state
  const [regCompany, setRegCompany] = useState(
    exporterProfile?.companyName || 'Sarwar Khawaja Industries Pvt Ltd'
  );
  const [regDirector, setRegDirector] = useState(exporterProfile?.directorName || 'Khawaja Irfan');
  const [regHeritage, setRegHeritage] = useState(
    exporterProfile?.founderHeritage || 'Founded by Sarwar Khawaja (3rd-Generation Sialkot Sports Craft)'
  );
  const [regCity, setRegCity] = useState(exporterProfile?.city || 'Sialkot, Punjab, Pakistan');
  const [regEmail, setRegEmail] = useState(exporterProfile?.email || user?.email || '');
  const [regPhone, setRegPhone] = useState(exporterProfile?.phone || '');
  const [regChamberId, setRegChamberId] = useState(exporterProfile?.ntnOrChamberId || '');
  const [regSpecialties, setRegSpecialties] = useState<string[]>(
    exporterProfile?.specialties || [
      'Karate Suits',
      'Footballs',
      'Field Hockey Sticks',
      'Hotballs',
      'Apparels & Leather Jackets',
    ]
  );
  const [regCustomOem, setRegCustomOem] = useState(exporterProfile?.customOrdersEnabled ?? true);
  const [regMinOrder, setRegMinOrder] = useState(exporterProfile?.minOrderUnits ?? 100);
  const [regSaving, setRegSaving] = useState(false);
  const [regMessage, setRegMessage] = useState<string | null>(null);

  useEffect(() => {
    if (exporterProfile) {
      setRegCompany(exporterProfile.companyName);
      setRegDirector(exporterProfile.directorName);
      setRegHeritage(exporterProfile.founderHeritage || '');
      setRegCity(exporterProfile.city);
      setRegEmail(exporterProfile.email);
      setRegPhone(exporterProfile.phone || '');
      setRegChamberId(exporterProfile.ntnOrChamberId || '');
      if (exporterProfile.specialties?.length) {
        setRegSpecialties(exporterProfile.specialties);
      }
      setRegCustomOem(exporterProfile.customOrdersEnabled);
      setRegMinOrder(exporterProfile.minOrderUnits);
    } else if (user?.email) {
      setRegEmail((prev) => prev || user.email || '');
    }
  }, [exporterProfile, user]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const savedCompanyKeys = useMemo(() => {
    return new Set(savedLeads.map((l) => `${l.companyName.toLowerCase()}::${l.country.toLowerCase()}`));
  }, [savedLeads]);

  const filteredDiscoveredLeads = useMemo(() => {
    const q = leadFilterText.trim().toLowerCase();
    return discoveredLeads.filter((lead) => {
      if (leadFilterMode === 'high-fit' && lead.leadScore < 85) return false;
      if (leadFilterMode === 'has-phone' && (lead.contactPhone || '').replace(/\D/g, '').length < 7) {
        return false;
      }
      if (leadFilterMode === 'has-email' && !String(lead.contactEmail || '').includes('@')) {
        return false;
      }
      if (!q) return true;
      return (
        lead.companyName.toLowerCase().includes(q) ||
        lead.country.toLowerCase().includes(q) ||
        (lead.city || '').toLowerCase().includes(q) ||
        lead.sourcingSignal.toLowerCase().includes(q)
      );
    });
  }, [discoveredLeads, leadFilterMode, leadFilterText]);

  const unsavedHighFitLeads = useMemo(() => {
    return discoveredLeads.filter(
      (l) =>
        l.leadScore >= 85 &&
        !savedCompanyKeys.has(`${l.companyName.toLowerCase()}::${l.country.toLowerCase()}`)
    );
  }, [discoveredLeads, savedCompanyKeys]);

  const filteredSavedLeads = useMemo(() => {
    return savedLeads.filter((l) => {
      const matchesStatus = pipelineFilter === 'all' || l.status === pipelineFilter;
      const q = pipelineSearch.trim().toLowerCase();
      const matchesQuery =
        !q ||
        l.companyName.toLowerCase().includes(q) ||
        l.country.toLowerCase().includes(q) ||
        l.sourcingSignal.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [savedLeads, pipelineFilter, pipelineSearch]);

  const pipelineKpis = useMemo(() => {
    const total = savedLeads.length;
    const avgScore =
      total > 0
        ? Math.round(
            savedLeads.reduce((acc, l) => acc + (typeof l.leadScore === 'number' ? l.leadScore : 78), 0) / total
          )
        : 0;
    const activeOutreach = savedLeads.filter(
      (l) => l.status === 'contacted' || l.status === 'sample_sent' || l.status === 'negotiating'
    ).length;
    const won = savedLeads.filter((l) => l.status === 'won').length;
    return { total, avgScore, activeOutreach, won };
  }, [savedLeads]);

  const runLeadDiscovery = useCallback(
    async (opts?: {
      keyword?: string;
      categoryOverride?: ProductCategoryId;
      regionOverride?: string;
      appendMode?: boolean;
      forceRefresh?: boolean;
    }) => {
      if (discoverInFlightRef.current) return;
      discoverInFlightRef.current = true;
      setDiscoverLoading(true);
      setDiscoverError(null);

      const activeCategory = opts?.categoryOverride ?? productCategory;
      const activeRegion = opts?.regionOverride ?? targetRegion;
      const activeKeyword = (opts?.keyword ?? searchKeyword).trim();
      const productLabel =
        activeCategory === 'custom' && customItemName.trim()
          ? customItemName.trim()
          : CATEGORY_LABELS[activeCategory];

      try {
        const res = await fetch('/api/leads/discover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productCategory: activeCategory,
            productLabel,
            targetRegion: activeRegion,
            buyerType,
            customSpecs,
            searchKeyword: activeKeyword,
            companyName: exporterProfile?.companyName || 'Sarwar Khawaja Industries Pvt Ltd',
            forceRefresh: Boolean(opts?.forceRefresh),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 429) {
            setAutoScanActive(false);
          }
          throw new Error(data.error || 'Lead discovery request failed.');
        }
        setLastScannedKeyword(activeKeyword || productLabel);
        setLastScanAt(
          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        );
        onLeadsDiscovered(
          data.leads || [],
          data.groundingSources || [],
          data.marketSummary || '',
          {
            productCategory: activeCategory,
            targetRegion: activeRegion,
            buyerType,
            customSpecs,
          },
          opts?.appendMode
        );
      } catch (err) {
        setDiscoverError(err instanceof Error ? err.message : 'Unable to discover leads.');
      } finally {
        discoverInFlightRef.current = false;
        setDiscoverLoading(false);
      }
    },
    [
      buyerType,
      customItemName,
      customSpecs,
      exporterProfile?.companyName,
      onLeadsDiscovered,
      productCategory,
      searchKeyword,
      targetRegion,
    ]
  );

  useEffect(() => {
    if (!autoScanActive) return;
    const timer = window.setInterval(() => {
      const nextIdx = (scanIndex + 1) % CONTINUOUS_SCAN_KEYWORDS.length;
      const preset = CONTINUOUS_SCAN_KEYWORDS[nextIdx];
      setScanIndex(nextIdx);
      setSearchKeyword(preset.keyword);
      setProductCategory(preset.category);
      setTargetRegion(preset.regionHint);
      void runLeadDiscovery({
        keyword: preset.keyword,
        categoryOverride: preset.category,
        regionOverride: preset.regionHint,
        appendMode: true,
      });
    }, 45000);
    return () => window.clearInterval(timer);
  }, [autoScanActive, runLeadDiscovery, scanIndex]);

  if (!open) return null;

  const handleDiscover = async (e: React.FormEvent) => {
    e.preventDefault();
    await runLeadDiscovery({ appendMode: false });
  };

  const handleToggleAutoScan = () => {
    if (!autoScanActive) {
      const preset = CONTINUOUS_SCAN_KEYWORDS[scanIndex];
      setSearchKeyword(preset.keyword);
      setProductCategory(preset.category);
      setTargetRegion(preset.regionHint);
      setAutoScanActive(true);
      void runLeadDiscovery({
        keyword: preset.keyword,
        categoryOverride: preset.category,
        regionOverride: preset.regionHint,
        appendMode: true,
      });
    } else {
      setAutoScanActive(false);
    }
  };

  const handleScanNextKeyword = () => {
    const nextIdx = (scanIndex + 1) % CONTINUOUS_SCAN_KEYWORDS.length;
    const preset = CONTINUOUS_SCAN_KEYWORDS[nextIdx];
    setScanIndex(nextIdx);
    setSearchKeyword(preset.keyword);
    setProductCategory(preset.category);
    setTargetRegion(preset.regionHint);
    void runLeadDiscovery({
      keyword: preset.keyword,
      categoryOverride: preset.category,
      regionOverride: preset.regionHint,
      appendMode: true,
    });
  };

  const handleBatchSaveHighFit = async () => {
    if (!user) {
      await onSignIn();
      return;
    }
    if (unsavedHighFitLeads.length === 0) return;
    setBatchSaving(true);
    try {
      for (const lead of unsavedHighFitLeads.slice(0, 6)) {
        await onSaveLead(lead);
      }
    } finally {
      setBatchSaving(false);
    }
  };

  const handleEstimateForLead = (country: string, category: ProductCategoryId) => {
    setCalcPrefill({ country, category, nonce: Date.now() });
    onChangeTab('inquiry');
  };

  const handleMapsSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setMapsLoading(true);
    setMapsError(null);
    try {
      const res = await fetch('/api/leads/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: mapsQuery,
          city: mapsCity,
          lat: mapsLatLng?.lat,
          lng: mapsLatLng?.lng,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Maps search failed.');
      setMapsMarkdown(data.markdownText || '');
      setMapsPlaces(data.places || []);
    } catch (err) {
      setMapsError(err instanceof Error ? err.message : 'Failed to query Google Maps grounding.');
    } finally {
      setMapsLoading(false);
    }
  };

  const handleSaveMapPlace = async (place: MapsPlaceChunk, idx: number) => {
    if (!user) {
      await onSignIn();
      return;
    }
    const cityParts = mapsCity.split(',').map((s) => s.trim());
    const cityPart = cityParts[0] || mapsCity;
    const countryPart = cityParts[1] || cityParts[0] || 'International';
    const key = `${place.title}-${idx}`;
    setSavingPlaceKey(key);
    try {
      await onSaveLead({
        id: `maps_${Date.now()}_${idx}`,
        companyName: place.title,
        country: countryPart,
        city: cityPart,
        buyerType: 'Local Retailer / Distributor',
        productCategory,
        website: place.uri || '',
        contactEmail: '',
        contactPhone: '',
        sourcingSignal:
          place.reviewSnippets && place.reviewSnippets.length > 0
            ? `${mapsQuery}: "${place.reviewSnippets[0]}"`
            : `Verified Google Maps business matching "${mapsQuery}" in ${mapsCity}.`,
        estimatedOrderVolume: '150–500 units',
        fitReason: `Direct local retailer / distributor verified via Google Maps in ${mapsCity}.`,
        leadScore: 82,
        matchedKeyword: mapsQuery,
        lat: mapsLatLng?.lat ?? 48.1351,
        lng: mapsLatLng?.lng ?? 11.582,
        sourceUri: place.uri || '',
        sourceTitle: place.title,
      });
    } finally {
      setSavingPlaceKey(null);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMapsError('Geolocation is not supported in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMapsLatLng({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setMapsCity(`${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`);
      },
      () => {
        setMapsError('Location permission denied. Enter a city name manually.');
      }
    );
  };

  const runDeepAnalysis = async (leadObj?: DiscoveredLead | SavedExportLead) => {
    const target = leadObj || selectedLeadForPitch;
    const payloadLead = target
      ? target
      : {
          companyName: manualCompany.trim() || 'European Martial Arts & Sports Distributor',
          country: manualCountry.trim() || 'Germany',
          city: '',
          buyerType,
          productCategory,
          sourcingSignal: manualSignal.trim() || 'Wholesale importer seeking custom OEM supplier',
          estimatedOrderVolume: '500+ units',
        };

    setAnalysisLoading(true);
    setAnalysisError(null);
    setTtsAudioUrl(null);

    try {
      const res = await fetch('/api/leads/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead: payloadLead,
          exporterProfile: exporterProfile || {
            companyName: 'Sarwar Khawaja Industries Pvt Ltd',
            directorName: 'Khawaja Irfan',
            founderHeritage: 'Sarwar Khawaja',
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed.');
      setAnalysisResult(data.analysis);

      if (target && 'ownerId' in target && target.status !== 'won' && target.status !== 'archived') {
        await onUpdateLeadStatus(
          target.id,
          target.status,
          `Subject: ${data.analysis.emailSubject}\n\n${data.analysis.emailBody}`,
          `${data.analysis.hsCodeAndDuties}\n\n${data.analysis.logisticsRoute}`
        );
      }
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Deep export analysis failed.');
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleStopBrowserSpeech = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setBrowserSpeaking(false);
  };

  const handleGenerateVoiceBriefing = async () => {
    if (browserSpeaking) {
      handleStopBrowserSpeech();
      return;
    }
    const scriptText =
      analysisResult?.voiceBriefingScript ||
      `Executive export briefing for ${exporterProfile?.companyName || 'Sarwar Khawaja Industries Pvt Ltd'}, directed by ${exporterProfile?.directorName || 'Khawaja Irfan'} in Sialkot. Prepare custom OEM samples for karate suits, match footballs, field hockey sticks, hotballs, and full-grain leather jackets.`;

    setTtsLoading(true);
    setTtsError(null);
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: scriptText, voiceName: ttsVoice }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Speech synthesis failed.');
      setTtsAudioUrl(`data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`);
    } catch (err) {
      // Seamless Web Speech fallback when cloud TTS quota is reached
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(scriptText);
        utter.rate = 0.98;
        utter.onend = () => setBrowserSpeaking(false);
        utter.onerror = () => setBrowserSpeaking(false);
        setBrowserSpeaking(true);
        window.speechSynthesis.speak(utter);
        setTtsError('Cloud TTS quota reached — playing briefing via device speech synthesizer.');
      } else {
        setTtsError(err instanceof Error ? err.message : 'Failed to generate audio briefing.');
      }
    } finally {
      setTtsLoading(false);
    }
  };

  const handleCopyText = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(key);
    window.setTimeout(() => setCopiedField(null), 1800);
  };

  const handleExportCsv = () => {
    const headers = [
      'Company',
      'Country',
      'City',
      'Category',
      'Buyer Type',
      'Lead Score',
      'Matched Keyword',
      'Status',
      'Website',
      'Email',
      'Phone',
      'Est Volume',
      'Sourcing Signal',
    ];
    const rows = filteredSavedLeads.map((l) => [
      l.companyName,
      l.country,
      l.city,
      l.productCategory,
      l.buyerType,
      l.leadScore ?? '',
      l.matchedKeyword ?? '',
      l.status,
      l.website,
      l.contactEmail,
      l.contactPhone,
      l.estimatedOrderVolume,
      l.sourcingSignal.replace(/\n/g, ' '),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sarwar-khawaja-export-leads.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      await onSignIn();
      return;
    }
    setRegSaving(true);
    setRegMessage(null);
    try {
      await onSaveProfile({
        companyName: regCompany.trim() || 'Sarwar Khawaja Industries Pvt Ltd',
        directorName: regDirector.trim() || 'Khawaja Irfan',
        founderHeritage: regHeritage.trim(),
        city: regCity.trim() || 'Sialkot, Punjab, Pakistan',
        email: regEmail.trim() || user.email || '',
        phone: regPhone.trim(),
        ntnOrChamberId: regChamberId.trim(),
        specialties: regSpecialties.length > 0 ? regSpecialties : ['Karate Suits', 'Footballs'],
        customOrdersEnabled: regCustomOem,
        minOrderUnits: Math.max(1, Number(regMinOrder) || 100),
      });
      setRegMessage('Exporter profile registered and synced to your workspace.');
    } catch (err) {
      setRegMessage(err instanceof Error ? err.message : 'Unable to save registration.');
    } finally {
      setRegSaving(false);
    }
  };

  const primaryGroup: 'radar' | 'pipeline' | 'outreach' | 'order' | 'hub' =
    activeTab === 'discover' || activeTab === 'maps'
      ? 'radar'
      : activeTab === 'pipeline'
      ? 'pipeline'
      : activeTab === 'outreach' || activeTab === 'chat'
      ? 'outreach'
      : activeTab === 'inquiry'
      ? 'order'
      : 'hub';

  return (
    <aside
      className="fixed top-16 right-0 bottom-0 z-30 w-full md:w-[580px] lg:w-[640px] border-l border-white/12 flex flex-col shadow-2xl"
      style={{ backgroundColor: '#0c121e' }}
      aria-label="Sialkot AI Export Hub Workspace"
    >
      {/* Streamlined 5-Tab Workspace Header */}
      <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-white/10 bg-[#090e18]">
        <div className="flex items-center gap-1 overflow-x-auto">
          {(
            [
              { id: 'radar', label: 'Lead Radar', targetTab: 'discover' as HubTabId },
              { id: 'pipeline', label: `Pipeline (${savedLeads.length})`, targetTab: 'pipeline' as HubTabId },
              { id: 'outreach', label: 'Outreach', targetTab: 'outreach' as HubTabId },
              { id: 'order', label: 'Custom Order', targetTab: 'inquiry' as HubTabId },
              { id: 'hub', label: 'Insights & Hub', targetTab: 'insights' as HubTabId },
            ]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onChangeTab(t.targetTab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                primaryGroup === t.id
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-white/10 transition-colors shrink-0"
          aria-label="Close workspace panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* SUB-NAVIGATION FOR LEAD RADAR (AI Web Search | Google Maps Buyers) */}
        {primaryGroup === 'radar' && (
          <div className="inline-flex rounded-lg border border-white/10 bg-[#090d16] p-1 gap-1">
            <button
              type="button"
              onClick={() => onChangeTab('discover')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'discover'
                  ? 'bg-white/12 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              AI Web Radar
            </button>
            <button
              type="button"
              onClick={() => onChangeTab('maps')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'maps'
                  ? 'bg-white/12 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Local Maps Buyers
            </button>
          </div>
        )}

        {/* SUB-NAVIGATION FOR OUTREACH (Strategy & Voice | AI Export Chat) */}
        {primaryGroup === 'outreach' && (
          <div className="inline-flex rounded-lg border border-white/10 bg-[#090d16] p-1 gap-1">
            <button
              type="button"
              onClick={() => onChangeTab('outreach')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'outreach'
                  ? 'bg-white/12 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Deep Pitch &amp; Voice
            </button>
            <button
              type="button"
              onClick={() => onChangeTab('chat')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'chat'
                  ? 'bg-white/12 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              AI Export Chat
            </button>
          </div>
        )}

        {/* SUB-NAVIGATION FOR INSIGHTS & HUB (Market Insights | Heritage | Exporter ID) */}
        {primaryGroup === 'hub' && (
          <div className="inline-flex rounded-lg border border-white/10 bg-[#090d16] p-1 gap-1">
            <button
              type="button"
              onClick={() => onChangeTab('insights')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'insights'
                  ? 'bg-white/12 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Market Insights
            </button>
            <button
              type="button"
              onClick={() => onChangeTab('heritage')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'heritage'
                  ? 'bg-white/12 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sarwar Heritage
            </button>
            <button
              type="button"
              onClick={() => onChangeTab('register')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'register'
                  ? 'bg-white/12 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Exporter ID
            </button>
          </div>
        )}

        {/* TAB 1A: AI WEB LEAD RADAR */}
        {activeTab === 'discover' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-white">AI Export Lead Radar</h2>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Scans live global buyer demand across Sialkot product lines, verifies domains &amp; contact channels, and ranks opportunities by export fit.
              </p>
            </div>

            {/* Continuous Keyword Scanner Control */}
            <div className="border border-amber-500/25 bg-[#101829] rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-amber-300">
                    Continuous Keyword Scanner
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {autoScanActive
                      ? `Auto-cycling every 45s · Active: "${searchKeyword}"`
                      : lastScannedKeyword
                      ? `Last scanned: "${lastScannedKeyword}"${lastScanAt ? ` · ${lastScanAt}` : ''}`
                      : 'Select a buyer intent keyword or start automated keyword cycling.'}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleToggleAutoScan}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      autoScanActive
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                        : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                    }`}
                  >
                    {autoScanActive ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause Auto-Scan</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>Start Auto-Scan</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={discoverLoading}
                    onClick={handleScanNextKeyword}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-white/10 text-white rounded-md hover:bg-white/15 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                    title="Rotate to next keyword and scan"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${discoverLoading ? 'animate-spin' : ''}`} />
                    <span>Next</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {CONTINUOUS_SCAN_KEYWORDS.map((item, idx) => {
                  const selected = searchKeyword.toLowerCase() === item.keyword.toLowerCase();
                  return (
                    <button
                      key={item.keyword}
                      type="button"
                      onClick={() => {
                        setScanIndex(idx);
                        setSearchKeyword(item.keyword);
                        setProductCategory(item.category);
                        setTargetRegion(item.regionHint);
                      }}
                      className={`px-2.5 py-1 text-[11px] rounded border transition-colors text-left ${
                        selected
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-medium'
                          : 'bg-[#090d16] border-white/10 text-slate-300 hover:text-white'
                      }`}
                    >
                      {item.keyword}
                    </button>
                  );
                })}
              </div>
            </div>

            <form onSubmit={handleDiscover} className="space-y-4 border border-white/10 bg-[#101829] rounded-xl p-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Search Keyword Query
                </label>
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="e.g., buy karate suits, import footballs from Pakistan"
                  className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Export Product Line</label>
                  <select
                    value={productCategory}
                    onChange={(e) => setProductCategory(e.target.value as ProductCategoryId)}
                    className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
                  >
                    {EXPORT_PRODUCTS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                    <option value="custom">Other Custom Sialkot Item</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Buyer Segment</label>
                  <select
                    value={buyerType}
                    onChange={(e) => setBuyerType(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
                  >
                    {BUYER_TYPES.map((bt) => (
                      <option key={bt} value={bt}>
                        {bt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {productCategory === 'custom' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Specify Sialkot Item</label>
                  <input
                    type="text"
                    value={customItemName}
                    onChange={(e) => setCustomItemName(e.target.value)}
                    placeholder="e.g., Boxing gloves, goalkeeper gloves, surgical instruments, gym wear"
                    className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Target Country / Market</label>
                <input
                  type="text"
                  value={targetRegion}
                  onChange={(e) => setTargetRegion(e.target.value)}
                  placeholder="e.g., Germany, UK, USA, UAE, Japan"
                  className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {QUICK_REGIONS.map((reg) => (
                    <button
                      key={reg}
                      type="button"
                      onClick={() => setTargetRegion(reg)}
                      className={`px-2 py-1 text-[11px] rounded border transition-colors whitespace-nowrap shrink-0 ${
                        targetRegion === reg
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                          : 'bg-[#090d16] border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      {reg}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Custom Order / OEM Specs</label>
                <input
                  type="text"
                  value={customSpecs}
                  onChange={(e) => setCustomSpecs(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <button
                type="submit"
                disabled={discoverLoading}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-400 disabled:opacity-60 transition-colors"
              >
                {discoverLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Searching Global Buyers...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Run Keyword Lead Search</span>
                  </>
                )}
              </button>
            </form>

            {discoverError && (
              <div className="p-3 rounded-lg border border-red-500/30 bg-red-950/30 text-xs text-red-200">
                {discoverError}
              </div>
            )}

            {marketSummary && (
              <div className="p-4 rounded-xl border border-white/10 bg-[#101829] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-amber-300">Market Demand Summary</span>
                  {discoveredLeads.length > 0 && (
                    <button
                      type="button"
                      onClick={onShowGlobeWithLeads}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-300 hover:text-sky-200 whitespace-nowrap shrink-0"
                    >
                      <Globe2 className="w-3.5 h-3.5" />
                      <span>Plot on 3D Globe</span>
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{marketSummary}</p>
              </div>
            )}

            {discoveredLeads.length > 0 && (
              <div className="space-y-3">
                {/* Lead Intelligence Filter & Batch Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white">
                    Discovered Leads ({filteredDiscoveredLeads.length}/{discoveredLeads.length})
                  </h3>

                  {unsavedHighFitLeads.length > 0 && (
                    <button
                      type="button"
                      disabled={batchSaving}
                      onClick={() => void handleBatchSaveHighFit()}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/35 rounded-md hover:bg-amber-500/25 disabled:opacity-60 whitespace-nowrap shrink-0"
                    >
                      {batchSaving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <BookmarkPlus className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {user
                          ? `Save Top ${unsavedHighFitLeads.length} (85+)`
                          : `Sign In to Save Top ${unsavedHighFitLeads.length}`}
                      </span>
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={leadFilterText}
                    onChange={(e) => setLeadFilterText(e.target.value)}
                    placeholder="Filter results by buyer, country, or signal..."
                    className="flex-1 px-3 py-1.5 text-xs bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
                  />
                  <div className="flex items-center gap-1 p-0.5 bg-[#090d16] border border-white/10 rounded-lg overflow-x-auto">
                    {(
                      [
                        { id: 'all', label: 'All' },
                        { id: 'high-fit', label: '85+ Fit' },
                        { id: 'has-phone', label: 'Phone/WA' },
                        { id: 'has-email', label: 'Email' },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setLeadFilterMode(f.id)}
                        className={`px-2 py-1 text-[11px] rounded transition-colors whitespace-nowrap shrink-0 ${
                          leadFilterMode === f.id
                            ? 'bg-white/15 text-white font-medium'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredDiscoveredLeads.length === 0 ? (
                  <div className="border border-white/10 bg-[#101829] rounded-xl p-4 text-xs text-slate-400">
                    No discovered leads match the current filter criteria.
                  </div>
                ) : (
                  filteredDiscoveredLeads.map((lead) => {
                    const alreadySaved = savedCompanyKeys.has(
                      `${lead.companyName.toLowerCase()}::${lead.country.toLowerCase()}`
                    );
                    const tariffNote =
                      lead.tariffAdvantage ||
                      getTariffAdvantageForCountry(lead.country, lead.productCategory);
                    const scoreColor =
                      lead.leadScore >= 85
                        ? 'text-emerald-300'
                        : lead.leadScore >= 70
                        ? 'text-amber-300'
                        : 'text-slate-300';
                    return (
                      <div
                        key={lead.id}
                        className="border border-white/10 bg-[#101829] rounded-xl p-4 space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                              <h4 className="text-sm font-semibold text-white">{lead.companyName}</h4>
                              <span className={`text-xs font-mono tabular-nums font-semibold ${scoreColor}`}>
                                Score {lead.leadScore}/100
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-400">
                              <span>{lead.city ? `${lead.city}, ${lead.country}` : lead.country}</span>
                              <span aria-hidden="true">·</span>
                              <span>{lead.buyerType}</span>
                              {lead.estimatedOrderVolume && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono text-amber-300">{lead.estimatedOrderVolume}</span>
                                </>
                              )}
                              <span aria-hidden="true">·</span>
                              <span className="text-sky-300">{tariffNote}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={alreadySaved || savingLeadId === lead.id}
                            onClick={async () => {
                              if (!user) {
                                await onSignIn();
                                return;
                              }
                              setSavingLeadId(lead.id);
                              try {
                                await onSaveLead(lead);
                              } finally {
                                setSavingLeadId(null);
                              }
                            }}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                              alreadySaved
                                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                                : 'bg-white/10 text-white hover:bg-white/15'
                            }`}
                          >
                            {alreadySaved ? (
                              <>
                                <BookmarkCheck className="w-3.5 h-3.5" />
                                <span>Saved</span>
                              </>
                            ) : savingLeadId === lead.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <BookmarkPlus className="w-3.5 h-3.5" />
                                <span>{user ? 'Save' : 'Sign In'}</span>
                              </>
                            )}
                          </button>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">{lead.sourcingSignal}</p>
                        {lead.recentActivity && (
                          <p className="text-xs text-slate-400 leading-relaxed">
                            <span className="text-slate-200 font-medium">Recent Activity: </span>
                            {lead.recentActivity}
                          </p>
                        )}
                        {lead.fitReason && (
                          <p className="text-xs text-slate-400 leading-relaxed">
                            <span className="text-slate-200 font-medium">OEM Angle: </span>
                            {lead.fitReason}
                          </p>
                        )}
                        {lead.scoreReasons && lead.scoreReasons.length > 0 && (
                          <div className="text-[11px] text-slate-400">
                            <span className="text-slate-300 font-medium">Verification: </span>
                            {lead.scoreReasons.join(' · ')}
                          </div>
                        )}

                        <div className="pt-2.5 border-t border-white/10 space-y-2 text-xs">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-400">
                            {lead.website && (
                              <a
                                href={lead.website}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-sky-300 hover:underline"
                              >
                                <span>Website</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                            {lead.contactEmail && (
                              <span className="font-mono text-slate-300">{lead.contactEmail}</span>
                            )}
                            {lead.contactPhone && (
                              <span className="font-mono text-slate-300">{lead.contactPhone}</span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <a
                              href={buildWhatsAppOutreachUrl(
                                lead.contactPhone,
                                buildWhatsAppInquiryMessage(lead, exporterProfile)
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/35 transition-colors whitespace-nowrap shrink-0"
                              title="Open WhatsApp with a pre-filled inquiry message tailored to this buyer's product interest"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>Direct WhatsApp Outreach</span>
                            </a>

                            <button
                              type="button"
                              onClick={() => handleEstimateForLead(lead.country, lead.productCategory)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition-colors whitespace-nowrap shrink-0"
                            >
                              <Calculator className="w-3.5 h-3.5 text-sky-300" />
                              <span>Estimate Duties</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedLeadForPitch(lead);
                                onChangeTab('outreach');
                                void runDeepAnalysis(lead);
                              }}
                              className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 font-medium whitespace-nowrap shrink-0 ml-auto"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Deep Analyze &amp; Pitch</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {groundingSources.length > 0 && (
              <div className="border-t border-white/10 pt-4 space-y-2">
                <h4 className="text-xs font-semibold text-slate-300">
                  Verified Google Search Sources ({groundingSources.length})
                </h4>
                <ul className="space-y-1">
                  {groundingSources.slice(0, 8).map((src, i) => (
                    <li key={`${src.uri}-${i}`} className="text-xs truncate">
                      <a
                        href={src.uri}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-sky-300 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        <span className="truncate">{src.title}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {campaigns.length > 0 && (
              <div className="border-t border-white/10 pt-4 space-y-2">
                <h4 className="text-xs font-semibold text-slate-400">Recent Discovery Runs</h4>
                <div className="space-y-1.5">
                  {campaigns.slice(0, 4).map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between text-xs text-slate-400 py-1 border-b border-white/5"
                    >
                      <span className="truncate">
                        {c.productCategory} · {c.targetRegion}
                      </span>
                      <span className="font-mono text-slate-300 shrink-0 tabular-nums">{c.leadCount} leads</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 1B: BUYER MAP (GOOGLE MAPS GROUNDING) */}
        {activeTab === 'maps' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-white">Local Maps Buyer Locator</h2>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Locate physical sporting goods stores, martial arts schools, and apparel import hubs on Google Maps, then save or pitch them via WhatsApp.
              </p>
            </div>

            <form onSubmit={handleMapsSearch} className="space-y-3 border border-white/10 bg-[#101829] rounded-xl p-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Business Type / Product Focus</label>
                <input
                  type="text"
                  value={mapsQuery}
                  onChange={(e) => setMapsQuery(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-300">Target City / Region</label>
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    className="inline-flex items-center gap-1 text-[11px] text-sky-300 hover:text-sky-200"
                  >
                    <Navigation className="w-3 h-3" />
                    <span>Use My GPS</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={mapsCity}
                  onChange={(e) => {
                    setMapsCity(e.target.value);
                    setMapsLatLng(null);
                  }}
                  placeholder="e.g., London, UK or Tokyo, Japan"
                  className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <button
                type="submit"
                disabled={mapsLoading}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-400 disabled:opacity-60 transition-colors"
              >
                {mapsLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Scanning Google Maps...</span>
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4" />
                    <span>Search Verified Places</span>
                  </>
                )}
              </button>
            </form>

            {mapsError && (
              <div className="p-3 rounded-lg border border-red-500/30 bg-red-950/30 text-xs text-red-200">
                {mapsError}
              </div>
            )}

            {mapsPlaces.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-sm font-semibold text-white">
                  Google Maps Grounded Locations ({mapsPlaces.length})
                </h3>
                {mapsPlaces.map((place, idx) => {
                  const key = `${place.title}-${idx}`;
                  const cityParts = mapsCity.split(',').map((s) => s.trim());
                  const countryGuess = cityParts[1] || cityParts[0] || 'International';
                  const waMessage = buildWhatsAppInquiryMessage(
                    {
                      companyName: place.title,
                      country: countryGuess,
                      city: cityParts[0] || mapsCity,
                      productCategory,
                      matchedKeyword: mapsQuery,
                    },
                    exporterProfile
                  );
                  const alreadySaved = savedCompanyKeys.has(
                    `${place.title.toLowerCase()}::${countryGuess.toLowerCase()}`
                  );
                  return (
                    <div
                      key={key}
                      className="border border-white/10 bg-[#101829] rounded-xl p-3.5 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-white">{place.title}</span>
                        {place.uri && (
                          <a
                            href={place.uri}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-sky-300 hover:underline shrink-0"
                          >
                            <span>Open in Maps</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      {place.reviewSnippets && place.reviewSnippets.length > 0 && (
                        <ul className="space-y-1 text-xs text-slate-400">
                          {place.reviewSnippets.map((snip, sIdx) => (
                            <li key={sIdx}>“{snip}”</li>
                          ))}
                        </ul>
                      )}
                      <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                        <a
                          href={buildWhatsAppOutreachUrl(undefined, waMessage)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/35 transition-colors whitespace-nowrap shrink-0"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Direct WhatsApp Outreach</span>
                        </a>

                        <button
                          type="button"
                          disabled={alreadySaved || savingPlaceKey === key}
                          onClick={() => void handleSaveMapPlace(place, idx)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                            alreadySaved
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                              : 'bg-white/10 text-white hover:bg-white/15'
                          }`}
                        >
                          {alreadySaved ? (
                            <>
                              <BookmarkCheck className="w-3.5 h-3.5" />
                              <span>Saved</span>
                            </>
                          ) : savingPlaceKey === key ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <BookmarkPlus className="w-3.5 h-3.5" />
                              <span>{user ? 'Save to Pipeline' : 'Sign In to Save'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {mapsMarkdown && (
              <div className="border border-white/10 bg-[#101829] rounded-xl p-4 space-y-2">
                <h3 className="text-xs font-semibold text-amber-300">Location Intelligence Notes</h3>
                <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {mapsMarkdown}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PIPELINE CRM */}
        {activeTab === 'pipeline' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-white">Saved Buyer Pipeline</h2>
                <p className="text-xs text-slate-400">
                  Track outreach status, WhatsApp contacts, sample dispatches, and converted export orders.
                </p>
              </div>
              {savedLeads.length > 0 && (
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/10 text-white rounded-lg hover:bg-white/15 whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              )}
            </div>

            {!user ? (
              <div className="border border-white/10 bg-[#101829] rounded-xl p-6 text-center space-y-3">
                <p className="text-sm text-slate-300">
                  Sign in with Google to save discovered leads, generate custom outreach pitches, and manage your Sialkot export pipeline.
                </p>
                <button
                  type="button"
                  onClick={() => void onSignIn()}
                  className="px-4 py-2 text-sm font-semibold bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-400 transition-colors"
                >
                  Sign In with Google
                </button>
              </div>
            ) : (
              <>
                {/* 4-Column Tabular KPI Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="border border-white/10 bg-[#101829] rounded-lg px-3 py-2">
                    <div className="text-[11px] text-slate-400">Saved Buyers</div>
                    <div className="text-base font-bold font-mono tabular-nums text-white">
                      {pipelineKpis.total}
                    </div>
                  </div>
                  <div className="border border-white/10 bg-[#101829] rounded-lg px-3 py-2">
                    <div className="text-[11px] text-slate-400">Avg Lead Score</div>
                    <div className="text-base font-bold font-mono tabular-nums text-amber-300">
                      {pipelineKpis.avgScore}/100
                    </div>
                  </div>
                  <div className="border border-white/10 bg-[#101829] rounded-lg px-3 py-2">
                    <div className="text-[11px] text-slate-400">Active Outreach</div>
                    <div className="text-base font-bold font-mono tabular-nums text-sky-300">
                      {pipelineKpis.activeOutreach}
                    </div>
                  </div>
                  <div className="border border-white/10 bg-[#101829] rounded-lg px-3 py-2">
                    <div className="text-[11px] text-slate-400">Orders Won</div>
                    <div className="text-base font-bold font-mono tabular-nums text-emerald-300">
                      {pipelineKpis.won}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={pipelineSearch}
                    onChange={(e) => setPipelineSearch(e.target.value)}
                    placeholder="Filter by company, country, or signal..."
                    className="flex-1 px-3 py-2 text-xs bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
                  />
                  <select
                    value={pipelineFilter}
                    onChange={(e) => setPipelineFilter(e.target.value as LeadStatus | 'all')}
                    className="px-3 py-2 text-xs bg-[#090d16] border border-white/15 rounded-lg text-white"
                  >
                    <option value="all">All Statuses</option>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                {filteredSavedLeads.length === 0 ? (
                  <div className="border border-white/10 bg-[#101829] rounded-xl p-6 text-center space-y-3">
                    <p className="text-sm text-slate-300">
                      No buyer leads match this view yet. Run a live search in Lead Radar to discover international buyers.
                    </p>
                    <button
                      type="button"
                      onClick={() => onChangeTab('discover')}
                      className="px-4 py-2 text-xs font-semibold bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-400 transition-colors"
                    >
                      Open Lead Radar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredSavedLeads.map((lead) => {
                      const isLocked = lead.status === 'won' || lead.status === 'archived';
                      return (
                        <div
                          key={lead.id}
                          className="border border-white/10 bg-[#101829] rounded-xl p-4 space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex flex-wrap items-baseline gap-2">
                                <h4 className="text-sm font-semibold text-white">{lead.companyName}</h4>
                                {typeof lead.leadScore === 'number' && (
                                  <span className="text-xs font-mono tabular-nums text-amber-300">
                                    Score {lead.leadScore}/100
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400">
                                {lead.city ? `${lead.city}, ${lead.country}` : lead.country} ·{' '}
                                {CATEGORY_LABELS[lead.productCategory] || lead.productCategory}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <select
                                value={lead.status}
                                disabled={isLocked}
                                onChange={(e) =>
                                  void onUpdateLeadStatus(lead.id, e.target.value as LeadStatus)
                                }
                                className="px-2 py-1 text-xs bg-[#090d16] border border-white/15 rounded-md text-amber-300 disabled:opacity-60"
                              >
                                {STATUS_OPTIONS.map((s) => (
                                  <option key={s.value} value={s.value}>
                                    {s.label}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => void onDeleteLead(lead.id)}
                                className="p-1.5 text-slate-400 hover:text-red-400 rounded-md hover:bg-white/5"
                                aria-label="Remove saved lead"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <p className="text-xs text-slate-300 leading-relaxed">{lead.sourcingSignal}</p>

                          <div className="pt-2.5 border-t border-white/10 space-y-2 text-xs">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              {lead.website && (
                                <a
                                  href={lead.website}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-sky-300 hover:underline"
                                >
                                  <span>Website</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                              {lead.contactEmail && (
                                <button
                                  type="button"
                                  onClick={() => handleCopyText(`em_${lead.id}`, lead.contactEmail)}
                                  className="inline-flex items-center gap-1 font-mono text-slate-300 hover:text-white"
                                  title="Copy buyer email"
                                >
                                  <span>{lead.contactEmail}</span>
                                  {copiedField === `em_${lead.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-300" />
                                  ) : (
                                    <Copy className="w-3 h-3 text-slate-400" />
                                  )}
                                </button>
                              )}
                              {lead.contactPhone && (
                                <span className="font-mono text-slate-300">{lead.contactPhone}</span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <a
                                href={buildWhatsAppOutreachUrl(
                                  lead.contactPhone,
                                  buildWhatsAppInquiryMessage(lead, exporterProfile)
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => {
                                  if (lead.status === 'new') {
                                    void onUpdateLeadStatus(lead.id, 'contacted');
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/35 transition-colors whitespace-nowrap shrink-0"
                                title="Open WhatsApp with a pre-filled inquiry message tailored to this buyer's product interest"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>Direct WhatsApp Outreach</span>
                              </a>

                              <button
                                type="button"
                                onClick={() => handleEstimateForLead(lead.country, lead.productCategory)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition-colors whitespace-nowrap shrink-0"
                              >
                                <Calculator className="w-3.5 h-3.5 text-sky-300" />
                                <span>Estimate Duties</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedLeadForPitch(lead);
                                  onChangeTab('outreach');
                                  void runDeepAnalysis(lead);
                                }}
                                className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 font-medium whitespace-nowrap shrink-0 ml-auto"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>{lead.outreachPitch ? 'Refresh Strategy' : 'Draft Pitch'}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* TAB 3A: OUTREACH STUDIO (DEEP REASONING + TTS + BROWSER SPEECH FALLBACK) */}
        {activeTab === 'outreach' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-white">Deep Export Strategy &amp; Voice Studio</h2>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Generates HS codes, destination compliance checklists, FOB Sialkot quotes, tailored outreach pitches, and spoken executive audio briefings.
              </p>
            </div>

            <div className="border border-white/10 bg-[#101829] rounded-xl p-4 space-y-3">
              {selectedLeadForPitch ? (
                <div className="flex items-start justify-between gap-2 pb-2 border-b border-white/10">
                  <div>
                    <div className="text-xs text-amber-300 font-medium">Active Target Buyer</div>
                    <div className="text-sm font-semibold text-white">{selectedLeadForPitch.companyName}</div>
                    <div className="text-xs text-slate-400">
                      {selectedLeadForPitch.country} ·{' '}
                      {CATEGORY_LABELS[selectedLeadForPitch.productCategory] ||
                        selectedLeadForPitch.productCategory}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedLeadForPitch(null)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Switch Buyer
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Buyer Company</label>
                    <input
                      type="text"
                      value={manualCompany}
                      onChange={(e) => setManualCompany(e.target.value)}
                      placeholder="e.g., Budoland Sportartikel GmbH"
                      className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Destination Country</label>
                    <input
                      type="text"
                      value={manualCountry}
                      onChange={(e) => setManualCountry(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-300 mb-1">Product / Custom Order Need</label>
                    <input
                      type="text"
                      value={manualSignal}
                      onChange={(e) => setManualSignal(e.target.value)}
                      placeholder="e.g., 500 heavyweight karate gis + 300 FIFA-spec footballs"
                      className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={analysisLoading}
                  onClick={() => void runDeepAnalysis()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-400 disabled:opacity-60 transition-colors"
                >
                  {analysisLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Reasoning Export Strategy...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate Deep Export Plan</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-1.5 ml-auto">
                  <select
                    value={ttsVoice}
                    onChange={(e) => setTtsVoice(e.target.value as 'Charon' | 'Kore' | 'Puck' | 'Fenrir')}
                    className="px-2 py-2 text-xs bg-[#090d16] border border-white/15 rounded-lg text-slate-200"
                    aria-label="Voice persona"
                  >
                    <option value="Charon">Charon (Executive)</option>
                    <option value="Kore">Kore (Clear)</option>
                    <option value="Puck">Puck (Energetic)</option>
                    <option value="Fenrir">Fenrir (Deep)</option>
                  </select>
                  <button
                    type="button"
                    disabled={ttsLoading}
                    onClick={handleGenerateVoiceBriefing}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white/10 text-white rounded-lg hover:bg-white/15 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                  >
                    {ttsLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : browserSpeaking ? (
                      <Square className="w-3.5 h-3.5 text-red-300" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                    <span>{browserSpeaking ? 'Stop Audio' : 'Speak Briefing'}</span>
                  </button>
                </div>
              </div>
            </div>

            {analysisError && (
              <div className="p-3 rounded-lg border border-red-500/30 bg-red-950/30 text-xs text-red-200">
                {analysisError}
              </div>
            )}

            {ttsError && (
              <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-950/30 text-xs text-amber-200">
                {ttsError}
              </div>
            )}

            {ttsAudioUrl && (
              <div className="border border-amber-500/30 bg-[#121a2d] rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-300">Executive Audio Briefing</span>
                  <a
                    href={ttsAudioUrl}
                    download="sarwar-khawaja-export-briefing.wav"
                    className="text-xs text-sky-300 hover:underline"
                  >
                    Download WAV
                  </a>
                </div>
                <audio controls src={ttsAudioUrl} className="w-full h-9" />
              </div>
            )}

            {analysisResult && (
              <div className="space-y-4">
                <div className="border border-white/10 bg-[#101829] rounded-xl p-4 space-y-3">
                  <div>
                    <h3 className="text-xs font-semibold text-amber-300">HS Code &amp; Import Regulatory Notes</h3>
                    <p className="mt-1 text-xs text-slate-300 leading-relaxed">{analysisResult.hsCodeAndDuties}</p>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-amber-300">Compliance &amp; Quality Checklist</h3>
                    <ul className="mt-1 space-y-1 text-xs text-slate-300 list-disc list-inside">
                      {analysisResult.complianceChecklist.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-amber-300">FOB Sialkot Pricing &amp; MOQ Strategy</h3>
                    <p className="mt-1 text-xs text-slate-300 leading-relaxed">{analysisResult.pricingAndMoqStrategy}</p>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-amber-300">Sialkot Logistics Route</h3>
                    <p className="mt-1 text-xs text-slate-300 leading-relaxed">{analysisResult.logisticsRoute}</p>
                  </div>
                </div>

                <div className="border border-white/10 bg-[#101829] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-white">Executive B2B Cold Email</h3>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyText(
                          'email',
                          `Subject: ${analysisResult.emailSubject}\n\n${analysisResult.emailBody}`
                        )
                      }
                      className="inline-flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200"
                    >
                      {copiedField === 'email' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedField === 'email' ? 'Copied' : 'Copy Email'}</span>
                    </button>
                  </div>
                  <div className="text-xs font-medium text-amber-200">
                    Subject: {analysisResult.emailSubject}
                  </div>
                  <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans leading-relaxed bg-[#090d16] p-3 rounded-lg border border-white/10">
                    {analysisResult.emailBody}
                  </pre>
                </div>

                <div className="border border-white/10 bg-[#101829] rounded-xl p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold text-white">WhatsApp Direct Intro</h3>
                    <div className="flex items-center gap-2">
                      <a
                        href={buildWhatsAppOutreachUrl(
                          selectedLeadForPitch?.contactPhone,
                          analysisResult.whatsappIntro
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/35 transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Direct WhatsApp Outreach</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopyText('wa', analysisResult.whatsappIntro)}
                        className="inline-flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200"
                      >
                        {copiedField === 'wa' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedField === 'wa' ? 'Copied' : 'Copy Message'}</span>
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{analysisResult.whatsappIntro}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3B: MULTI-TURN EXPORT CHATBOT */}
        {activeTab === 'chat' && <ExportChatbotPanel />}

        {/* TAB 4: CUSTOM ORDER & INQUIRY + COST CALCULATOR */}
        {activeTab === 'inquiry' && <CustomOrderPanel user={user} calcPrefill={calcPrefill} />}

        {/* TAB 5A: EXPORT MARKET INSIGHTS SUBSCRIPTION */}
        {activeTab === 'insights' && <ExportInsightsPanel user={user} />}

        {/* TAB 5B: HERITAGE & HISTORY */}
        {activeTab === 'heritage' && (
          <HeritageSection
            onOpenCustomOrder={() => onChangeTab('inquiry')}
            onInspect3DShowroom={onClose}
          />
        )}

        {/* TAB 5C: EXPORTER REGISTRATION */}
        {activeTab === 'register' && (
          <div className="space-y-5">
            <div className="relative rounded-xl overflow-hidden border border-white/10 bg-[#101829]">
              <img
                src="/src/assets/images/sialkot_craft_heritage_1795300341626.jpg"
                alt="Sialkot sports manufacturing atelier"
                referrerPolicy="no-referrer"
                className="w-full h-36 object-cover opacity-75"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0c121e] via-[#0c121e]/65 to-transparent" />
              <div className="relative p-4 -mt-14 flex items-end gap-3">
                <img
                  src="/src/assets/images/sialkot_export_crest_1795300340917.jpg"
                  alt="Sarwar Khawaja Industries Pvt Ltd industrial seal"
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-lg object-cover border border-amber-400/40 shrink-0"
                />
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Sarwar Khawaja Industries Pvt Ltd
                  </h2>
                  <p className="text-xs text-amber-300">
                    Director: Khawaja Irfan · Legacy of Sarwar Khawaja · Sialkot, Pakistan
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleProfileSubmit} className="space-y-3 border border-white/10 bg-[#101829] rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white">Sialkot Exporter Registration</h3>
              <p className="text-xs text-slate-400">
                Register your manufacturing company details so AI buyer pitches, WhatsApp templates, and compliance briefs reflect your factory credentials.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">Company Name</label>
                  <input
                    type="text"
                    required
                    value={regCompany}
                    onChange={(e) => setRegCompany(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Managing Director</label>
                  <input
                    type="text"
                    required
                    value={regDirector}
                    onChange={(e) => setRegDirector(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Founder Lineage</label>
                  <input
                    type="text"
                    value={regHeritage}
                    onChange={(e) => setRegHeritage(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">City / Industrial Zone</label>
                  <input
                    type="text"
                    required
                    value={regCity}
                    onChange={(e) => setRegCity(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Business Email</label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">WhatsApp / Phone</label>
                  <input
                    type="text"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="+92 300 ..."
                    className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">SCCI / NTN ID</label>
                  <input
                    type="text"
                    value={regChamberId}
                    onChange={(e) => setRegChamberId(e.target.value)}
                    placeholder="Sialkot Chamber Reg #"
                    className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Default MOQ (Units)</label>
                  <input
                    type="number"
                    min={1}
                    max={1000000}
                    value={regMinOrder}
                    onChange={(e) => setRegMinOrder(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={regCustomOem}
                      onChange={(e) => setRegCustomOem(e.target.checked)}
                      className="accent-amber-500"
                    />
                    <span>Custom OEM Orders Available</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Manufacturing Specialties</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Karate Suits',
                    'Footballs',
                    'Field Hockey Sticks',
                    'Hotballs',
                    'Apparels & Leather Jackets',
                    'Martial Arts Belts',
                    'Custom Teamwear',
                  ].map((item) => {
                    const active = regSpecialties.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() =>
                          setRegSpecialties((prev) =>
                            active
                              ? prev.length > 1
                                ? prev.filter((x) => x !== item)
                                : prev
                              : prev.length < 10
                              ? [...prev, item]
                              : prev
                          )
                        }
                        className={`px-2.5 py-1 text-xs rounded border transition-colors whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                            : 'bg-[#090d16] border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={regSaving}
                className="w-full px-4 py-2.5 text-sm font-semibold bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-400 disabled:opacity-60 transition-colors"
              >
                {regSaving
                  ? 'Saving Registration...'
                  : user
                  ? 'Save Sialkot Exporter Profile'
                  : 'Sign In with Google to Register'}
              </button>

              {regMessage && (
                <div className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-950/30 text-xs text-amber-200">
                  {regMessage}
                </div>
              )}
            </form>
          </div>
        )}
      </div>
    </aside>
  );
};
