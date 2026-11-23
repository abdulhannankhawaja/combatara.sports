export type ProductCategoryId =
  | 'karate-suits'
  | 'footballs'
  | 'hockeys'
  | 'hotballs'
  | 'apparels-leather'
  | 'custom';

export type SceneSubjectId = ProductCategoryId | 'export-globe';

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'sample_sent'
  | 'negotiating'
  | 'won'
  | 'archived';

export type InquiryStatus = 'received' | 'reviewing' | 'quoted' | 'sample_prepared' | 'closed';

export interface ProductFinishOption {
  id: string;
  label: string;
  primaryHex: string;
  accentHex: string;
  roughness: number;
  metalness: number;
}

export interface ExportProductSpec {
  id: Exclude<ProductCategoryId, 'custom'>;
  name: string;
  shortLabel: string;
  hsCode: string;
  moq: string;
  leadTime: string;
  certifications: string[];
  materials: string;
  customOemOptions: string;
  finishes: ProductFinishOption[];
  inspectableParts: { partKey: string; title: string; spec: string }[];
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface MapsPlaceChunk {
  title: string;
  uri: string;
  placeId?: string;
  reviewSnippets?: string[];
}

export interface DiscoveredLead {
  id: string;
  companyName: string;
  country: string;
  city: string;
  buyerType: string;
  productCategory: ProductCategoryId;
  website: string;
  contactEmail: string;
  contactPhone: string;
  sourcingSignal: string;
  estimatedOrderVolume: string;
  fitReason: string;
  leadScore: number;
  scoreReasons?: string[];
  tariffAdvantage?: string;
  matchedKeyword?: string;
  recentActivity?: string;
  lat: number;
  lng: number;
  sourceUri?: string;
  sourceTitle?: string;
}

export interface SavedExportLead {
  id: string;
  ownerId: string;
  companyName: string;
  country: string;
  city: string;
  buyerType: string;
  productCategory: ProductCategoryId;
  website: string;
  contactEmail: string;
  contactPhone: string;
  sourcingSignal: string;
  estimatedOrderVolume: string;
  leadScore?: number;
  matchedKeyword?: string;
  status: LeadStatus;
  sourceUri: string;
  sourceTitle: string;
  outreachPitch: string;
  strategyNotes: string;
  lat?: number;
  lng?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ExporterProfile {
  uid: string;
  companyName: string;
  directorName: string;
  founderHeritage: string;
  city: string;
  email: string;
  phone: string;
  ntnOrChamberId: string;
  specialties: string[];
  customOrdersEnabled: boolean;
  minOrderUnits: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SearchCampaign {
  id: string;
  ownerId: string;
  productCategory: string;
  targetRegion: string;
  buyerType: string;
  customSpecs: string;
  leadCount: number;
  summary: string;
  createdAt?: unknown;
}

export interface DeepAnalysisResult {
  hsCodeAndDuties: string;
  complianceChecklist: string[];
  pricingAndMoqStrategy: string;
  logisticsRoute: string;
  emailSubject: string;
  emailBody: string;
  whatsappIntro: string;
  voiceBriefingScript: string;
}

export interface CustomOrderInquiry {
  id: string;
  referenceCode: string;
  buyerName: string;
  companyName: string;
  country: string;
  email: string;
  phone: string;
  productCategories: string[];
  quantity: number;
  customizationDetails: string;
  referenceImages: { name: string; dataUrl: string }[];
  status: InquiryStatus;
  aiTriageSummary: string;
  createdAt: string;
}

export interface WeeklyDemandReport {
  issueNumber: string;
  generatedAt: string;
  headline: string;
  executiveSummary: string;
  topDemandSignals: {
    category: string;
    region: string;
    trend: string;
    recommendedAction: string;
  }[];
  sialkotPricingWatch: string;
}

export interface InsightSubscription {
  id: string;
  subscriberName: string;
  email: string;
  companyName: string;
  role: string;
  productCategories: string[];
  targetRegions: string[];
  frequency: 'weekly';
  focusNotes: string;
  status: 'active' | 'paused';
  latestReport: WeeklyDemandReport;
  createdAt: string;
}

export type ChatbotRoleId = 'export-advisor' | 'fast-spec' | 'compliance-strategist';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  modelUsed?: string;
  timestamp: string;
}

