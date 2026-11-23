import React, { useEffect, useState } from 'react';
import { Check, CheckCircle2, Copy, FileText, Loader2, MailCheck, Pause, Play, RefreshCw } from 'lucide-react';
import { User } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { EXPORT_PRODUCTS } from '../data/sialkotCatalog.ts';
import { db, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import { InsightSubscription } from '../types/exportHub.ts';
import { MicTranscribeButton } from './MicTranscribeButton.tsx';

interface ExportInsightsPanelProps {
  user: User | null;
}

const PRODUCT_OPTIONS = [
  ...EXPORT_PRODUCTS.map((p) => p.shortLabel),
  'Custom Sports & Leather Goods',
];

const REGION_OPTIONS = [
  'Europe & DACH',
  'United Kingdom',
  'United States',
  'UAE & GCC',
  'Japan & East Asia',
  'Australia & Oceania',
];

const ROLE_OPTIONS = [
  'Sialkot Exporter / Manufacturer',
  'International Buyer / Importer',
  'Sports Brand / Private Label',
  'Martial Arts Federation / Club',
];

export const ExportInsightsPanel: React.FC<ExportInsightsPanelProps> = ({ user }) => {
  const [subscriberName, setSubscriberName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState(ROLE_OPTIONS[0]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'Karate Suits',
    'Footballs',
    'Apparel & Leather',
  ]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([
    'Europe & DACH',
    'United Kingdom',
  ]);
  const [focusNotes, setFocusNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeReportSub, setActiveReportSub] = useState<InsightSubscription | null>(null);
  const [subscriptions, setSubscriptions] = useState<InsightSubscription[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);

  useEffect(() => {
    if (user) {
      setSubscriberName((prev) => prev || user.displayName || '');
      setEmail((prev) => prev || user.email || '');
    }
  }, [user]);

  useEffect(() => {
    const loadSubs = async () => {
      setLoadingSubs(true);
      try {
        const res = await fetch('/api/insights/subscriptions');
        const data = await res.json();
        if (res.ok && Array.isArray(data.subscriptions)) {
          setSubscriptions(data.subscriptions);
          if (data.subscriptions.length > 0) {
            setActiveReportSub((prev) => prev || data.subscriptions[0]);
          }
        }
      } catch {
        // ignore initial load error
      } finally {
        setLoadingSubs(false);
      }
    };
    void loadSubs();
  }, []);

  const toggleItem = (list: string[], value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCategories.length === 0 || selectedRegions.length === 0) {
      setError('Select at least one Sialkot product line and one target export region.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/insights/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriberName,
          email,
          companyName,
          role,
          productCategories: selectedCategories,
          targetRegions: selectedRegions,
          focusNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to activate Export Market Insights subscription.');
      }

      const created: InsightSubscription = data.subscription;
      setSubscriptions((prev) => [created, ...prev]);
      setActiveReportSub(created);

      // Sync to Firestore when signed in
      if (user) {
        const subId = created.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
        try {
          await setDoc(doc(db, 'insightSubscriptions', subId), {
            ownerId: user.uid,
            subscriberName: created.subscriberName.slice(0, 100),
            email: created.email.slice(0, 120),
            companyName: created.companyName.slice(0, 140),
            role: created.role.slice(0, 80),
            productCategories: created.productCategories.slice(0, 8),
            targetRegions: created.targetRegions.slice(0, 8),
            frequency: 'weekly',
            focusNotes: created.focusNotes.slice(0, 800),
            latestReportSummary: `${created.latestReport.headline}: ${created.latestReport.executiveSummary}`.slice(0, 3000),
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (fsErr) {
          try {
            handleFirestoreError(fsErr, OperationType.CREATE, `insightSubscriptions/${subId}`);
          } catch {
            // Keep backend subscription active while logging structured context above
          }
        }
      }

      setFocusNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to subscribe right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefreshIssue = async (id: string) => {
    setRefreshingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/insights/refresh/${id}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to generate next weekly issue.');
      const updated: InsightSubscription = data.subscription;
      setSubscriptions((prev) => prev.map((s) => (s.id === id ? updated : s)));
      setActiveReportSub(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh report.');
    } finally {
      setRefreshingId(null);
    }
  };

  const handleToggleStatus = async (sub: InsightSubscription) => {
    const nextStatus = sub.status === 'active' ? 'paused' : 'active';
    try {
      const res = await fetch(`/api/insights/subscriptions/${sub.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setSubscriptions((prev) => prev.map((s) => (s.id === sub.id ? data.subscription : s)));
        if (activeReportSub?.id === sub.id) {
          setActiveReportSub(data.subscription);
        }
      }
    } catch {
      // ignore transient error
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Export Market Insights</h2>
        <p className="mt-1 text-xs text-slate-400 leading-relaxed">
          Subscribe to weekly AI-generated briefings tracking global buyer demand, import seasonality, and Sialkot FOB pricing across sports, martial arts, and leather apparel.
        </p>
      </div>

      {/* Subscription Form */}
      <form onSubmit={handleSubscribe} className="space-y-4 border border-white/10 bg-[#101829] rounded-xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={subscriberName}
              onChange={(e) => setSubscriberName(e.target.value)}
              placeholder="e.g., Khawaja Irfan"
              className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Email for Weekly Reports</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="export@sarwarkhawaja.com"
              className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Company / Organization</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Sarwar Khawaja Industries Pvt Ltd"
              className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Subscriber Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Sialkot Product Lines Covered
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PRODUCT_OPTIONS.map((cat) => {
              const active = selectedCategories.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleItem(selectedCategories, cat, setSelectedCategories)}
                  className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                    active
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-medium'
                      : 'bg-[#090d16] border-white/15 text-slate-300 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Target Global Markets
          </label>
          <div className="flex flex-wrap gap-1.5">
            {REGION_OPTIONS.map((reg) => {
              const active = selectedRegions.includes(reg);
              return (
                <button
                  key={reg}
                  type="button"
                  onClick={() => toggleItem(selectedRegions, reg, setSelectedRegions)}
                  className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                    active
                      ? 'bg-sky-500/20 border-sky-400 text-sky-200 font-medium'
                      : 'bg-[#090d16] border-white/15 text-slate-300 hover:text-white'
                  }`}
                >
                  {reg}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <label className="text-xs font-medium text-slate-300">
              Custom Demand Focus Notes (Optional)
            </label>
            <MicTranscribeButton
              compact
              label="Dictate Focus"
              contextHint="Sialkot export market insights focus notes"
              onTranscript={(t) => setFocusNotes((prev) => (prev ? `${prev} ${t}` : t))}
            />
          </div>
          <textarea
            rows={2}
            value={focusNotes}
            onChange={(e) => setFocusNotes(e.target.value)}
            placeholder="e.g., Track Q3 club kit tenders in Germany and full-grain varsity leather demand in UK..."
            className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
          />
        </div>

        {error && (
          <div className="p-3 rounded-lg border border-red-500/30 bg-red-950/30 text-xs text-red-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-400 disabled:opacity-60 transition-colors"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Generating Weekly AI Report...</span>
            </>
          ) : (
            <>
              <MailCheck className="w-4 h-4" />
              <span>Subscribe &amp; Generate Weekly Report</span>
            </>
          )}
        </button>
      </form>

      {/* Active Weekly AI Report Preview */}
      {activeReportSub?.latestReport && (
        <div className="border border-amber-500/30 bg-[#101829] rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  Weekly Report {activeReportSub.latestReport.issueNumber} · {activeReportSub.email}
                </span>
              </div>
              <h3 className="mt-1 text-sm font-semibold text-white">
                {activeReportSub.latestReport.headline}
              </h3>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const r = activeReportSub.latestReport;
                  const summaryText = `${r.issueNumber} — ${r.headline}\n\n${r.executiveSummary}\n\n${r.topDemandSignals
                    .map((s) => `• ${s.category} (${s.region}): ${s.trend} — Action: ${s.recommendedAction}`)
                    .join('\n')}\n\nPricing Watch: ${r.sialkotPricingWatch}`;
                  navigator.clipboard?.writeText(summaryText);
                  setCopiedReport(true);
                  window.setTimeout(() => setCopiedReport(false), 1800);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-white/10 text-sky-300 rounded-md hover:bg-white/15 whitespace-nowrap shrink-0"
              >
                {copiedReport ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedReport ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                type="button"
                disabled={refreshingId === activeReportSub.id}
                onClick={() => void handleRefreshIssue(activeReportSub.id)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-white/10 text-white rounded-md hover:bg-white/15 disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshingId === activeReportSub.id ? 'animate-spin' : ''}`} />
                <span>New Issue</span>
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-200 leading-relaxed">
            {activeReportSub.latestReport.executiveSummary}
          </p>

          {activeReportSub.latestReport.topDemandSignals?.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-300">Global Demand Signals</div>
              {activeReportSub.latestReport.topDemandSignals.map((sig, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-white/10 bg-[#090d16] p-3 space-y-1"
                >
                  <div className="text-xs font-semibold text-amber-300">
                    {sig.category} · {sig.region}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{sig.trend}</p>
                  <p className="text-[11px] text-sky-300 leading-relaxed">
                    Action: {sig.recommendedAction}
                  </p>
                </div>
              ))}
            </div>
          )}

          {activeReportSub.latestReport.sialkotPricingWatch && (
            <div className="pt-2 border-t border-white/10 text-xs text-slate-300 leading-relaxed">
              <span className="font-semibold text-white">Sialkot Material &amp; FOB Watch: </span>
              {activeReportSub.latestReport.sialkotPricingWatch}
            </div>
          )}
        </div>
      )}

      {/* Active Subscriptions List */}
      <div className="space-y-2.5 border-t border-white/10 pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">
            Subscribed Briefings ({subscriptions.length})
          </h3>
          {loadingSubs && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
        </div>

        {subscriptions.length === 0 ? (
          <div className="border border-white/10 bg-[#101829] rounded-xl p-4 text-xs text-slate-400">
            No weekly market report subscriptions yet. Sign up above to receive your first AI-generated demand briefing.
          </div>
        ) : (
          <div className="space-y-2">
            {subscriptions.map((sub) => (
              <div
                key={sub.id}
                className="border border-white/10 bg-[#101829] rounded-xl p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white truncate">
                    {sub.subscriberName} · {sub.email}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {sub.productCategories.join(', ')} · {sub.targetRegions.join(', ')}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveReportSub(sub)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-white/10 text-white rounded hover:bg-white/15"
                  >
                    <FileText className="w-3 h-3" />
                    <span>Read</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleToggleStatus(sub)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded border ${
                      sub.status === 'active'
                        ? 'bg-emerald-950/60 border-emerald-500/35 text-emerald-300'
                        : 'bg-slate-900 border-white/15 text-slate-400'
                    }`}
                  >
                    {sub.status === 'active' ? (
                      <>
                        <Pause className="w-3 h-3" />
                        <span>Active</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3" />
                        <span>Paused</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
