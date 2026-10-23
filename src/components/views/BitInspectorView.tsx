import React, { useState, useRef, useEffect } from 'react';
import { Sliders, ShieldCheck, Layers, AlertCircle, Sparkles } from 'lucide-react';
import { useSecurityContext } from '../../context/SecurityContext';

export const BitInspectorView: React.FC = () => {
  const [activeBitPlane, setActiveBitPlane] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tampered, setTampered] = useState(false);
  const { logActivity, showToast } = useSecurityContext();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = 400;
    const h = 260;
    canvas.width = w;
    canvas.height = h;

    const imgData = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        // Natural frequency contour gradient
        const baseVal = Math.floor(
          Math.sin(x / 40) * 40 + Math.cos(y / 40) * 40 + (x / w) * 120 + 80
        );

        // Extract active bit (0 to 7)
        let bit = (baseVal >> activeBitPlane) & 1;

        if (tampered && activeBitPlane === 0 && x > 150 && x < 250 && y > 100 && y < 160) {
          bit ^= 1; // Simulated tamper region
        }

        const displayVal = bit ? 245 : 15;
        // Cyan-tinted monochrome raster
        imgData.data[idx] = Math.round(displayVal * 0.7);
        imgData.data[idx + 1] = Math.round(displayVal * 0.95);
        imgData.data[idx + 2] = displayVal;
        imgData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }, [activeBitPlane, tampered]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Banner */}
      <div className="rounded-2xl border border-slate-200/90 bg-white px-6 py-5 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600 border border-violet-200">
              <Sliders className="h-4 w-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Bit Inspector
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
            Deconstruct 24-bit RGB raster pixels into isolated bit planes to observe spatial entropy differences.
          </p>
        </div>
        <div className="text-xs font-mono bg-violet-50 px-3 py-1.5 rounded-xl border border-violet-200 text-violet-700 shrink-0 font-semibold">
          Plane {activeBitPlane}: {activeBitPlane === 0 ? 'LSB Carrier (Payload)' : activeBitPlane === 7 ? 'MSB Structure' : 'Intermediate'}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Canvas Decomposer */}
        <div className="lg:col-span-8 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Spatial Bit Plane Decomposition</h3>
              <p className="text-xs text-slate-500">
                Bit 7 (MSB) holds major photographic contours; Bit 0 (LSB) exhibits pseudo-random white noise.
              </p>
            </div>
            <button
              onClick={() => {
                const nextTampered = !tampered;
                setTampered(nextTampered);
                if (nextTampered) {
                  logActivity({
                    type: 'error',
                    title: 'Bit Tamper Injected',
                    detail: 'Simulated 1-bit alteration injected in bit plane 0 spatial raster',
                    status: 'warning'
                  });
                  showToast('Simulated bit tampering in LSB plane', 'info');
                } else {
                  showToast('Bit tampering reverted', 'info');
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                tampered
                  ? 'bg-rose-50 border-rose-300 text-rose-700 font-semibold'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tampered ? 'Revert Bit Tamper' : 'Simulate Bit Tamper'}
            </button>
          </div>

          <div className="rounded-xl overflow-hidden border border-slate-800 bg-[#080D19] aspect-video flex items-center justify-center p-2">
            <canvas ref={canvasRef} className="w-full h-full object-contain rounded-lg" />
          </div>

          {/* Plane Selector Tabs */}
          <div>
            <div className="text-xs font-bold text-slate-800 mb-2">Select Active Bit Plane:</div>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((b) => (
                <button
                  key={b}
                  onClick={() => {
                    setActiveBitPlane(b);
                    logActivity({
                      type: 'verify',
                      title: `Bit Plane ${b} Inspected`,
                      detail: b === 0 ? 'LSB carrier plane (random white noise profile)' : b === 7 ? 'MSB structural contours' : `Intermediate bit plane ${b}`,
                      status: 'info'
                    });
                  }}
                  className={`py-2 text-xs font-mono font-bold rounded-xl transition-all cursor-pointer ${
                    activeBitPlane === b
                      ? 'bg-[#7C3AED] text-white shadow-xs'
                      : 'bg-[#F8FAFC] text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  B{b} {b === 0 ? '(LSB)' : b === 7 ? '(MSB)' : ''}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Technical Invariants */}
        <div className="lg:col-span-4 space-y-5">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Layers className="h-4 w-4 text-violet-600" />
              <span>Steganographic Invariants</span>
            </h4>
            <div className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-slate-100">
                <div className="font-bold text-slate-900">Why LSB Works:</div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Modifying bit 0 alters an 8-bit channel by only &plusmn;1 out of 255 (0.39%). The human eye cannot detect this minor variance across millions of pixels.
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-slate-100">
                <div className="font-bold text-slate-900">Why AES-GCM is Required:</div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Steganography conceals data, but cannot prevent alteration. AES-GCM provides an authenticated 128-bit tag, instantly rejecting tampered images.
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Steganalysis Resistance
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Chi-square statistical tests analyze adjacent pixel pairs. Because SecretPixel embeds high-entropy AES ciphertext uniformly across channels, standard frequency attacks fail to identify the message presence.
            </p>
            <div className="pt-2 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-violet-700">
              <ShieldCheck className="h-4 w-4 text-violet-600" />
              <span>Lossless 24-bit Carrier Support</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
