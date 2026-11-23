import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { EXPORT_PRODUCTS, TARGET_HUB_MARKETS } from './data/sialkotCatalog.ts';
import {
  auth,
  db,
  googleAuthProvider,
  handleFirestoreError,
  OperationType,
} from './lib/firebase.ts';
import { BottomDock } from './components/BottomDock.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { ExportHubDrawer, HubTabId } from './components/ExportHubDrawer.tsx';
import { CameraPresetId, ShowroomCanvas } from './components/ShowroomCanvas.tsx';
import {
  DiscoveredLead,
  ExporterProfile,
  GroundingSource,
  LeadStatus,
  ProductCategoryId,
  ProductFinishOption,
  SavedExportLead,
  SceneSubjectId,
  SearchCampaign,
} from './types/exportHub.ts';

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

function HubShell() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // 3D Showroom state
  const [subjectId, setSubjectId] = useState<SceneSubjectId>('karate-suits');
  const [selectedFinish, setSelectedFinish] = useState<ProductFinishOption>(
    EXPORT_PRODUCTS[0].finishes[0]
  );
  const [explodeAmount, setExplodeAmount] = useState(0);
  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>('hero');
  const [cameraPresetTrigger, setCameraPresetTrigger] = useState(0);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [inspectedPartKey, setInspectedPartKey] = useState<string | null>(null);

  // Workspace drawer state
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<HubTabId>('discover');

  // Data state
  const [exporterProfile, setExporterProfile] = useState<ExporterProfile | null>(null);
  const [discoveredLeads, setDiscoveredLeads] = useState<DiscoveredLead[]>([]);
  const [groundingSources, setGroundingSources] = useState<GroundingSource[]>([]);
  const [marketSummary, setMarketSummary] = useState('');
  const [savedLeads, setSavedLeads] = useState<SavedExportLead[]>([]);
  const [campaigns, setCampaigns] = useState<SearchCampaign[]>([]);

  // Keyboard shortcut 'H' to toggle 3D bottom dock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key.toLowerCase() === 'h') {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Firestore real-time listeners when authenticated
  useEffect(() => {
    if (!authReady || !user) {
      setExporterProfile(null);
      setSavedLeads([]);
      setCampaigns([]);
      return;
    }

    const profilePath = `exporters/${user.uid}`;
    const unsubProfile = onSnapshot(
      doc(db, 'exporters', user.uid),
      (snap) => {
        if (snap.exists()) {
          setExporterProfile(snap.data() as ExporterProfile);
        } else {
          setExporterProfile(null);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, profilePath);
      }
    );

    const leadsQuery = query(collection(db, 'leads'), where('ownerId', '==', user.uid));
    const unsubLeads = onSnapshot(
      leadsQuery,
      (snap) => {
        const list: SavedExportLead[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SavedExportLead, 'id'>),
        }));
        setSavedLeads(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'leads');
      }
    );

    const campaignsQuery = query(collection(db, 'campaigns'), where('ownerId', '==', user.uid));
    const unsubCampaigns = onSnapshot(
      campaignsQuery,
      (snap) => {
        const list: SearchCampaign[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SearchCampaign, 'id'>),
        }));
        setCampaigns(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'campaigns');
      }
    );

    return () => {
      unsubProfile();
      unsubLeads();
      unsubCampaigns();
    };
  }, [authReady, user]);

  const handleSignIn = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google sign-in was cancelled or blocked.');
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut(auth);
  }, []);

  const handleSelectSubject = useCallback((id: SceneSubjectId) => {
    setSubjectId(id);
    setInspectedPartKey(null);
    const prod = EXPORT_PRODUCTS.find((p) => p.id === id);
    if (prod) {
      setSelectedFinish(prod.finishes[0]);
    }
  }, []);

  const handleSelectCameraPreset = (preset: CameraPresetId) => {
    setCameraPreset(preset);
    setCameraPresetTrigger((c) => c + 1);
  };

  const handleSaveProfile = async (
    profileData: Omit<ExporterProfile, 'uid' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!user) return;
    const path = `exporters/${user.uid}`;
    const ref = doc(db, 'exporters', user.uid);
    try {
      if (exporterProfile) {
        await updateDoc(ref, {
          companyName: profileData.companyName.slice(0, 140),
          directorName: profileData.directorName.slice(0, 80),
          founderHeritage: profileData.founderHeritage.slice(0, 120),
          city: profileData.city.slice(0, 80),
          email: profileData.email.slice(0, 120),
          phone: profileData.phone.slice(0, 40),
          ntnOrChamberId: profileData.ntnOrChamberId.slice(0, 60),
          specialties: profileData.specialties.slice(0, 10),
          customOrdersEnabled: Boolean(profileData.customOrdersEnabled),
          minOrderUnits: Math.max(1, Math.min(1000000, Number(profileData.minOrderUnits) || 100)),
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(ref, {
          uid: user.uid,
          companyName: profileData.companyName.slice(0, 140),
          directorName: profileData.directorName.slice(0, 80),
          founderHeritage: profileData.founderHeritage.slice(0, 120),
          city: profileData.city.slice(0, 80),
          email: profileData.email.slice(0, 120),
          phone: profileData.phone.slice(0, 40),
          ntnOrChamberId: profileData.ntnOrChamberId.slice(0, 60),
          specialties: profileData.specialties.slice(0, 10),
          customOrdersEnabled: Boolean(profileData.customOrdersEnabled),
          minOrderUnits: Math.max(1, Math.min(1000000, Number(profileData.minOrderUnits) || 100)),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const handleLeadsDiscovered = useCallback(
    async (
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
    ) => {
      if (appendMode) {
        setDiscoveredLeads((prev) => {
          const merged = new Map<string, DiscoveredLead>();
          for (const item of prev) {
            merged.set(`${item.companyName.toLowerCase()}::${item.country.toLowerCase()}`, item);
          }
          for (const item of leads) {
            const key = `${item.companyName.toLowerCase()}::${item.country.toLowerCase()}`;
            const existing = merged.get(key);
            if (!existing || item.leadScore > existing.leadScore) {
              merged.set(key, item);
            }
          }
          return Array.from(merged.values()).sort((a, b) => b.leadScore - a.leadScore);
        });
        setGroundingSources((prev) => {
          const seen = new Set(prev.map((s) => s.uri));
          const added = sources.filter((s) => !seen.has(s.uri));
          return [...added, ...prev].slice(0, 30);
        });
      } else {
        setDiscoveredLeads(leads);
        setGroundingSources(sources);
      }
      setMarketSummary(summary);

      // Sync 3D Showroom subject to match searched category
      if (campaignMeta.productCategory !== 'custom') {
        handleSelectSubject(campaignMeta.productCategory);
      }

      if (user) {
        const campaignId = sanitizeId(`camp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
        try {
          await setDoc(doc(db, 'campaigns', campaignId), {
            ownerId: user.uid,
            productCategory: campaignMeta.productCategory.slice(0, 80),
            targetRegion: campaignMeta.targetRegion.slice(0, 80),
            buyerType: campaignMeta.buyerType.slice(0, 80),
            customSpecs: campaignMeta.customSpecs.slice(0, 400),
            leadCount: Math.min(500, leads.length),
            summary: summary.slice(0, 1500),
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `campaigns/${campaignId}`);
        }
      }
    },
    [handleSelectSubject, user]
  );

  const handleSaveLead = async (lead: DiscoveredLead) => {
    if (!user) return;
    const leadId = sanitizeId(`lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    const path = `leads/${leadId}`;
    const combinedNotes = [
      lead.recentActivity ? `Recent Activity: ${lead.recentActivity}` : '',
      lead.fitReason || '',
    ]
      .filter(Boolean)
      .join('\n')
      .slice(0, 4000);
    const clampedScore =
      typeof lead.leadScore === 'number' && Number.isFinite(lead.leadScore)
        ? Math.max(0, Math.min(100, Math.round(lead.leadScore)))
        : 75;

    try {
      await setDoc(doc(db, 'leads', leadId), {
        ownerId: user.uid,
        companyName: lead.companyName.slice(0, 160),
        country: lead.country.slice(0, 80),
        city: (lead.city || '').slice(0, 80),
        buyerType: lead.buyerType.slice(0, 80),
        productCategory: lead.productCategory,
        website: (lead.website || '').slice(0, 300),
        contactEmail: (lead.contactEmail || '').slice(0, 120),
        contactPhone: (lead.contactPhone || '').slice(0, 60),
        sourcingSignal: lead.sourcingSignal.slice(0, 1000),
        estimatedOrderVolume: (lead.estimatedOrderVolume || '').slice(0, 120),
        leadScore: clampedScore,
        matchedKeyword: (lead.matchedKeyword || '').slice(0, 120),
        status: 'new',
        sourceUri: (lead.sourceUri || '').slice(0, 400),
        sourceTitle: (lead.sourceTitle || '').slice(0, 240),
        outreachPitch: '',
        strategyNotes: combinedNotes,
        lat: typeof lead.lat === 'number' ? Math.max(-90, Math.min(90, lead.lat)) : 48.1351,
        lng: typeof lead.lng === 'number' ? Math.max(-180, Math.min(180, lead.lng)) : 11.582,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const handleUpdateLeadStatus = async (
    leadId: string,
    status: LeadStatus,
    pitch?: string,
    notes?: string
  ) => {
    if (!user) return;
    const existing = savedLeads.find((l) => l.id === leadId);
    if (!existing) return;
    const path = `leads/${leadId}`;
    try {
      await updateDoc(doc(db, 'leads', leadId), {
        status,
        outreachPitch: (pitch !== undefined ? pitch : existing.outreachPitch || '').slice(0, 4000),
        strategyNotes: (notes !== undefined ? notes : existing.strategyNotes || '').slice(0, 4000),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!user) return;
    const path = `leads/${leadId}`;
    try {
      await deleteDoc(doc(db, 'leads', leadId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const activeProduct = useMemo(
    () => EXPORT_PRODUCTS.find((p) => p.id === subjectId),
    [subjectId]
  );

  const inspectedPart = useMemo(() => {
    if (!inspectedPartKey || !activeProduct) return null;
    return activeProduct.inspectableParts.find((p) => p.partKey === inspectedPartKey) || null;
  }, [inspectedPartKey, activeProduct]);

  const openWorkspaceTab = (tab: HubTabId) => {
    setActiveTab(tab);
    setDrawerOpen(true);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#090d16] text-slate-100">
      {/* Top Bar Contract: 1 row, 3 zones separated by gap-8 */}
      <header
        className="fixed top-0 left-0 right-0 z-40 h-16 px-6 border-b border-white/10 flex items-center justify-between gap-8"
        style={{ backgroundColor: 'rgba(9, 13, 22, 0.94)' }}
      >
        {/* Zone 1: Single-line Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setDrawerOpen(false);
          }}
          className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          Sarwar Khawaja Industries
        </a>

        {/* Zone 2: Clean Single-Line Nav Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              !drawerOpen ? 'text-amber-300 underline' : ''
            }`}
          >
            3D Showroom
          </button>
          <button
            type="button"
            onClick={() => openWorkspaceTab('discover')}
            className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              drawerOpen && (activeTab === 'discover' || activeTab === 'maps')
                ? 'text-amber-300 underline'
                : ''
            }`}
          >
            Lead Radar
          </button>
          <button
            type="button"
            onClick={() => openWorkspaceTab('pipeline')}
            className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 tabular-nums ${
              drawerOpen && activeTab === 'pipeline' ? 'text-amber-300 underline' : ''
            }`}
          >
            {savedLeads.length > 0 ? `Pipeline (${savedLeads.length})` : 'Pipeline'}
          </button>
          <button
            type="button"
            onClick={() => openWorkspaceTab('inquiry')}
            className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              drawerOpen && activeTab === 'inquiry' ? 'text-amber-300 underline' : ''
            }`}
          >
            Custom Order
          </button>
          <button
            type="button"
            onClick={() => openWorkspaceTab('insights')}
            className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              drawerOpen && (activeTab === 'insights' || activeTab === 'heritage' || activeTab === 'register')
                ? 'text-amber-300 underline'
                : ''
            }`}
          >
            Market Insights
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          {user ? (
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="px-4 py-2 text-xs font-medium text-slate-200 bg-white/10 rounded-lg hover:bg-white/15 transition-colors whitespace-nowrap shrink-0"
              title={`Signed in as ${user.email || 'Exporter'}`}
            >
              Sign Out
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleSignIn()}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 rounded-lg hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Full-Bleed 3D WebGL Viewport */}
      <main className="w-full h-full pt-16">
        <ShowroomCanvas
          subjectId={subjectId}
          finish={selectedFinish}
          explodeAmount={explodeAmount}
          cameraPreset={cameraPreset}
          cameraPresetTrigger={cameraPresetTrigger}
          leads={discoveredLeads}
          onPartSelect={setInspectedPartKey}
          drawerOpen={drawerOpen}
        />
      </main>

      {/* Top-Left Compact Spec Card (Solid/rgba surface, zero backdrop-filter) */}
      <div
        className={`fixed top-20 left-5 z-20 max-w-xs rounded-xl border border-white/12 p-4 pointer-events-auto ${
          drawerOpen ? 'hidden lg:block' : 'block'
        }`}
        style={{ backgroundColor: 'rgba(11, 16, 27, 0.92)' }}
      >
        {activeProduct ? (
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-amber-300">
              Sialkot Custom Export Line · HS {activeProduct.hsCode}
            </div>
            <h1 className="text-base font-semibold text-white leading-snug text-balance">
              {activeProduct.name}
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed">{activeProduct.materials}</p>
            <div className="pt-1.5 border-t border-white/10 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
              <span>MOQ: {activeProduct.moq}</span>
              <span aria-hidden="true">·</span>
              <span>{activeProduct.leadTime}</span>
            </div>
            {inspectedPart && (
              <div className="mt-2 pt-2 border-t border-amber-500/30 space-y-0.5">
                <div className="text-xs font-semibold text-amber-300">{inspectedPart.title}</div>
                <p className="text-[11px] text-slate-300 leading-relaxed">{inspectedPart.spec}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-amber-300">
              Sialkot Origin · 32.4945° N, 74.5229° E
            </div>
            <h1 className="text-base font-semibold text-white leading-snug text-balance">
              Global Export Trade Network
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              {discoveredLeads.length > 0
                ? `Displaying ${discoveredLeads.length} live discovered buyer routes from Sialkot.`
                : `Showing ${TARGET_HUB_MARKETS.length} core export corridors. Run Lead Radar to plot custom buyers.`}
            </p>
          </div>
        )}

        {authError && (
          <div className="mt-2 p-2 rounded bg-red-950/60 border border-red-500/30 text-[11px] text-red-200">
            {authError}
          </div>
        )}

        {!drawerOpen && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openWorkspaceTab('discover')}
              className="px-3 py-1.5 text-xs font-semibold bg-amber-500 text-slate-950 rounded-md hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0"
            >
              Find Export Leads
            </button>
            <button
              type="button"
              onClick={() => openWorkspaceTab('inquiry')}
              className="px-3 py-1.5 text-xs font-medium bg-white/10 text-white rounded-md hover:bg-white/15 transition-colors whitespace-nowrap shrink-0"
            >
              Custom Order
            </button>
            <button
              type="button"
              onClick={() => openWorkspaceTab('insights')}
              className="px-3 py-1.5 text-xs font-medium bg-white/10 text-white rounded-md hover:bg-white/15 transition-colors whitespace-nowrap shrink-0"
            >
              Market Insights
            </button>
            <button
              type="button"
              onClick={() => openWorkspaceTab('chat')}
              className="px-3 py-1.5 text-xs font-medium bg-white/10 text-white rounded-md hover:bg-white/15 transition-colors whitespace-nowrap shrink-0"
            >
              AI Chat
            </button>
            <button
              type="button"
              onClick={() => openWorkspaceTab('heritage')}
              className="px-3 py-1.5 text-xs font-medium bg-white/10 text-white rounded-md hover:bg-white/15 transition-colors whitespace-nowrap shrink-0"
            >
              Heritage
            </button>
          </div>
        )}
      </div>

      {/* Collapsible Bottom 3D Control Dock (hidden on narrow viewports while drawer is open) */}
      <div className={drawerOpen ? 'hidden md:block' : 'block'}>
        <BottomDock
          subjectId={subjectId}
          onSelectSubject={handleSelectSubject}
          selectedFinish={selectedFinish}
          onSelectFinish={setSelectedFinish}
          explodeAmount={explodeAmount}
          onChangeExplode={setExplodeAmount}
          cameraPreset={cameraPreset}
          onSelectCameraPreset={handleSelectCameraPreset}
          collapsed={dockCollapsed}
          onToggleCollapse={() => setDockCollapsed((c) => !c)}
        />
      </div>

      {/* Right B2B Export Hub Workspace Drawer */}
      <ExportHubDrawer
        open={drawerOpen}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onClose={() => setDrawerOpen(false)}
        user={user}
        onSignIn={handleSignIn}
        exporterProfile={exporterProfile}
        onSaveProfile={handleSaveProfile}
        discoveredLeads={discoveredLeads}
        onLeadsDiscovered={handleLeadsDiscovered}
        groundingSources={groundingSources}
        marketSummary={marketSummary}
        savedLeads={savedLeads}
        campaigns={campaigns}
        onSaveLead={handleSaveLead}
        onUpdateLeadStatus={handleUpdateLeadStatus}
        onDeleteLead={handleDeleteLead}
        onShowGlobeWithLeads={() => {
          setSubjectId('export-globe');
          setDrawerOpen(false);
          handleSelectCameraPreset('hero');
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <HubShell />
    </ErrorBoundary>
  );
}
