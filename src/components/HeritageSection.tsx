import React from 'react';
import { ArrowRight, Award, Globe2, ShieldCheck } from 'lucide-react';

interface HeritageSectionProps {
  onOpenCustomOrder: () => void;
  onInspect3DShowroom: () => void;
}

export const HeritageSection: React.FC<HeritageSectionProps> = ({
  onOpenCustomOrder,
  onInspect3DShowroom,
}) => {
  return (
    <div className="space-y-6">
      {/* Editorial Hero */}
      <div className="relative rounded-xl overflow-hidden border border-white/10 bg-[#101829]">
        <img
          src="/src/assets/images/sialkot_craft_heritage_1795300341626.jpg"
          alt="Sialkot artisan hand-stitching footballs and karate uniforms at Sarwar Khawaja Industries Pvt Ltd"
          referrerPolicy="no-referrer"
          className="w-full h-52 object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c121e] via-[#0c121e]/75 to-transparent" />
        <div className="relative p-5 -mt-20 space-y-2">
          <div className="flex items-center gap-3">
            <img
              src="/src/assets/images/sialkot_export_crest_1795300340917.jpg"
              alt="Sarwar Khawaja Industries Pvt Ltd crest seal"
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-lg object-cover border border-amber-400/40 shrink-0"
            />
            <div>
              <div className="text-xs font-medium text-amber-300">
                Sialkot, Punjab, Pakistan · Three Generations of Craft
              </div>
              <h2 className="text-xl font-bold text-white leading-tight text-balance">
                Sarwar Khawaja Industries Pvt Ltd
              </h2>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Built on the discipline of Sialkot master craftsmen, our family enterprise pairs hand-finished sports and apparel manufacturing with direct international OEM execution.
          </p>
        </div>
      </div>

      {/* Lineage Storytelling Chapters */}
      <div className="space-y-4">
        <div className="border border-white/10 bg-[#101829] rounded-xl p-4 space-y-2">
          <div className="text-xs font-semibold text-amber-300">01. The Foundation — Sarwar Khawaja</div>
          <h3 className="text-sm font-semibold text-white">
            A Craftsman’s Standard Forged in Sialkot
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Our story began with grandfather <strong className="text-white">Sarwar Khawaja</strong>, whose workshops in Sialkot earned lasting trust from international buyers through one unbreakable rule: every stitch, hide grade, and cotton weave leaving the bench had to carry our family name with pride. From hand-stitched match footballs to heavyweight canvas martial arts uniforms, his insistence on honest materials and consistent sizing turned first-time importers into decades-long partners.
          </p>
        </div>

        <div className="border border-white/10 bg-[#101829] rounded-xl p-4 space-y-2">
          <div className="text-xs font-semibold text-amber-300">02. Industrial Expansion — Khawaja Irfan</div>
          <h3 className="text-sm font-semibold text-white">
            Scaling Custom OEM Exports Worldwide
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Continuing his father’s legacy, <strong className="text-white">Khawaja Irfan</strong> incorporated <strong className="text-white">Sarwar Khawaja Industries Pvt Ltd</strong> and modernized production lines across five core divisions: Karate Suits &amp; Martial Arts Gear, FIFA-spec Footballs, Composite Field Hockey Sticks, Hotballs, and Custom Sportswear &amp; Full-Grain Leather Jackets. Under his leadership, our factory streamlined private-label embroidery, custom pattern grading, and rapid air-sample dispatch via Sialkot International Airport (SKT).
          </p>
        </div>

        <div className="border border-white/10 bg-[#101829] rounded-xl overflow-hidden">
          <img
            src="/src/assets/images/karate_football_studio_1795300342088.jpg"
            alt="Finished karate gi, hand-stitched match ball, and carbon hockey stick"
            referrerPolicy="no-referrer"
            className="w-full h-40 object-cover"
          />
          <div className="p-4 space-y-2">
            <div className="text-xs font-semibold text-amber-300">03. Reliability &amp; Craftsmanship Guarantee</div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Every bulk shipment undergoes pre-production swatch approval, in-line stitch tension verification, and final piece-by-piece weight and dimension auditing before leaving Sialkot.
            </p>
          </div>
        </div>
      </div>

      {/* Proof Pillars */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="border border-white/10 bg-[#101829] rounded-xl p-3.5 space-y-1">
          <Award className="w-4 h-4 text-amber-400" />
          <div className="text-xs font-semibold text-white">Custom OEM Mastery</div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Bespoke GSM weaves, club graphics, leather hides, and private-label tags.
          </p>
        </div>
        <div className="border border-white/10 bg-[#101829] rounded-xl p-3.5 space-y-1">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <div className="text-xs font-semibold text-white">Export Compliance</div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Built to WKF, FIFA Quality, FIH, and European REACH standards.
          </p>
        </div>
        <div className="border border-white/10 bg-[#101829] rounded-xl p-3.5 space-y-1">
          <Globe2 className="w-4 h-4 text-amber-400" />
          <div className="text-xs font-semibold text-white">Direct Sialkot Dispatch</div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Air express samples via SKT and FCL/LCL sea freight worldwide.
          </p>
        </div>
      </div>

      {/* CTAs */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="button"
          onClick={onOpenCustomOrder}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0"
        >
          <span>Request Custom OEM Order</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onInspect3DShowroom}
          className="px-4 py-2.5 text-xs font-medium bg-white/10 text-white rounded-lg hover:bg-white/15 transition-colors whitespace-nowrap shrink-0"
        >
          Inspect 3D Craft Models
        </button>
      </div>
    </div>
  );
};
