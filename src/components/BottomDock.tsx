import React from 'react';
import { ChevronDown, ChevronUp, Eye, Globe2, Layers } from 'lucide-react';
import { EXPORT_PRODUCTS } from '../data/sialkotCatalog.ts';
import { ProductFinishOption, SceneSubjectId } from '../types/exportHub.ts';
import { CameraPresetId } from './ShowroomCanvas.tsx';

interface BottomDockProps {
  subjectId: SceneSubjectId;
  onSelectSubject: (id: SceneSubjectId) => void;
  selectedFinish: ProductFinishOption;
  onSelectFinish: (finish: ProductFinishOption) => void;
  explodeAmount: number;
  onChangeExplode: (val: number) => void;
  cameraPreset: CameraPresetId;
  onSelectCameraPreset: (preset: CameraPresetId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  subjectId,
  onSelectSubject,
  selectedFinish,
  onSelectFinish,
  explodeAmount,
  onChangeExplode,
  cameraPreset,
  onSelectCameraPreset,
  collapsed,
  onToggleCollapse,
}) => {
  const activeProduct = EXPORT_PRODUCTS.find((p) => p.id === subjectId);

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none"
      style={{ maxWidth: 'min(960px, 95vw)', width: 'max-content' }}
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        className="pointer-events-auto mb-1.5 inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-200 bg-[#0d1422] border border-white/15 rounded-md hover:bg-[#162035] transition-colors whitespace-nowrap shrink-0"
        title="Toggle 3D controls (Shortcut: H)"
      >
        {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        <span>{collapsed ? 'Show Controls' : 'Hide Controls'}</span>
      </button>

      {!collapsed && (
        <div
          className="pointer-events-auto w-full rounded-xl border border-white/15 px-4 py-3 shadow-2xl"
          style={{ backgroundColor: 'rgba(11, 16, 27, 0.94)' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Subject Switcher */}
            <div className="flex items-center gap-1 p-1 bg-[#080c15] rounded-lg border border-white/10 overflow-x-auto max-w-full">
              {EXPORT_PRODUCTS.map((prod) => {
                const active = subjectId === prod.id;
                return (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => onSelectSubject(prod.id)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {prod.shortLabel}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => onSelectSubject('export-globe')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  subjectId === 'export-globe'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Globe2 className="w-3.5 h-3.5" />
                <span>Trade Globe</span>
              </button>
            </div>

            {/* Craft Layer Explode + Finish + Camera */}
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-slate-300 whitespace-nowrap shrink-0">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>Explode</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={explodeAmount}
                  onChange={(e) => onChangeExplode(parseFloat(e.target.value))}
                  className="w-20 accent-amber-500 cursor-pointer"
                  aria-label="Exploded construction slider"
                />
                <span className="font-mono text-[11px] text-slate-400 w-8 text-right tabular-nums">
                  {Math.round(explodeAmount * 100)}%
                </span>
              </label>

              {activeProduct && (
                <div className="flex items-center gap-1.5 shrink-0" role="group" aria-label="Material finish">
                  {activeProduct.finishes.map((fin) => {
                    const active = selectedFinish.id === fin.id;
                    return (
                      <button
                        key={fin.id}
                        type="button"
                        onClick={() => onSelectFinish(fin)}
                        title={fin.label}
                        className={`w-5 h-5 rounded-full border transition-transform ${
                          active ? 'border-amber-400 scale-110' : 'border-white/25 hover:scale-105'
                        }`}
                        style={{
                          background: `linear-gradient(135deg, ${fin.primaryHex} 55%, ${fin.accentHex} 55%)`,
                        }}
                      />
                    );
                  })}
                </div>
              )}

              <div className="flex items-center gap-1 p-0.5 bg-[#080c15] rounded-lg border border-white/10 shrink-0">
                <Eye className="w-3.5 h-3.5 text-slate-400 mx-1.5" />
                {(['hero', 'detail', 'top'] as CameraPresetId[]).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => onSelectCameraPreset(preset)}
                    className={`px-2 py-1 text-[11px] font-medium rounded-md capitalize transition-colors whitespace-nowrap shrink-0 ${
                      cameraPreset === preset
                        ? 'bg-white/15 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
