import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_DATA_DIR = path.resolve(__dirname, '.data');
const DATA_DIR = (() => {
  try {
    fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
    fs.accessSync(LOCAL_DATA_DIR, fs.constants.W_OK);
    return LOCAL_DATA_DIR;
  } catch {
    return path.join(os.tmpdir(), 'sarwar-khawaja-data');
  }
})();
const INQUIRIES_FILE = path.join(DATA_DIR, 'inquiries.json');
const INSIGHTS_FILE = path.join(DATA_DIR, 'insights-subscriptions.json');

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota');
}

function isTransientOrQuotaError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    isQuotaError(err) ||
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('502') ||
    msg.includes('504') ||
    msg.includes('timeout')
  );
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('403') || msg.includes('PERMISSION_DENIED')) {
    return { status: 403, message: 'Gemini API permission denied. Verify your API key in Settings > Secrets.' };
  }
  if (isQuotaError(err)) {
    return {
      status: 429,
      message:
        'Free-tier Gemini API quota reached. Wait ~30 seconds before scanning again, or select a billing-enabled API key in Settings > Secrets to increase quota.',
    };
  }
  if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.toLowerCase().includes('high demand')) {
    return {
      status: 503,
      message: 'AI service is experiencing temporary high demand. Please retry in a few seconds.',
    };
  }
  if (msg.includes('400') || msg.includes('API_KEY_INVALID')) {
    return { status: 400, message: 'Invalid request or API key configuration. Check Settings > Secrets.' };
  }
  return { status: 500, message: msg || 'Unexpected AI service error.' };
}

function extractJsonBlock(rawText: string): string | null {
  const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    return fenced[1].trim();
  }
  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return rawText.slice(firstBrace, lastBrace + 1);
  }
  return null;
}

function tryParseLooseJson<T = any>(rawText: string): T | null {
  const candidate = extractJsonBlock(rawText) ?? rawText.trim();
  if (!candidate) return null;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    try {
      const repaired = candidate
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/[\u0000-\u001F]+/g, ' ');
      return JSON.parse(repaired) as T;
    } catch {
      return null;
    }
  }
}

const MAX_CACHE_ENTRIES = 60;
const discoveryCache = new Map<string, { expiresAt: number; payload: any }>();
const inFlightDiscoveries = new Map<string, Promise<any>>();
const DISCOVERY_CACHE_TTL_MS = 10 * 60 * 1000;

function setDiscoveryCache(key: string, payload: any) {
  if (discoveryCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = discoveryCache.keys().next().value;
    if (oldestKey) discoveryCache.delete(oldestKey);
  }
  discoveryCache.set(key, {
    expiresAt: Date.now() + DISCOVERY_CACHE_TTL_MS,
    payload,
  });
}

let writeQueue: Promise<void> = Promise.resolve();
function enqueueFileWrite(task: () => Promise<void>): Promise<void> {
  const next = writeQueue.then(task, task);
  writeQueue = next.catch(() => {});
  return next;
}

async function atomicWriteJson(filePath: string, data: any[]): Promise<void> {
  await enqueueFileWrite(async () => {
    await fs.promises.mkdir(DATA_DIR, { recursive: true });
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.promises.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    await fs.promises.rename(tmpPath, filePath);
  });
}

async function readStoredInquiries(): Promise<any[]> {
  try {
    if (!fs.existsSync(INQUIRIES_FILE)) return [];
    const raw = await fs.promises.readFile(INQUIRIES_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeStoredInquiries(items: any[]): Promise<void> {
  await atomicWriteJson(INQUIRIES_FILE, items);
}

async function readStoredSubscriptions(): Promise<any[]> {
  try {
    if (!fs.existsSync(INSIGHTS_FILE)) return [];
    const raw = await fs.promises.readFile(INSIGHTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeStoredSubscriptions(items: any[]): Promise<void> {
  await atomicWriteJson(INSIGHTS_FILE, items);
}

function computeTariffAdvantage(country: string, category: string): string {
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
    return category === 'hockeys' ? '0% Duty on Hockey Gear' : '5% General Tariff · Oceania';
  }
  return 'FOB Sialkot / SKT Air Express';
}

function scoreDiscoveredLead(
  item: any,
  keyword: string,
  hasGroundingSource: boolean,
  idx: number
): { leadScore: number; scoreReasons: string[] } {
  const reasons: string[] = [];
  let score = 46;

  const website = String(item.website || '').trim();
  const email = String(item.contactEmail || '').trim();
  const phone = String(item.contactPhone || '').trim();
  const signal = String(item.sourcingSignal || '').toLowerCase();
  const activity = String(item.recentActivity || '').trim();
  const volume = String(item.estimatedOrderVolume || '').trim();

  if (/^https?:\/\/[a-z0-9.-]+\.[a-z]{2,}/i.test(website) && !/example\.com|placeholder/i.test(website)) {
    score += 13;
    reasons.push('Verified domain');
  }
  if (email.includes('@') && !/example\.com/i.test(email)) {
    score += 10;
    reasons.push('Public email');
  }
  if (phone.replace(/\D/g, '').length >= 7) {
    score += 10;
    reasons.push('Direct phone/WhatsApp');
  }
  if (hasGroundingSource) {
    score += 9;
    reasons.push('Live Search match');
  }
  if (activity.length > 18) {
    score += 7;
    reasons.push('Recent buying signal');
  }
  if (/\d/.test(volume) || /importer|distributor|wholesaler|federation|chain/i.test(String(item.buyerType || ''))) {
    score += 5;
  }

  const kwTokens = keyword
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3 && !['from', 'pakistan', 'sialkot', 'wholesale', 'suppliers'].includes(w));
  if (kwTokens.some((tok) => signal.includes(tok))) {
    score += 4;
  }

  const aiScore = Number(item.leadScore);
  const blended = Number.isFinite(aiScore)
    ? Math.round(score * 0.65 + Math.max(45, Math.min(99, aiScore)) * 0.35)
    : Math.round(score - idx * 2);

  return {
    leadScore: Math.max(45, Math.min(99, blended)),
    scoreReasons: reasons.slice(0, 3),
  };
}

async function generateWeeklyDemandReport(
  ai: GoogleGenAI,
  productCategories: string[],
  targetRegions: string[],
  role: string,
  focusNotes: string,
  issueNum = 1
) {
  const reportSchema = {
    type: Type.OBJECT,
    properties: {
      headline: { type: Type.STRING },
      executiveSummary: { type: Type.STRING },
      topDemandSignals: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            region: { type: Type.STRING },
            trend: { type: Type.STRING },
            recommendedAction: { type: Type.STRING },
          },
          required: ['category', 'region', 'trend', 'recommendedAction'],
        },
      },
      sialkotPricingWatch: { type: Type.STRING },
    },
    required: ['headline', 'executiveSummary', 'topDemandSignals', 'sialkotPricingWatch'],
  };

  const prompt = `Generate Weekly Export Market Insights Report (Issue #${issueNum}) for Sarwar Khawaja Industries Pvt Ltd (Sialkot, Pakistan; Director Khawaja Irfan; Founder legacy Sarwar Khawaja).
Subscriber Role: ${role}
Selected Product Lines: ${productCategories.join(', ')}
Target Markets: ${targetRegions.join(', ')}
Special Focus Notes: ${focusNotes || 'Custom OEM manufacturing, seasonal procurement cycles, and buyer outreach opportunities.'}

Provide actionable weekly intelligence covering:
1. A sharp executive headline and 3-sentence summary of global buyer demand this week.
2. 3 concrete demand signals across the selected categories & target regions with recommended exporter or buyer actions.
3. A Sialkot raw-material & FOB pricing watch note (cotton canvas, PU microfiber, Toray carbon, full-grain hide, freight).`;

  let response: any;
  try {
    response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: reportSchema,
      },
    });
  } catch (err) {
    if (!isTransientOrQuotaError(err)) throw err;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: reportSchema,
        },
      });
    } catch (err2) {
      if (!isTransientOrQuotaError(err2)) throw err2;
      const issueNumber = `W${String(issueNum).padStart(2, '0')}-${new Date().getFullYear()}`;
      return {
        issueNumber,
        generatedAt: new Date().toISOString(),
        headline: `Sialkot Export Demand Brief (${issueNumber}) — ${productCategories.slice(0, 2).join(' & ')}`,
        executiveSummary: `Global B2B procurement across ${targetRegions.join(', ')} shows steady pre-season restocking for custom OEM ${productCategories.join(', ')} manufactured in Sialkot. Buyers are prioritizing REX/GSP+ zero-duty documentation and 14-day SKT air-cargo sample turnarounds from established family factories like Sarwar Khawaja Industries Pvt Ltd.`,
        topDemandSignals: productCategories.slice(0, 3).map((cat, i) => ({
          category: cat,
          region: targetRegions[i % targetRegions.length] || 'Global Markets',
          trend: 'Steady OEM private-label reorder inquiries ahead of tournament and retail seasons.',
          recommendedAction: 'Dispatch 1-piece counter-sample via SKT Air Cargo with SCCI Certificate of Origin & FOB tier sheet.',
        })),
        sialkotPricingWatch:
          'Combed cotton canvas, high-density PU microfiber, Toray carbon layups, and aniline cowhide remain stable in Sialkot; consolidate 300+ kg air shipments or LCL Port Qasim bookings to optimize landed unit cost.',
      };
    }
  }

  const parsed = tryParseLooseJson(response.text ?? '{}') || {};
  return {
    issueNumber: `W${String(issueNum).padStart(2, '0')}-${new Date().getFullYear()}`,
    generatedAt: new Date().toISOString(),
    headline: String(parsed.headline || 'Weekly Sialkot Export Demand Brief'),
    executiveSummary: String(parsed.executiveSummary || ''),
    topDemandSignals: Array.isArray(parsed.topDemandSignals) ? parsed.topDemandSignals.slice(0, 4) : [],
    sialkotPricingWatch: String(parsed.sialkotPricingWatch || ''),
  };
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: 'sarwar-khawaja-export-hub',
      cacheEntries: discoveryCache.size,
    });
  });

  // 1. Live AI Lead Discovery with Search Grounding + In-Flight Dedupe + Hybrid Lead Scoring
  app.post('/api/leads/discover', async (req: Request, res: Response) => {
    try {
      const {
        productCategory = 'karate-suits',
        productLabel = 'Karate Suits & Martial Arts Uniforms',
        targetRegion = 'Germany & Western Europe',
        buyerType = 'Distributors & Importers',
        customSpecs = '',
        searchKeyword = '',
        companyName = 'Sarwar Khawaja Industries Pvt Ltd',
        forceRefresh = false,
      } = req.body ?? {};

      const effectiveKeyword = searchKeyword ? String(searchKeyword).trim() : productLabel;
      const cacheKey = `${effectiveKeyword.toLowerCase()}|${productCategory}|${String(targetRegion).toLowerCase()}|${String(buyerType).toLowerCase()}`;

      if (!forceRefresh) {
        const cached = discoveryCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
          return res.json({ ...cached.payload, cached: true });
        }
      }

      let pending = inFlightDiscoveries.get(cacheKey);
      if (!pending) {
        pending = (async () => {
          const ai = getAiClient();

          const prompt = `You are an international trade intelligence analyst helping ${companyName} in Sialkot, Pakistan find REAL international B2B buyer leads.

Target Search Keyword: "${effectiveKeyword}" (Product Category: "${productLabel}")
Target Geography: ${targetRegion}
Preferred Buyer Type: ${buyerType}
Custom Manufacturing / OEM Notes: ${customSpecs || 'Custom OEM / private-label bulk manufacturing available ex-Sialkot'}

Identify 5 to 6 real international companies, distributors, wholesalers, federations, or clubs that source or distribute products matching "${effectiveKeyword}".
Only include real, established companies (never invent fake URLs or fake emails—if an email isn't publicly known/listed, leave contactEmail as "" and provide their real domain website and public phone if known).
Compute a realistic "leadScore" (integer 55 to 99) based on product relevance to "${effectiveKeyword}", wholesale/import scale, and recent catalog or sourcing activity.
Include approximate city latitude and longitude coordinates so we can plot trade routes from Sialkot (32.4945, 74.5229).

Return ONLY valid JSON matching this exact structure inside a \`\`\`json block:
{
  "marketSummary": "2-3 sentence overview of current import demand and sourcing landscape for ${effectiveKeyword}",
  "leads": [
    {
      "companyName": "Exact real company or organization name",
      "country": "Country name",
      "city": "City name",
      "buyerType": "Importer / Distributor / Academy Chain / Club / Brand",
      "website": "https://...",
      "contactEmail": "public email if known or empty string",
      "contactPhone": "public phone if known or empty string",
      "sourcingSignal": "Stated product interest and why they are a high-fit buyer for Sialkot ${productLabel}",
      "recentActivity": "Recent 2025-2026 catalog update, expansion, tournament partnership, or B2B sourcing signal",
      "estimatedOrderVolume": "Realistic B2B order estimate e.g. 500–2,000 units/quarter",
      "fitReason": "Specific custom OEM pitch angle for Sarwar Khawaja Industries Pvt Ltd",
      "leadScore": 88,
      "lat": 48.1351,
      "lng": 11.5820
    }
  ]
}`;

          const leadResponseSchema = {
            type: Type.OBJECT,
            properties: {
              marketSummary: { type: Type.STRING },
              leads: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    companyName: { type: Type.STRING },
                    country: { type: Type.STRING },
                    city: { type: Type.STRING },
                    buyerType: { type: Type.STRING },
                    website: { type: Type.STRING },
                    contactEmail: { type: Type.STRING },
                    contactPhone: { type: Type.STRING },
                    sourcingSignal: { type: Type.STRING },
                    recentActivity: { type: Type.STRING },
                    estimatedOrderVolume: { type: Type.STRING },
                    fitReason: { type: Type.STRING },
                    leadScore: { type: Type.NUMBER },
                    lat: { type: Type.NUMBER },
                    lng: { type: Type.NUMBER },
                  },
                  required: ['companyName', 'country', 'sourcingSignal'],
                },
              },
            },
            required: ['marketSummary', 'leads'],
          };

          let response: any = null;
          let usedStructuredLiteDirect = false;

          // Attempt 1: gemini-4-hydrogen with Google Search grounding (LOW thinking to conserve free quota)
          try {
            response = await ai.models.generateContent({
              model: 'gemini-4-hydrogen',
              contents: prompt,
              config: {
                tools: [{ googleSearch: {} }],
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              },
            });
          } catch (err1) {
            if (!isTransientOrQuotaError(err1)) throw err1;
            // Attempt 2: gemini-3.1-flash-lite with Google Search grounding
            try {
              response = await ai.models.generateContent({
                model: 'gemini-3.1-flash-lite',
                contents: prompt,
                config: {
                  tools: [{ googleSearch: {} }],
                },
              });
            } catch (err2) {
              if (!isTransientOrQuotaError(err2)) throw err2;
              // Attempt 3: gemini-3.1-flash-lite structured JSON without Search tool
              response = await ai.models.generateContent({
                model: 'gemini-3.1-flash-lite',
                contents: prompt,
                config: {
                  responseMimeType: 'application/json',
                  responseSchema: leadResponseSchema,
                },
              });
              usedStructuredLiteDirect = true;
            }
          }

          const rawText = (response?.text ?? '').trim();
          const rawChunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
          const groundingSources = rawChunks
            .filter((c: any) => c?.web?.uri)
            .map((c: any) => ({
              uri: String(c.web.uri),
              title: String(c.web.title || c.web.uri),
            }));

          let parsed: { marketSummary?: string; leads?: any[] } | null = null;
          if (usedStructuredLiteDirect) {
            parsed = tryParseLooseJson(rawText);
          }
          if (!parsed) {
            parsed = tryParseLooseJson(rawText);
          }

          if (!parsed || !Array.isArray(parsed.leads)) {
            const structurer = await ai.models.generateContent({
              model: 'gemini-3.1-flash-lite',
              contents: `Extract the buyer leads from this research report into strict JSON:\n\n${rawText}`,
              config: {
                responseMimeType: 'application/json',
                responseSchema: leadResponseSchema,
              },
            });
            parsed = tryParseLooseJson(structurer.text ?? '{}') || { leads: [] };
          }

          const seenCompanies = new Set<string>();
          const leads = (parsed?.leads ?? [])
            .filter((item: any) => {
              const nameKey = String(item?.companyName || '').trim().toLowerCase();
              if (!nameKey || seenCompanies.has(nameKey)) return false;
              seenCompanies.add(nameKey);
              return true;
            })
            .map((item: any, idx: number) => {
              const matchedSource = groundingSources[idx] ?? groundingSources[0];
              const countryStr = String(item.country || targetRegion).slice(0, 75);
              const { leadScore, scoreReasons } = scoreDiscoveredLead(
                item,
                effectiveKeyword,
                Boolean(matchedSource?.uri),
                idx
              );
              return {
                id: `lead_${Date.now()}_${idx}`,
                companyName: String(item.companyName || 'International Sports Buyer').slice(0, 150),
                country: countryStr,
                city: String(item.city || '').slice(0, 75),
                buyerType: String(item.buyerType || buyerType).slice(0, 75),
                productCategory,
                website: String(item.website || '').slice(0, 290),
                contactEmail: String(item.contactEmail || '').slice(0, 115),
                contactPhone: String(item.contactPhone || '').slice(0, 55),
                sourcingSignal: String(item.sourcingSignal || 'Active sporting goods & apparel buyer').slice(0, 950),
                recentActivity: String(item.recentActivity || 'Active international distributor catalog').slice(0, 240),
                estimatedOrderVolume: String(item.estimatedOrderVolume || '250–1,000 units').slice(0, 115),
                fitReason: String(item.fitReason || '').slice(0, 500),
                leadScore,
                scoreReasons,
                tariffAdvantage: computeTariffAdvantage(countryStr, productCategory),
                matchedKeyword: effectiveKeyword.slice(0, 115),
                lat: typeof item.lat === 'number' && Number.isFinite(item.lat) ? item.lat : 48.8566,
                lng: typeof item.lng === 'number' && Number.isFinite(item.lng) ? item.lng : 2.3522,
                sourceUri: matchedSource?.uri || '',
                sourceTitle: matchedSource?.title || '',
              };
            })
            .sort((a: any, b: any) => b.leadScore - a.leadScore);

          const payload = {
            marketSummary: parsed?.marketSummary || 'Buyer discovery completed.',
            leads,
            groundingSources,
          };
          if (leads.length > 0) {
            setDiscoveryCache(cacheKey, payload);
          }
          return payload;
        })().finally(() => {
          inFlightDiscoveries.delete(cacheKey);
        });
        inFlightDiscoveries.set(cacheKey, pending);
      }

      const payload = await pending;
      res.json({ ...payload, cached: false });
    } catch (err) {
      console.error('Lead discovery error:', err);
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 2. Google Maps Grounding for Physical Importers, Martial Arts Academies & Sports Stores
  app.post('/api/leads/maps', async (req: Request, res: Response) => {
    try {
      const { query = 'martial arts equipment & karate uniform wholesalers', city = 'Munich, Germany', lat, lng } = req.body ?? {};
      const ai = getAiClient();

      const config: any = {
        tools: [{ googleMaps: {} }],
      };

      if (typeof lat === 'number' && typeof lng === 'number') {
        config.toolConfig = {
          retrievalConfig: {
            latLng: { latitude: lat, longitude: lng },
          },
        };
      }

      const mapsPrompt = `Find real physical sporting goods stores, martial arts supply distributors, club outfitters, or apparel wholesale hubs matching "${query}" in or near ${city}. Summarize each business, what Sialkot-made products they likely stock (karate gis, footballs, field hockey sticks, teamwear, leather gear), and why they are worth contacting.`;

      let response: any;
      try {
        response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: mapsPrompt,
          config,
        });
      } catch (err1) {
        if (!isTransientOrQuotaError(err1)) throw err1;
        try {
          response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: mapsPrompt,
            config,
          });
        } catch (err2) {
          if (!isTransientOrQuotaError(err2)) throw err2;
          response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: mapsPrompt,
          });
        }
      }

      const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const places = rawChunks
        .filter((c: any) => c?.maps?.uri || c?.maps?.title)
        .map((c: any) => ({
          title: String(c.maps.title || 'Google Maps Place'),
          uri: String(c.maps.uri || ''),
          placeId: c.maps.placeId ? String(c.maps.placeId) : undefined,
          reviewSnippets: Array.isArray(c.maps.placeAnswerSources?.reviewSnippets)
            ? c.maps.placeAnswerSources.reviewSnippets
                .map((s: any) => (typeof s === 'string' ? s : s?.content || s?.text || ''))
                .filter(Boolean)
                .slice(0, 3)
            : [],
        }));

      res.json({
        markdownText: response.text ?? '',
        places,
        query: `${query} · ${city}`,
      });
    } catch (err) {
      console.error('Maps grounding error:', err);
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 3. Deep Export Strategy & Custom OEM Outreach Pitch (gemini-4-hydrogen with gemini-3.1-flash-lite fallback)
  app.post('/api/leads/analyze', async (req: Request, res: Response) => {
    try {
      const { lead, exporterProfile } = req.body ?? {};
      if (!lead || !lead.companyName) {
        return res.status(400).json({ error: 'Lead details are required for analysis.' });
      }

      const ai = getAiClient();
      const company = exporterProfile?.companyName || 'Sarwar Khawaja Industries Pvt Ltd';
      const director = exporterProfile?.directorName || 'Khawaja Irfan';
      const heritage = exporterProfile?.founderHeritage || 'Sarwar Khawaja';

      const prompt = `Perform a deep international export strategy and B2B outreach plan for:
Exporter: ${company} (Sialkot, Punjab, Pakistan)
Director: ${director} (Continuing the family sports manufacturing legacy of ${heritage})
Target Buyer: ${lead.companyName} (${lead.city ? `${lead.city}, ` : ''}${lead.country})
Buyer Type: ${lead.buyerType}
Product Category: ${lead.productCategory}
Sourcing Signal: ${lead.sourcingSignal}
Estimated Order Volume: ${lead.estimatedOrderVolume || 'Negotiable'}

Provide practical, concrete Sialkot export trade intelligence:
1. Exact HS code & destination import duty/regulatory notes for ${lead.country}
2. Quality & certification checklist (e.g., WKF, FIFA, FIH, REACH, OEKO-TEX, ISO 9001)
3. Competitive FOB Sialkot / CIF pricing tiering, MOQ, and sample-dispatch strategy
4. Optimal freight route (Sialkot International Airport SKT air cargo vs. Port Qasim / Karachi sea freight)
5. Ready-to-send B2B executive cold email from ${director} at ${company} honoring ${heritage}'s manufacturing heritage
6. Concise WhatsApp business intro message
7. A 25-second spoken executive briefing script summarizing the opportunity for voice playback.`;

      const analysisSchema = {
        type: Type.OBJECT,
        properties: {
          hsCodeAndDuties: { type: Type.STRING },
          complianceChecklist: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          pricingAndMoqStrategy: { type: Type.STRING },
          logisticsRoute: { type: Type.STRING },
          emailSubject: { type: Type.STRING },
          emailBody: { type: Type.STRING },
          whatsappIntro: { type: Type.STRING },
          voiceBriefingScript: { type: Type.STRING },
        },
        required: [
          'hsCodeAndDuties',
          'complianceChecklist',
          'pricingAndMoqStrategy',
          'logisticsRoute',
          'emailSubject',
          'emailBody',
          'whatsappIntro',
          'voiceBriefingScript',
        ],
      };

      let response: any;
      let analysis: any = null;
      try {
        response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
            responseMimeType: 'application/json',
            responseSchema: analysisSchema,
          },
        });
        analysis = tryParseLooseJson(response.text ?? '{}');
      } catch (err1) {
        if (!isTransientOrQuotaError(err1)) throw err1;
        try {
          response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: analysisSchema,
            },
          });
          analysis = tryParseLooseJson(response.text ?? '{}');
        } catch (err2) {
          if (!isTransientOrQuotaError(err2)) throw err2;
        }
      }

      if (!analysis || !analysis.emailBody) {
        const tariffNote = computeTariffAdvantage(String(lead.country || ''), String(lead.productCategory || 'custom'));
        const hsMap: Record<string, string> = {
          'karate-suits': 'HS 6203.22 / 6204.22 (Martial Arts Uniforms & Cotton Gis)',
          footballs: 'HS 9506.62 (Inflatable Match & Training Footballs)',
          hockeys: 'HS 9506.99 (Field Hockey Sticks & Protection Gear)',
          hotballs: 'HS 9506.69 (Indoor Hotballs & Match Turf Balls)',
          apparel: 'HS 6110.30 / 6201.93 (Custom Teamwear & Sublimated Sportswear)',
          'leather-jackets': 'HS 4203.10 (Full-Grain Leather Jackets & Moto Gear)',
        };
        const hsLine = hsMap[String(lead.productCategory || '')] || 'HS 9506 / 6203 (Sialkot Sporting Goods & Apparel)';
        analysis = {
          hsCodeAndDuties: `${hsLine} — ${tariffNote} for shipments originating from Sialkot, Pakistan to ${lead.country}.`,
          complianceChecklist: [
            'ISO 9001 factory QC & AQL 2.5 pre-shipment inspection',
            'REACH / OEKO-TEX compliant dyes, inks, and chrome-free leather finishes',
            'WKF / FIFA / FIH dimensional & weight tolerances where applicable',
            'Sialkot Chamber of Commerce (SCCI) Certificate of Origin & REX/DCTS declaration',
          ],
          pricingAndMoqStrategy: `Offer tiered FOB Sialkot pricing starting at MOQ 50–100 units per SKU with a 10–14 day custom counter-sample dispatched ahead of bulk confirmation (${lead.estimatedOrderVolume || 'custom B2B volume'}).`,
          logisticsRoute: `Express samples via Sialkot International Airport (SKT) DHL/FedEx (3–5 days); bulk cargo via SKT Air Freight or Sialkot Dry Port to Port Qasim ocean container to ${lead.country}.`,
          emailSubject: `Direct OEM Sialkot Supply for ${lead.companyName} — ${company}`,
          emailBody: `Dear Procurement Team at ${lead.companyName},\n\nI am writing from ${company} in Sialkot, Pakistan, where our family has manufactured export-grade sports equipment and apparel for three generations since ${heritage} founded our workshops, now led by Director ${director}.\n\nNoticing your ${lead.buyerType || 'distribution'} focus in ${lead.country} (${lead.sourcingSignal}), we would welcome sending a custom-branded counter-sample from our Sialkot facility with ${tariffNote} documentation.\n\nMay I share our latest FOB Sialkot specification sheet and sample dispatch schedule?\n\nBest regards,\n${director}\n${company} · Sialkot, Pakistan`,
          whatsappIntro: `Hello ${lead.companyName} team — ${director} from ${company} (Sialkot, Pakistan). We manufacture custom OEM ${String(lead.productCategory || 'sports gear').replace(/-/g, ' ')} for international ${lead.buyerType || 'buyers'} in ${lead.country} (${tariffNote}). Would you like our FOB price sheet or a custom counter-sample?`,
          voiceBriefingScript: `Executive briefing for ${lead.companyName} in ${lead.country}. ${company} can pitch direct Sialkot OEM manufacturing under ${tariffNote}, starting with a 10-day custom counter-sample via Sialkot International Airport.`,
        };
      }

      res.json({ analysis });
    } catch (err) {
      console.error('Deep analysis error:', err);
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 4. Fast Buyer Quick-Score via gemini-3.1-flash-lite
  app.post('/api/leads/quick-score', async (req: Request, res: Response) => {
    try {
      const { companyName, country, notes } = req.body ?? {};
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: `Evaluate export fit for a Sialkot manufacturer (karate suits, footballs, hockeys, hotballs, apparel, leather jackets) pitching "${companyName}" in ${country}. Notes: ${notes || 'Standard wholesale importer'}. Give a brief 1-sentence recommendation and primary custom OEM hook.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recommendation: { type: Type.STRING },
              customHook: { type: Type.STRING },
            },
            required: ['recommendation', 'customHook'],
          },
        },
      });
      res.json(JSON.parse((response.text ?? '{}').trim()));
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 5. Text-to-Speech Executive Briefing using gemini-3.8-flash-tts
  app.post('/api/tts', async (req: Request, res: Response) => {
    try {
      const { text, voiceName = 'Charon' } = req.body ?? {};
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Text script is required for speech synthesis.' });
      }

      const ai = getAiClient();
      const cleanScript = text.slice(0, 1800);

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: cleanScript,
                speechMetadata: {
                  style: 'Confident, warm international trade executive briefing',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        return res.status(502).json({ error: 'No audio returned from speech model.' });
      }

      res.json({
        audioBase64: base64Audio,
        mimeType: 'audio/wav',
      });
    } catch (err) {
      console.error('TTS error:', err);
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 6. Custom Order & Inquiry Routing Backend (POST /api/inquiries, GET /api/inquiries, PATCH /api/inquiries/:id)
  app.get('/api/inquiries', async (_req: Request, res: Response) => {
    try {
      const items = await readStoredInquiries();
      res.json({ inquiries: items });
    } catch (err) {
      res.status(500).json({ error: 'Failed to load routed inquiries.' });
    }
  });

  app.post('/api/inquiries', async (req: Request, res: Response) => {
    try {
      const {
        buyerName,
        companyName,
        country,
        email,
        phone = '',
        productCategories,
        quantity,
        customizationDetails,
        referenceImages = [],
      } = req.body ?? {};

      if (
        !buyerName ||
        !companyName ||
        !country ||
        !email ||
        !Array.isArray(productCategories) ||
        productCategories.length === 0 ||
        !customizationDetails
      ) {
        return res.status(400).json({
          error: 'Please provide contact details, at least one product category, and customization specifications.',
        });
      }

      const qtyNum = Math.max(1, Math.min(10000000, Number(quantity) || 100));
      const safeImages = Array.isArray(referenceImages)
        ? referenceImages
            .slice(0, 3)
            .filter(
              (img: any) =>
                img &&
                typeof img.name === 'string' &&
                typeof img.dataUrl === 'string' &&
                img.dataUrl.startsWith('data:image/') &&
                img.dataUrl.length < 350000
            )
            .map((img: any) => ({
              name: img.name.slice(0, 80),
              dataUrl: img.dataUrl,
            }))
        : [];

      let aiTriageSummary =
        'Routed to Sarwar Khawaja Industries Pvt Ltd export desk (Khawaja Irfan) for OEM material costing and sample scheduling.';

      try {
        const ai = getAiClient();
        const triage = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: `As the Sialkot production planner for Sarwar Khawaja Industries Pvt Ltd (led by Khawaja Irfan), write a concise 2-sentence factory feasibility & lead-time summary for this custom inquiry:
Buyer: ${buyerName} at ${companyName} (${country})
Products: ${productCategories.join(', ')}
Quantity: ${qtyNum} units
Customization: ${String(customizationDetails).slice(0, 600)}`,
        });
        if (triage.text) {
          aiTriageSummary = triage.text.trim().slice(0, 1200);
        }
      } catch (aiErr) {
        console.warn('Inquiry triage fallback note:', aiErr);
      }

      const referenceCode = `SKI-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const record = {
        id: `inq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        referenceCode,
        buyerName: String(buyerName).slice(0, 100),
        companyName: String(companyName).slice(0, 140),
        country: String(country).slice(0, 80),
        email: String(email).slice(0, 120),
        phone: String(phone).slice(0, 40),
        productCategories: productCategories.slice(0, 8).map((c: any) => String(c).slice(0, 80)),
        quantity: qtyNum,
        customizationDetails: String(customizationDetails).slice(0, 2000),
        referenceImages: safeImages,
        status: 'received',
        aiTriageSummary,
        createdAt: new Date().toISOString(),
      };

      const existing = await readStoredInquiries();
      await writeStoredInquiries([record, ...existing].slice(0, 200));

      res.status(201).json({ inquiry: record });
    } catch (err) {
      console.error('Create inquiry error:', err);
      res.status(500).json({ error: 'Unable to submit custom order inquiry.' });
    }
  });

  app.patch('/api/inquiries/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body ?? {};
      const allowed = ['received', 'reviewing', 'quoted', 'sample_prepared', 'closed'];
      if (!allowed.includes(status)) {
        return res.status(400).json({ error: 'Invalid inquiry status.' });
      }
      const existing = await readStoredInquiries();
      const idx = existing.findIndex((item) => item.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: 'Inquiry not found.' });
      }
      existing[idx] = { ...existing[idx], status };
      await writeStoredInquiries(existing);
      res.json({ inquiry: existing[idx] });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update inquiry status.' });
    }
  });

  // 7. Audio Transcription via gemini-3.5-transcribe
  app.post('/api/transcribe', async (req: Request, res: Response) => {
    try {
      const { audioBase64, mimeType = 'audio/webm', contextHint = '' } = req.body ?? {};
      if (!audioBase64 || typeof audioBase64 !== 'string') {
        return res.status(400).json({ error: 'Audio recording data is required for transcription.' });
      }

      const cleanBase64 = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;
      if (cleanBase64.length > 8_000_000) {
        return res.status(400).json({ error: 'Audio clip is too large. Keep recordings under 60 seconds.' });
      }

      const safeMime =
        typeof mimeType === 'string' && mimeType.startsWith('audio/')
          ? mimeType.split(';')[0]
          : 'audio/webm';

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
      }
      const ai = getAiClient();
      const aiBeta = new GoogleGenAI({
        apiKey,
        apiVersion: 'v1beta',
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const audioPart = {
        inlineData: {
          mimeType: safeMime,
          data: cleanBase64,
        },
      };

      const promptText = contextHint
        ? `Transcribe this spoken audio accurately into clean text only (no extra commentary). If there is only silence or no intelligible speech, return an empty string. Context: ${String(contextHint).slice(0, 200)}`
        : 'Transcribe this spoken audio accurately into clean text only (no extra commentary). If there is only silence or no intelligible speech, return an empty string. Preserve sports manufacturing terms such as Sialkot, Sarwar Khawaja, Khawaja Irfan, karate gi, footballs, field hockey, hotballs, and leather jackets.';

      let response: any;
      let modelUsed = 'gemini-3.5-transcribe';
      try {
        response = await aiBeta.models.generateContent({
          model: 'gemini-3.5-transcribe',
          contents: { parts: [audioPart, { text: promptText }] },
        });
      } catch (err1: any) {
        const msg1 = err1 instanceof Error ? err1.message : String(err1);
        const canFallback = isQuotaError(err1) || msg1.includes('404') || msg1.includes('NOT_FOUND');
        if (!canFallback) throw err1;
        try {
          modelUsed = 'gemini-4-hydrogen';
          response = await ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: { parts: [audioPart, { text: promptText }] },
          });
        } catch (err2: any) {
          const msg2 = err2 instanceof Error ? err2.message : String(err2);
          if (!isQuotaError(err2) && !msg2.includes('404') && !msg2.includes('NOT_FOUND')) {
            throw err2;
          }
          modelUsed = 'gemini-3.1-flash-lite';
          response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: { parts: [audioPart, { text: promptText }] },
          });
        }
      }

      const transcript = (response?.text ?? '').trim();
      res.json({ transcript, modelUsed });
    } catch (err) {
      console.error('Audio transcription error:', err);
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 8. Multi-Turn Export Chatbot (ai.chats.create with role-specific system instructions)
  app.post('/api/chat', async (req: Request, res: Response) => {
    try {
      const { message, history = [], roleId = 'export-advisor' } = req.body ?? {};
      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'Message text is required.' });
      }

      const roleConfigs: Record<
        string,
        {
          primaryModel: string;
          thinkingLevel?: ThinkingLevel;
          systemInstruction: string;
        }
      > = {
        'export-advisor': {
          primaryModel: 'gemini-4-hydrogen',
          thinkingLevel: ThinkingLevel.LOW,
          systemInstruction:
            'You are the dedicated Export Advisor for Sarwar Khawaja Industries Pvt Ltd in Sialkot, Pakistan (directed by Khawaja Irfan, built on the founding legacy of Sarwar Khawaja). Help exporters and international buyers with karate suits, footballs, field hockey sticks, hotballs, custom apparel, and leather jackets—covering MOQs, OEM customization, sample dispatch via Sialkot International Airport (SKT), and buyer outreach.',
        },
        'fast-spec': {
          primaryModel: 'gemini-3.1-flash-lite',
          systemInstruction:
            'You are the Fast Product Spec & Quote Assistant for Sarwar Khawaja Industries Pvt Ltd (Sialkot). Give crisp, fast, practical answers on fabric GSM weights (e.g. 10oz-16oz karate canvas), 32-panel PU football specs, Toray carbon layup ratios, full-grain cowhide/lambskin leather grades, HS codes, and lead times.',
        },
        'compliance-strategist': {
          primaryModel: 'gemini-4-hydrogen',
          thinkingLevel: ThinkingLevel.HIGH,
          systemInstruction:
            'You are the Senior International Trade & Compliance Strategist for Sarwar Khawaja Industries Pvt Ltd (Sialkot). Reason deeply about destination customs duties, WKF/FIFA/FIH/OEKO-TEX/REACH certifications, Incoterms (FOB Sialkot, CIF, DDP), container logistics (SKT air cargo vs. Port Qasim sea freight), and B2B negotiation strategy.',
        },
      };

      const selectedRole = roleConfigs[roleId] || roleConfigs['export-advisor'];
      const ai = getAiClient();

      const sanitizedHistory = Array.isArray(history)
        ? history
            .slice(-16)
            .filter(
              (m: any) =>
                m &&
                (m.role === 'user' || m.role === 'model') &&
                typeof m.text === 'string' &&
                m.text.trim().length > 0
            )
            .map((m: any) => ({
              role: m.role,
              parts: [{ text: String(m.text).slice(0, 4000) }],
            }))
        : [];

      let replyText = '';
      let modelUsed = selectedRole.primaryModel;

      const sendChat = async (model: string, thinkingLevel?: ThinkingLevel) => {
        const config: any = {
          systemInstruction: selectedRole.systemInstruction,
        };
        if (thinkingLevel && model === 'gemini-4-hydrogen') {
          config.thinkingConfig = { thinkingLevel };
        }
        const chat = ai.chats.create({
          model,
          config,
          history: sanitizedHistory,
        });
        const result = await chat.sendMessage({ message: message.trim().slice(0, 4000) });
        return (result.text ?? '').trim();
      };

      try {
        replyText = await sendChat(selectedRole.primaryModel, selectedRole.thinkingLevel);
      } catch (err1) {
        if (!isTransientOrQuotaError(err1) || selectedRole.primaryModel === 'gemini-3.1-flash-lite') {
          throw err1;
        }
        modelUsed = 'gemini-3.1-flash-lite';
        replyText = await sendChat('gemini-3.1-flash-lite');
      }

      res.json({
        reply: replyText,
        modelUsed,
      });
    } catch (err) {
      console.error('Chatbot error:', err);
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 9. Export Market Insights Weekly Subscription & AI Demand Report Generation
  app.get('/api/insights/subscriptions', async (_req: Request, res: Response) => {
    try {
      const items = await readStoredSubscriptions();
      res.json({ subscriptions: items });
    } catch {
      res.status(500).json({ error: 'Failed to load insight subscriptions.' });
    }
  });

  app.post('/api/insights/subscribe', async (req: Request, res: Response) => {
    try {
      const {
        subscriberName,
        email,
        companyName = '',
        role = 'Sialkot Exporter / Manufacturer',
        productCategories,
        targetRegions,
        focusNotes = '',
      } = req.body ?? {};

      if (
        !subscriberName ||
        !email ||
        !Array.isArray(productCategories) ||
        productCategories.length === 0 ||
        !Array.isArray(targetRegions) ||
        targetRegions.length === 0
      ) {
        return res.status(400).json({
          error: 'Name, email, at least one product category, and one target region are required.',
        });
      }

      const cleanCategories = productCategories.slice(0, 8).map((c: any) => String(c).slice(0, 80));
      const cleanRegions = targetRegions.slice(0, 8).map((r: any) => String(r).slice(0, 80));
      const ai = getAiClient();

      const latestReport = await generateWeeklyDemandReport(
        ai,
        cleanCategories,
        cleanRegions,
        String(role).slice(0, 80),
        String(focusNotes).slice(0, 800),
        1
      );

      const subscription = {
        id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        subscriberName: String(subscriberName).slice(0, 100),
        email: String(email).slice(0, 120),
        companyName: String(companyName).slice(0, 140),
        role: String(role).slice(0, 80),
        productCategories: cleanCategories,
        targetRegions: cleanRegions,
        frequency: 'weekly' as const,
        focusNotes: String(focusNotes).slice(0, 800),
        status: 'active' as const,
        latestReport,
        createdAt: new Date().toISOString(),
      };

      const existing = await readStoredSubscriptions();
      await writeStoredSubscriptions([subscription, ...existing].slice(0, 100));

      res.status(201).json({ subscription });
    } catch (err) {
      console.error('Insights subscribe error:', err);
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/insights/refresh/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const existing = await readStoredSubscriptions();
      const idx = existing.findIndex((item) => item.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: 'Subscription not found.' });
      }
      const sub = existing[idx];
      const currentIssue = Number(String(sub.latestReport?.issueNumber || '').match(/W(\d+)/)?.[1] || 1);
      const ai = getAiClient();
      const latestReport = await generateWeeklyDemandReport(
        ai,
        sub.productCategories || ['Karate Suits'],
        sub.targetRegions || ['Europe'],
        sub.role || 'Exporter',
        sub.focusNotes || '',
        currentIssue + 1
      );
      existing[idx] = { ...sub, latestReport };
      await writeStoredSubscriptions(existing);
      res.json({ subscription: existing[idx] });
    } catch (err) {
      console.error('Refresh insights report error:', err);
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.patch('/api/insights/subscriptions/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body ?? {};
      if (status !== 'active' && status !== 'paused') {
        return res.status(400).json({ error: 'Status must be active or paused.' });
      }
      const existing = await readStoredSubscriptions();
      const idx = existing.findIndex((item) => item.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: 'Subscription not found.' });
      }
      existing[idx] = { ...existing[idx], status };
      await writeStoredSubscriptions(existing);
      res.json({ subscription: existing[idx] });
    } catch {
      res.status(500).json({ error: 'Failed to update subscription status.' });
    }
  });

  // 10. AI Customs Tariff & Freight Route Verification for Cost Calculator
  app.post('/api/cost-estimate', async (req: Request, res: Response) => {
    const {
      destinationCountry = 'Germany',
      productName = 'Karate Suits & Martial Arts Gi',
      hsCode = '6203.22',
      weightKg = 150,
      freightMode = 'Air Cargo (SKT)',
      fobUsd = 2400,
    } = req.body ?? {};

    try {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: `As an international export logistics specialist at Sarwar Khawaja Industries Pvt Ltd in Sialkot, Pakistan, provide a concise customs & routing note for this shipment:
Product: ${productName} (HS ${hsCode})
Destination: ${destinationCountry}
Weight: ${weightKg} kg
Freight Mode: ${freightMode}
FOB Value: $${fobUsd} USD

Include: (1) Whether Pakistan origin qualifies for preferential duty programs like EU GSP+ / REX or UK DCTS, (2) Required Sialkot export documents (Commercial Invoice, Packing List, Certificate of Origin from SCCI / REX statement), and (3) One practical cost-saving tip for this weight bracket.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              preferentialProgram: { type: Type.STRING },
              requiredDocuments: { type: Type.STRING },
              logisticsTip: { type: Type.STRING },
            },
            required: ['preferentialProgram', 'requiredDocuments', 'logisticsTip'],
          },
        },
      });

      const advisory = tryParseLooseJson(response.text ?? '{}');
      if (!advisory) throw new Error('Invalid advisory JSON');
      res.json({ advisory });
    } catch (err) {
      if (isTransientOrQuotaError(err)) {
        const destLower = String(destinationCountry).toLowerCase();
        const isEu = /germany|france|netherlands|spain|italy|belgium|europe/.test(destLower);
        const isUk = /united kingdom|uk/.test(destLower);
        return res.json({
          advisory: {
            preferentialProgram: isEu
              ? `Pakistan exports to ${destinationCountry} qualify for 0% customs duty under the EU GSP+ scheme with a registered REX origin declaration.`
              : isUk
              ? `Pakistan exports to ${destinationCountry} qualify for 0% preferential customs duty under the UK Developing Countries Trading Scheme (DCTS).`
              : `Standard MFN or GSP tariff schedule applies for HS ${hsCode} entering ${destinationCountry} from Sialkot, Pakistan.`,
            requiredDocuments:
              'Commercial Invoice, Packing List, Sialkot Chamber of Commerce (SCCI) Certificate of Origin, REX/DCTS origin statement (if applicable), and Airway Bill / Bill of Lading.',
            logisticsTip:
              Number(weightKg) >= 300
                ? 'At 300+ kg, request consolidated SKT Air Cargo tier rates or Sialkot Dry Port to Port Qasim LCL sea consolidation to lower per-kg landed freight.'
                : 'For shipments under 300 kg, SKT Airport-to-Airport cargo paired with pre-cleared importer customs broker paperwork minimizes terminal storage fees.',
          },
          fallback: true,
        });
      }
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sarwar Khawaja Industries Pvt Ltd Export Hub running on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
