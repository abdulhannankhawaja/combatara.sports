import React, { useEffect, useState } from 'react';
import { CheckCircle2, ImagePlus, Loader2, Send, Trash2 } from 'lucide-react';
import { User } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { EXPORT_PRODUCTS } from '../data/sialkotCatalog.ts';
import { db, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import { CustomOrderInquiry, InquiryStatus, ProductCategoryId } from '../types/exportHub.ts';
import { CostCalculator } from './CostCalculator.tsx';
import { MicTranscribeButton } from './MicTranscribeButton.tsx';

interface CustomOrderPanelProps {
  user: User | null;
  calcPrefill?: {
    country?: string;
    category?: ProductCategoryId;
    nonce: number;
  } | null;
}

const PRODUCT_CHOICES = [
  ...EXPORT_PRODUCTS.map((p) => p.name),
  'Custom Sialkot Sports / Apparel Item',
];

const INQUIRY_STATUS_OPTIONS: { value: InquiryStatus; label: string }[] = [
  { value: 'received', label: 'Received' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'sample_prepared', label: 'Sample Prepared' },
  { value: 'closed', label: 'Closed' },
];

async function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format.'));
      img.onload = () => {
        const maxDim = 640;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unavailable.'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export const CustomOrderPanel: React.FC<CustomOrderPanelProps> = ({ user, calcPrefill }) => {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    EXPORT_PRODUCTS[0].name,
  ]);
  const [quantity, setQuantity] = useState(250);
  const [customizationDetails, setCustomizationDetails] = useState('');
  const [buyerName, setBuyerName] = useState(user?.displayName || '');
  const [companyName, setCompanyName] = useState('');
  const [country, setCountry] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [referenceImages, setReferenceImages] = useState<{ name: string; dataUrl: string }[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedRecord, setSubmittedRecord] = useState<CustomOrderInquiry | null>(null);

  const [routedInquiries, setRoutedInquiries] = useState<CustomOrderInquiry[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState<'form' | 'calculator'>('form');

  useEffect(() => {
    if (calcPrefill && calcPrefill.nonce > 0) {
      setWorkspaceMode('calculator');
      if (calcPrefill.country) {
        setCountry(calcPrefill.country);
      }
    }
  }, [calcPrefill]);

  const loadBackendInquiries = async () => {
    setLoadingQueue(true);
    try {
      const res = await fetch('/api/inquiries');
      const data = await res.json();
      if (res.ok && Array.isArray(data.inquiries)) {
        setRoutedInquiries(data.inquiries);
      }
    } catch {
      // ignore initial queue fetch errors
    } finally {
      setLoadingQueue(false);
    }
  };

  useEffect(() => {
    void loadBackendInquiries();
  }, []);

  const handleToggleCategory = (label: string) => {
    setSelectedCategories((prev) =>
      prev.includes(label) ? prev.filter((c) => c !== label) : [...prev, label]
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 3 - referenceImages.length);
    if (files.length === 0) return;
    setError(null);
    try {
      const processed = await Promise.all(
        files.map(async (f) => ({
          name: f.name,
          dataUrl: await compressImageToDataUrl(f),
        }))
      );
      setReferenceImages((prev) => [...prev, ...processed].slice(0, 3));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to attach reference image.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCategories.length === 0) {
      setError('Select at least one product category.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSubmittedRecord(null);

    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerName,
          companyName,
          country,
          email,
          phone,
          productCategories: selectedCategories,
          quantity: Number(quantity) || 100,
          customizationDetails,
          referenceImages,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit inquiry.');
      }

      const inquiry: CustomOrderInquiry = data.inquiry;
      setSubmittedRecord(inquiry);
      setRoutedInquiries((prev) => [inquiry, ...prev]);

      // Mirror to Firestore when authenticated
      if (user) {
        const docId = inquiry.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
        try {
          await setDoc(doc(db, 'inquiries', docId), {
            ownerId: user.uid,
            referenceCode: inquiry.referenceCode.slice(0, 40),
            buyerName: inquiry.buyerName.slice(0, 100),
            companyName: inquiry.companyName.slice(0, 140),
            country: inquiry.country.slice(0, 80),
            email: inquiry.email.slice(0, 120),
            phone: inquiry.phone.slice(0, 40),
            productCategories: inquiry.productCategories.slice(0, 8),
            quantity: inquiry.quantity,
            customizationDetails: inquiry.customizationDetails.slice(0, 2000),
            status: 'received',
            aiTriageSummary: inquiry.aiTriageSummary.slice(0, 1500),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (fsErr) {
          try {
            handleFirestoreError(fsErr, OperationType.CREATE, `inquiries/${docId}`);
          } catch {
            // Keep backend-routed inquiry confirmed while structured error is logged
          }
        }
      }

      setCustomizationDetails('');
      setReferenceImages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit custom order inquiry.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, status: InquiryStatus) => {
    try {
      const res = await fetch(`/api/inquiries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setRoutedInquiries((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status } : item))
        );
      }
    } catch {
      // ignore transient error
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Custom Order &amp; OEM Inquiry</h2>
        <p className="mt-1 text-xs text-slate-400 leading-relaxed">
          Submit bespoke product specifications and estimate international shipping and customs duties from Sialkot.
        </p>
        <div className="mt-3 inline-flex rounded-lg border border-white/10 bg-[#090d16] p-1 gap-1">
          <button
            type="button"
            onClick={() => setWorkspaceMode('form')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              workspaceMode === 'form'
                ? 'bg-amber-500 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Order &amp; Inquiry Form
          </button>
          <button
            type="button"
            onClick={() => setWorkspaceMode('calculator')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              workspaceMode === 'calculator'
                ? 'bg-amber-500 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Cost Calculator
          </button>
        </div>
      </div>

      {workspaceMode === 'calculator' && (
        <CostCalculator
          orderQuantity={quantity}
          initialCountry={calcPrefill?.country || country}
          initialCategory={calcPrefill?.category}
          onAttachEstimate={(destCountry, summaryText) => {
            setCountry(destCountry);
            setCustomizationDetails((prev) =>
              prev ? `${prev}\n\n${summaryText}` : summaryText
            );
            setWorkspaceMode('form');
          }}
        />
      )}

      {submittedRecord && (
        <div className="border border-emerald-500/35 bg-emerald-950/30 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Inquiry Routed · Reference {submittedRecord.referenceCode}</span>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed">
            {submittedRecord.aiTriageSummary}
          </p>
        </div>
      )}

      {workspaceMode === 'form' && (
      <form onSubmit={handleSubmit} className="space-y-4 border border-white/10 bg-[#101829] rounded-xl p-4">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Select Product Categories
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PRODUCT_CHOICES.map((cat) => {
              const active = selectedCategories.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleToggleCategory(cat)}
                  className={`px-2.5 py-1.5 text-xs rounded-md border transition-colors text-left ${
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Desired Quantity (Units / Sets)
            </label>
            <input
              type="number"
              min={1}
              max={10000000}
              required
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white font-mono focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Destination Country
            </label>
            <input
              type="text"
              required
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g., Germany, UK, USA, UAE"
              className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <label className="text-xs font-medium text-slate-300">
              Customization Specifications (Sizes, Colors, Material GSM/Hide, Logo Branding)
            </label>
            <MicTranscribeButton
              compact
              label="Dictate Specs"
              contextHint="Sialkot custom manufacturing specifications, sizes, colors, GSM, branding"
              onTranscript={(t) =>
                setCustomizationDetails((prev) => (prev ? `${prev} ${t}` : t))
              }
            />
          </div>
          <textarea
            rows={3}
            required
            value={customizationDetails}
            onChange={(e) => setCustomizationDetails(e.target.value)}
            placeholder="e.g., 14oz brushed cotton Karate Gi sizes 160cm-200cm, woven dojo patch on left chest, custom polybag packaging..."
            className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
          />
        </div>

        {/* Reference Image Upload */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-300">
              Reference Images / Tech Packs (up to 3)
            </label>
            {referenceImages.length < 3 && (
              <label className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-white/10 text-white rounded-md hover:bg-white/15 cursor-pointer transition-colors">
                <ImagePlus className="w-3.5 h-3.5" />
                <span>Attach Image</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => void handleFileChange(e)}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {referenceImages.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {referenceImages.map((img, i) => (
                <div
                  key={`${img.name}-${i}`}
                  className="relative rounded-lg overflow-hidden border border-white/15 bg-[#090d16]"
                >
                  <img
                    src={img.dataUrl}
                    alt={img.name}
                    className="w-full h-20 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setReferenceImages((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    className="absolute top-1 right-1 p-1 rounded bg-black/75 text-white hover:text-red-300"
                    aria-label="Remove image"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contact Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/10">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder="Buyer / Procurement Lead"
              className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Company Name</label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Importer / Club / Brand"
              className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Business Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="procurement@company.com"
              className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">WhatsApp / Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+49 / +44 / +1 ..."
              className="w-full px-3 py-2 text-sm bg-[#090d16] border border-white/15 rounded-lg text-white focus:outline-none focus:border-amber-400"
            />
          </div>
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
              <span>Routing to Sialkot Export Desk...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Submit Custom Order Inquiry</span>
            </>
          )}
        </button>
      </form>
      )}

      {/* Backend Routed Inquiry Queue for Follow-Up */}
      <div className="space-y-3 pt-2 border-t border-white/10">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">
            Export Desk Follow-Up Queue ({routedInquiries.length})
          </h3>
          {loadingQueue && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
        </div>

        {routedInquiries.length === 0 ? (
          <div className="border border-white/10 bg-[#101829] rounded-xl p-4 text-xs text-slate-400">
            Submitted custom order inquiries appear here for review and follow-up by Sarwar Khawaja Industries Pvt Ltd.
          </div>
        ) : (
          <div className="space-y-2.5">
            {routedInquiries.map((inq) => (
              <div
                key={inq.id}
                className="border border-white/10 bg-[#101829] rounded-xl p-3.5 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-mono text-amber-300">{inq.referenceCode}</div>
                    <div className="text-sm font-semibold text-white">
                      {inq.companyName} · {inq.country}
                    </div>
                    <div className="text-xs text-slate-400">
                      {inq.buyerName} · {inq.email} · <span className="font-mono">{inq.quantity} units</span>
                    </div>
                  </div>
                  <select
                    value={inq.status}
                    onChange={(e) => void handleStatusChange(inq.id, e.target.value as InquiryStatus)}
                    className="px-2 py-1 text-xs bg-[#090d16] border border-white/15 rounded-md text-amber-300 shrink-0"
                  >
                    {INQUIRY_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="text-xs text-slate-300">
                  <span className="text-slate-400">Items: </span>
                  {inq.productCategories.join(', ')}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{inq.customizationDetails}</p>

                {inq.referenceImages && inq.referenceImages.length > 0 && (
                  <div className="flex gap-2 pt-1">
                    {inq.referenceImages.map((img, i) => (
                      <img
                        key={i}
                        src={img.dataUrl}
                        alt={img.name}
                        className="w-12 h-12 rounded object-cover border border-white/10"
                      />
                    ))}
                  </div>
                )}

                {inq.aiTriageSummary && (
                  <div className="text-[11px] text-slate-400 pt-1 border-t border-white/10">
                    {inq.aiTriageSummary}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
