import { useState, useMemo, useRef } from 'react';
import { X, Sliders, Play, Square, Trophy, Plus, AlertTriangle, Activity } from 'lucide-react';
import { runGridSearch } from '../optimizer/gridSearch.js';
import { SURFACE_OPTIONS, TIRE_OPTIONS, simulateRunLight } from '../optimizer/simRunner.js';

// min/max/step'ten kaç farklı değer üretileceğini hesapla.
function countSteps({ min, max, step }) {
  if (step <= 0 || min > max) return 1;
  return Math.floor((max - min) / step) + 1;
}

// Delta değerini yeşil (+) / kırmızı (−) olarak formatla. lowerIsBetter:
// ET/slip gibi düşük olan iyi ise true; trap gibi yüksek olan iyi ise false.
function fmtDelta(delta, unit, lowerIsBetter) {
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.005) {
    return <span className="text-gray-600">—</span>;
  }
  const better = lowerIsBetter ? delta < 0 : delta > 0;
  return (
    <span className={better ? 'text-green-400' : 'text-red-400'}>
      {delta > 0 ? '+' : ''}{delta.toFixed(unit === 'kmh' ? 1 : 3)}{unit === 'kmh' ? '' : 's'}
      {unit === 'kmh' ? ' km/h' : ''}
    </span>
  );
}

function RangeField({ label, unit, range, onChange, defaultStep }) {
  const steps = countSteps(range);
  return (
    <div className="bg-black/30 border border-gray-800 rounded p-3">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-gray-400">{label}</span>
        <span className="text-xs text-gray-500">{steps} değer</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="text-[10px] text-gray-500 uppercase">min</span>
          <input
            type="number"
            value={range.min}
            onChange={(e) => onChange({ ...range, min: Number(e.target.value) })}
            className="w-full bg-black border border-gray-700 rounded p-1 text-white text-sm focus:border-red-500 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-[10px] text-gray-500 uppercase">max</span>
          <input
            type="number"
            value={range.max}
            onChange={(e) => onChange({ ...range, max: Number(e.target.value) })}
            className="w-full bg-black border border-gray-700 rounded p-1 text-white text-sm focus:border-red-500 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-[10px] text-gray-500 uppercase">adım</span>
          <input
            type="number"
            min={defaultStep}
            value={range.step}
            onChange={(e) => onChange({ ...range, step: Math.max(1, Number(e.target.value)) })}
            className="w-full bg-black border border-gray-700 rounded p-1 text-white text-sm focus:border-red-500 focus:outline-none"
          />
        </label>
      </div>
      <div className="text-[10px] text-gray-500 mt-1">
        {range.min}–{range.max} {unit}
      </div>
    </div>
  );
}

// Sayısal slider + manual input ikilisi.
function NumberConstraint({ label, value, onChange, min, max, step, suffix, disabled, hint }) {
  return (
    <div className={`bg-black/30 border border-gray-800 rounded p-3 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-gray-400">{label}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={value ?? ''}
            disabled={disabled}
            onChange={(e) => {
              const v = e.target.value === '' ? null : Number(e.target.value);
              onChange(v);
            }}
            min={min}
            max={max}
            step={step}
            className="w-20 bg-black border border-gray-700 rounded p-1 text-white text-sm font-mono text-right focus:border-purple-500 focus:outline-none disabled:cursor-not-allowed"
          />
          {suffix && <span className="text-xs text-gray-500">{suffix}</span>}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value ?? min}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-purple-500 disabled:cursor-not-allowed"
      />
      {hint && <p className="text-[10px] text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}

// Genel multi-select toggle. Drivetrain, surface, tire için ortak.
// values: aktif id'ler, options: [{id, label}, ...], boş array → "sadece default kullanılır".
function OptionToggle({ values, onChange, options, dense = false }) {
  const toggle = (id) => {
    if (values.includes(id)) {
      onChange(values.filter((v) => v !== id));
    } else {
      onChange([...values, id]);
    }
  };
  return (
    <div className={`flex gap-1 ${dense ? 'flex-col' : ''}`}>
      {options.map((opt) => {
        const active = values.includes(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => toggle(opt.id)}
            className={`${dense ? 'w-full text-left' : 'flex-1'} py-2 px-2 rounded text-xs font-bold border transition-colors ${
              active
                ? 'bg-purple-600 border-purple-500 text-white'
                : 'bg-black border-gray-700 text-gray-500 hover:border-gray-500'
            }`}
            title={opt.label}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// Mod → varsayılan hedef süre (saniye). Top Speed'de süre kavramı farklı → null.
const TARGET_DEFAULTS = {
  '200m': 7.0,
  '400m': 10.0,
  '800m': 15.0,
  '0-100': 3.5,
  '100-200': 5.0,
  'Top Speed': null
};

// 4 preset. Yeni anlam: sadece "ne kadar sıkı tutunma istiyorsun?"
const PRESETS = [
  { id: 'balanced',  label: 'Kombine / Dengeli',  maxSlip: 1.0, hint: 'Standart: 1s altı slip' },
  { id: 'et_speed',  label: '1/4 Mil Hız',         maxSlip: 2.0, hint: 'Toleranslı: agresif HP/NOS\'a izinli' },
  { id: 'low_slip',  label: 'Düşük Patinaj',       maxSlip: 0.5, hint: 'Sıkı: 0.5s altı slip zorunlu' },
  { id: 'max_speed', label: 'Maksimum Hız',        maxSlip: 1.5, hint: 'Orta: trap speed\'i yüksek tutar' }
];

// options array'inden id → kısa label map'i. "(...)" parantezli açıklamayı atarız
// tablo hücresinde yer kazanmak için.
function shortLabel(options, id) {
  if (!id) return '—';
  const o = options.find((opt) => opt.id === id);
  if (!o) return id;
  return o.label.split(' (')[0];
}

function ResultRow({ entry, rank, baseline, onApply, onVerify, verifyingId, verified }) {
  const p = entry.params;
  const r = entry.result;
  const b = baseline;
  const etDelta = b.elapsed_time_s - r.elapsed_time_s;
  const sixtyDelta = b.split_60ft_s - r.split_60ft_s;
  const trapDelta = r.speed_at_end_kmh - b.speed_at_end_kmh;
  const slipDelta = b.total_slip_time_s - r.total_slip_time_s;

  // surface/tire grid'de set edildiyse göster (sadece bilgi)
  const showSurfaceTire = p.surface != null && p.tire != null;
  // NOS config'de var ama simülasyonda hiç basılmadıysa kullanıcıya bildir
  const nosConfigured = p.nos > 0;
  const nosFired = r.nos_trigger != null;

  return (
    <tr className={`border-b border-gray-800/50 ${rank === 0 ? 'bg-yellow-900/10' : ''}`}>
      <td className="py-3 pl-3 text-gray-500 font-bold">#{rank + 1}</td>
      <td className="py-3 text-white font-mono text-xs">
        {p.hp} HP<br />
        <span className="text-gray-500">{p.torque} Nm · {p.weight} kg</span>
        {p.launchGear && p.launchGear !== 1 && (
          <span className="block text-orange-300 text-[10px] mt-0.5">kalkış: {p.launchGear}. vites</span>
        )}
      </td>
      <td className="py-3 text-white font-mono text-xs">
        {p.nos} NOS<br />
        <span className="text-amber-400 font-bold">{p.drivetrain}</span>
        {showSurfaceTire && (
          <span className="block text-gray-500 text-[10px] mt-0.5">
            {shortLabel(SURFACE_OPTIONS, p.surface)} · {shortLabel(TIRE_OPTIONS, p.tire)}
          </span>
        )}
      </td>
      <td className="py-3 font-mono text-xs">
        <div className="text-amber-400 font-bold">{r.elapsed_time_s.toFixed(3)}s {fmtDelta(etDelta, 's', true)}</div>
        <div className="text-gray-400">60ft: {r.split_60ft_s.toFixed(3)}s {fmtDelta(sixtyDelta, 's', true)}</div>
        {(r.gear_shifts && r.gear_shifts.length > 0) || r.nos_trigger || (nosConfigured && !nosFired) ? (
          <div className="mt-1 pt-1 border-t border-gray-800/50">
            {r.gear_shifts && r.gear_shifts.map((s, i) => (
              <div key={i} className="text-[10px] text-purple-300">
                {i + 1}→{s.gear}: {(s.rpm / 1000).toFixed(1)}k @ {s.time.toFixed(2)}s
              </div>
            ))}
            {r.nos_trigger ? (
              <div className="text-[10px] mt-0.5">
                <span className="text-blue-300 font-bold">NOS: {r.nos_trigger.gear}. vites</span>
                <span className="text-gray-500"> @ {Math.round(r.nos_trigger.speed_kmh)} km/h · {(r.nos_trigger.rpm / 1000).toFixed(1)}k @ {r.nos_trigger.time.toFixed(2)}s</span>
              </div>
            ) : nosConfigured ? (
              <div className="text-[10px] text-yellow-500/80 mt-0.5">
                NOS basılmadı (araç 2. vitese / 50 km/h üstüne ulaşamadı)
              </div>
            ) : null}
          </div>
        ) : null}
      </td>
      <td className="py-3 font-mono text-xs">
        <div className="text-white">{r.speed_at_end_kmh.toFixed(1)} km/h {fmtDelta(trapDelta, 'kmh', false)}</div>
        <div className="text-gray-400">slip: {r.total_slip_time_s.toFixed(2)}s {fmtDelta(slipDelta, 's', true)}</div>
      </td>
      <td className="py-3 font-mono text-sm text-purple-400 font-bold">
        {entry.score.toFixed(2)}
      </td>
      <td className="py-3 pr-3">
        <button
          onClick={() => onApply(entry)}
          className="text-xs bg-green-700 hover:bg-green-600 text-white px-2 py-1 rounded flex items-center gap-1"
          title="Bu setupu yarış listesine ekle"
        >
          <Plus size={12} /> Ekle
        </button>
        <button
          onClick={() => onVerify(entry, rank)}
          disabled={verifyingId === rank}
          className="text-xs bg-blue-700 hover:bg-blue-600 disabled:bg-blue-900 disabled:opacity-60 text-white px-2 py-1 rounded flex items-center gap-1 mt-1"
          title="Aynı parametrelerle simülasyonu yeniden çalıştır — doğrulama"
        >
          <Activity size={12} /> {verifyingId === rank ? '...' : 'Doğrula'}
        </button>
        {verified && (
          <div className={`text-[10px] mt-1 leading-tight ${verified.matched ? 'text-green-400' : 'text-red-400'}`}>
            {verified.matched ? '✓ Eşleşiyor' : `✗ Sapma: ${verified.dt >= 0 ? '+' : ''}${verified.dt.toFixed(3)}s`}
            <br />
            <span className="text-gray-500">
              doğrulanmış: {verified.verified.elapsed_time_s.toFixed(3)}s
            </span>
          </div>
        )}
      </td>
    </tr>
  );
}

function BaselineRow({ baseline, surface, tire }) {
  const b = baseline;
  return (
    <tr className="border-b border-gray-700 bg-gray-800/50">
      <td className="py-2 pl-3">
        <span className="text-[10px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded font-bold">STOCK</span>
      </td>
      <td className="py-2 text-gray-400 font-mono text-xs italic" colSpan={2}>
        Baseline (değiştirilmemiş araç){surface && tire ? ` · ${shortLabel(SURFACE_OPTIONS, surface)} · ${shortLabel(TIRE_OPTIONS, tire)}` : ''}
      </td>
      <td className="py-2 font-mono text-xs text-gray-300">
        ET {b.elapsed_time_s.toFixed(3)}s
      </td>
      <td className="py-2 font-mono text-xs text-gray-300">
        Trap {b.speed_at_end_kmh.toFixed(1)} km/h
      </td>
      <td className="py-2 font-mono text-xs text-gray-500">ref</td>
      <td></td>
    </tr>
  );
}

export default function SetupOptimizerPanel({ car, raceSettings, onClose, onApplyToLobby }) {
  // Her aralık için default değerler: stock ± yüzde, makul adım.
  const initialRanges = useMemo(() => {
    const hp = car.hp || 300;
    const tq = car.torque || 400;
    const w = car.weight || 1200;
    return {
      hp: { min: Math.max(50, Math.round(hp * 0.6)), max: Math.round(hp * 1.6), step: Math.max(25, Math.round(hp * 0.1)) },
      torque: { min: Math.max(50, Math.round(tq * 0.7)), max: Math.round(tq * 1.4), step: Math.max(20, Math.round(tq * 0.05)) },
      weight: { min: Math.max(500, Math.round(w * 0.7)), max: Math.round(w * 1.3), step: 50 },
      nos: { min: 0, max: 500, step: 50 }
    };
  }, [car.hp, car.torque, car.weight]);

  const [hpRange, setHpRange] = useState(initialRanges.hp);
  const [tqRange, setTqRange] = useState(initialRanges.torque);
  const [wRange, setWRange] = useState(initialRanges.weight);
  const [nosRange, setNosRange] = useState(initialRanges.nos);
  const [drivetrains, setDrivetrains] = useState(['FWD', 'RWD', 'AWD']);

  // Kalkış vitesi (launch gear): default [1] → mevcut davranış. 2. viteste kalkış
  // yüksek HP RWD'de wheelspin'i azaltır; FWD/AWD'de 1. vites genelde optimum.
  const [launchGears, setLaunchGears] = useState([car.launchGear || 1]);

  // Pist ve lastik: default boş array → sadece raceSettings'ten gelen kullanılır.
  // Kullanıcı 1+ seçerse → o seçenekler grid axis olarak eklenir.
  const [surfaces, setSurfaces] = useState([]);
  const [tires, setTires] = useState([]);

  // Hedef süre: mod değiştiğinde otomatik default'a döner.
  const [targetTime, setTargetTime] = useState(TARGET_DEFAULTS[raceSettings.mode] ?? 10.0);
  const [maxSlip, setMaxSlip] = useState(1.0);
  const [activePreset, setActivePreset] = useState('balanced');
  const lastModeRef = useRef(raceSettings.mode);

  if (lastModeRef.current !== raceSettings.mode) {
    lastModeRef.current = raceSettings.mode;
    setTargetTime(TARGET_DEFAULTS[raceSettings.mode] ?? 10.0);
  }

  const applyPreset = (preset) => {
    setMaxSlip(preset.maxSlip);
    setActivePreset(preset.id);
  };

  const onMaxSlipChange = (v) => {
    setMaxSlip(v);
    setActivePreset(null);
  };

  // Run state.
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0, bestSoFar: null });
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  // Toplam sim sayısı (anlık). Boş array → 1 değer (sadece default).
  const totalSims = useMemo(() => {
    const sfCount = surfaces.length > 0 ? surfaces.length : 1;
    const trCount = tires.length > 0 ? tires.length : 1;
    const lgCount = launchGears.length > 0 ? launchGears.length : 1;
    return (
      countSteps(hpRange) *
      countSteps(tqRange) *
      countSteps(wRange) *
      countSteps(nosRange) *
      drivetrains.length *
      sfCount *
      trCount *
      lgCount
    );
  }, [hpRange, tqRange, wRange, nosRange, drivetrains, surfaces, tires, launchGears]);

  const longRunWarning = useMemo(() => {
    if (results) return null;
    if (totalSims > 5000) {
      return `Bu grid ${totalSims.toLocaleString('tr-TR')} simülasyon — orta modda (400m) 1+ saat sürebilir. Adımları büyütmeyi deneyin.`;
    }
    if (totalSims > 1500) {
      return `${totalSims.toLocaleString('tr-TR')} simülasyon koşulacak. Kısa modda (200m/0-100) 5-15 dakika, uzun modda (400m+) daha uzun sürebilir.`;
    }
    return null;
  }, [totalSims, results]);

  const isTargetTimeActive = targetTime != null;

  const handleStart = async () => {
    setError(null);
    setResults(null);
    setProgress({ completed: 0, total: totalSims, bestSoFar: null });
    setRunning(true);

    const ac = new AbortController();
    abortRef.current = ac;

    const ranges = {
      hp: hpRange,
      torque: tqRange,
      weight: wRange,
      nos: nosRange,
      drivetrains,
      surfaces,
      tires,
      launchGears,
      targetTime_s: targetTime,
      maxSlip_s: maxSlip
    };

    try {
      const r = await runGridSearch(car, raceSettings, ranges, {
        signal: ac.signal,
        topN: 10,
        onProgress: (p) => setProgress(p)
      });
      setResults(r);
    } catch (e) {
      if (e.name !== 'AbortError') {
        setError(e.message || 'Bilinmeyen hata');
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    setRunning(false);
  };

  const handleApply = (entry) => {
    // CRITICAL: launchGear kopyalanmazsa yarış 1. vitesle koşar; 2./3. vitesle
    // kalkışın düşük-slip avantajı kaybolur ve ET optimizer'ın raporladığından
    // sapar. Fallback sırası: entry.params → orijinal car.launchGear → 1.
    const newCar = {
      ...car,
      name: `${car.name} (Optimized)`,
      hp: entry.params.hp,
      torque: entry.params.torque,
      weight: entry.params.weight,
      nosShot: entry.params.nos,
      drivetrain: entry.params.drivetrain,
      launchGear: entry.params.launchGear ?? car.launchGear ?? 1
    };
    // Grid'de farklı surface/tire test edildiyse yarış koşullarını da eşitle.
    // App.jsx <select>'inde tanınmayan (örn. eski 'default' ID'si) değerler
    // sessizce atlanır — dropdown'un boş kalmasını engeller.
    const settingsPatch = {};
    if (
      entry.params.surface &&
      entry.params.surface !== 'default' &&
      entry.params.surface !== raceSettings.surface
    ) {
      settingsPatch.surface = entry.params.surface;
    }
    if (
      entry.params.tire &&
      entry.params.tire !== 'default' &&
      entry.params.tire !== raceSettings.tire
    ) {
      settingsPatch.tire = entry.params.tire;
    }
    onApplyToLobby(newCar, settingsPatch);
  };

  // Doğrulama state'i: idx → { verified, dt, ds, matched }
  const [verifyingId, setVerifyingId] = useState(null);
  const [verifiedResults, setVerifiedResults] = useState({});

  // Bir sonucu aynı parametrelerle yeniden simüle eder. Eğer simülasyon
  // deterministikse (ki 1000Hz sabit dt ile öyle olmalı) rakamlar birebir
  // eşleşmeli. Eşleşmiyorsa kalan bug'ı hızlıca yakalarız.
  const handleVerify = async (entry, idx) => {
    setVerifyingId(idx);
    try {
      const carToTest = {
        ...car,
        hp: entry.params.hp,
        torque: entry.params.torque,
        weight: entry.params.weight,
        nosShot: entry.params.nos,
        drivetrain: entry.params.drivetrain,
        launchGear: entry.params.launchGear ?? car.launchGear ?? 1
      };
      const settingsToTest = {
        ...raceSettings,
        surface: entry.params.surface,
        tire: entry.params.tire
      };
      const verified = await simulateRunLight(carToTest, settingsToTest);
      const dt = verified.elapsed_time_s - entry.result.elapsed_time_s;
      const ds = verified.total_slip_time_s - entry.result.total_slip_time_s;
      setVerifiedResults((prev) => ({
        ...prev,
        [idx]: { verified, dt, ds, matched: Math.abs(dt) < 0.01 && Math.abs(ds) < 0.01 }
      }));
    } finally {
      setVerifyingId(null);
    }
  };

  const percent = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

  // Sonuç banner'ı: hedef karşılanmadıysa uyar, en yakın sonucu göster.
  const targetMissedWarning = useMemo(() => {
    if (!results || !isTargetTimeActive) return null;
    if (results.results.length === 0) {
      return {
        kind: 'empty',
        text: `Hiçbir setup hedef ${targetTime.toFixed(2)}s'yi karşılayamadı. Hedefi yükselt veya grid aralığını genişlet.`
      };
    }
    const best = results.results[0];
    if (best.result.elapsed_time_s > targetTime) {
      const diff = best.result.elapsed_time_s - targetTime;
      return {
        kind: 'missed',
        text: `Hedef ${targetTime.toFixed(2)}s aşılamadı. En yakın sonuç ${best.result.elapsed_time_s.toFixed(3)}s (fark: +${diff.toFixed(3)}s). Hedefi yükseltmeyi veya max slip'i gevşetmeyi dene.`
      };
    }
    return null;
  }, [results, targetTime, isTargetTimeActive]);

  // baseline hangi surface/tire'da koşulduğunu göster
  const baselineSurface = surfaces.length > 0 ? surfaces[0] : raceSettings.surface;
  const baselineTire = tires.length > 0 ? tires[0] : raceSettings.tire;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#111111] bg-gradient-to-br from-[#1a1a1a] to-[#000000] border border-gray-700 rounded-xl w-full max-w-4xl my-8 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-black/50 sticky top-0 z-10">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Sliders className="text-purple-500" size={20} />
            Setup Optimizer — {car.name}
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* BÖLÜM 1: Parametre aralıkları */}
          <div>
            <h4 className="text-sm font-bold text-gray-300 mb-3 uppercase tracking-wide">
              1. Aranacak Parametre Aralıkları
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <RangeField label="Güç (HP)" unit="HP" range={hpRange} onChange={setHpRange} defaultStep={25} />
              <RangeField label="Tork (Nm)" unit="Nm" range={tqRange} onChange={setTqRange} defaultStep={20} />
              <RangeField label="Ağırlık (kg)" unit="kg" range={wRange} onChange={setWRange} defaultStep={50} />
              <RangeField label="NOS Shot" unit="HP" range={nosRange} onChange={setNosRange} defaultStep={50} />
            </div>

            <div className="mt-3">
              <div className="text-sm text-gray-400 mb-2">Çekiş Sistemi (Drivetrain)</div>
              <OptionToggle
                values={drivetrains}
                onChange={setDrivetrains}
                options={[
                  { id: 'FWD', label: 'FWD' },
                  { id: 'RWD', label: 'RWD' },
                  { id: 'AWD', label: 'AWD' }
                ]}
              />
            </div>

            <div className="mt-3">
              <div className="text-sm text-gray-400 mb-2">
                Kalkış Vitesi (Launch Gear)
                <span className="text-[10px] text-gray-500 ml-2">100-200 modunda yok sayılır</span>
              </div>
              <OptionToggle
                values={launchGears.map(String)}
                onChange={(v) => setLaunchGears(v.map(Number))}
                options={[
                  { id: '1', label: '1. vites' },
                  { id: '2', label: '2. vites' },
                  { id: '3', label: '3. vites' },
                  { id: '4', label: '4. vites' },
                  { id: '5', label: '5. vites' },
                  { id: '6', label: '6. vites' }
                ]}
              />
            </div>

            {/* BÖLÜM 1b: Pist ve Lastik */}
            <div className="mt-4 bg-black/30 border border-gray-800 rounded p-3">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <div className="text-sm text-gray-400">Pist ve Lastik</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    Mevcut: <span className="text-gray-300">{shortLabel(SURFACE_OPTIONS, raceSettings.surface)}</span> pisti,
                    <span className="text-gray-300"> {shortLabel(TIRE_OPTIONS, raceSettings.tire)}</span> lastik.
                    {' '}Aşağıdan seçim yaparsan grid'e eklenir; boş bırakırsan sadece mevcut kullanılır.
                  </div>
                </div>
              </div>
              <div className="text-[10px] text-gray-500 mt-2 mb-1">Pist (surface)</div>
              <OptionToggle
                values={surfaces}
                onChange={setSurfaces}
                options={SURFACE_OPTIONS}
              />
              <div className="text-[10px] text-gray-500 mt-3 mb-1">Lastik (tire)</div>
              <OptionToggle
                values={tires}
                onChange={setTires}
                options={TIRE_OPTIONS}
              />
            </div>

            <div className="mt-3 bg-purple-900/20 border border-purple-700/40 rounded p-3 text-sm">
              <span className="text-purple-300 font-bold">Toplam simülasyon: </span>
              <span className="text-white font-mono">{totalSims.toLocaleString('tr-TR')}</span>
              <span className="text-gray-500 text-xs ml-2">
                ({countSteps(hpRange)} HP × {countSteps(tqRange)} Tork × {countSteps(wRange)} Ağırlık × {countSteps(nosRange)} NOS × {drivetrains.length} DT
                {launchGears.length > 0 && ` × ${launchGears.length} Vites`}
                {surfaces.length > 0 && ` × ${surfaces.length} Pist`}
                {tires.length > 0 && ` × ${tires.length} Lastik`})
              </span>
            </div>

            {longRunWarning && !running && !results && (
              <div className="mt-3 bg-yellow-900/20 border border-yellow-700/40 rounded p-3 text-sm text-yellow-300">
                ⚠ {longRunWarning}
              </div>
            )}
          </div>

          {/* BÖLÜM 2: Optimizasyon hedefi — kısıt + slip toleransı */}
          <div>
            <h4 className="text-sm font-bold text-gray-300 mb-3 uppercase tracking-wide">
              2. Optimizasyon Hedefi
            </h4>

            <div className="flex flex-wrap gap-2 mb-3">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={`px-3 py-1.5 text-xs font-bold rounded border transition-colors ${
                    activePreset === p.id
                      ? 'bg-purple-600 border-purple-400 text-white shadow-md shadow-purple-500/30'
                      : 'bg-black/40 border-gray-700 text-gray-300 hover:border-purple-500'
                  }`}
                  title={p.hint}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <NumberConstraint
                label="Hedef Süre (ET) — altında kal"
                value={targetTime}
                onChange={setTargetTime}
                min={2.0}
                max={25.0}
                step={0.1}
                suffix="s"
                hint={isTargetTimeActive
                  ? `Mod: ${raceSettings.mode} → default ${TARGET_DEFAULTS[raceSettings.mode]?.toFixed(1) ?? '—'}s. Slider ile override edilebilir.`
                  : `Mod: ${raceSettings.mode} → hedef süre uygulanmaz. Sadece slip minimize edilir.`}
              />
              <NumberConstraint
                label="Maks Kabul Edilebilir Slip"
                value={maxSlip}
                onChange={onMaxSlipChange}
                min={0.1}
                max={3.0}
                step={0.1}
                suffix="s"
                hint="Bu değerin altındaki setup'lar geçer. Üstü otomatik elenir."
              />
            </div>

            <div className="text-xs text-gray-500 pt-2 mt-2 border-t border-gray-800">
              Mantık: hedef süreyi tutturup <strong>en düşük slip</strong> yapan setup kazanır.
              Hiçbir setup hedefi karşılayamazsa en yakın sonuç gösterilir.
            </div>
          </div>

          {/* BÖLÜM 3: Çalıştırma */}
          <div>
            <h4 className="text-sm font-bold text-gray-300 mb-3 uppercase tracking-wide">
              3. Çalıştır
            </h4>
            {!running && !results && (
              <button
                onClick={handleStart}
                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded flex items-center justify-center gap-2 transition-colors"
              >
                <Play size={18} /> Optimizasyonu Başlat
              </button>
            )}

            {running && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCancel}
                    className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded font-medium flex items-center gap-2"
                  >
                    <Square size={16} /> İptal
                  </button>
                  <div className="flex-1">
                    <div className="h-2 bg-gray-800 rounded overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-600 to-red-500 transition-all duration-200"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-300">
                  <span className="font-mono">{progress.completed.toLocaleString('tr-TR')}</span> / {progress.total.toLocaleString('tr-TR')} simülasyon tamamlandı
                  {progress.bestSoFar && (
                    <span className="ml-3 text-purple-300">
                      · Şu ana kadarki en iyi: <strong>{progress.bestSoFar.result.elapsed_time_s.toFixed(3)}s</strong>
                      {progress.bestSoFar.result.total_slip_time_s != null && (
                        <span className="text-gray-400"> (slip: {progress.bestSoFar.result.total_slip_time_s.toFixed(2)}s)</span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-900/30 border border-red-700 rounded p-3 text-sm text-red-300">
                Hata: {error}
              </div>
            )}
          </div>

          {/* BÖLÜM 4: Sonuçlar */}
          {results && (
            <div>
              <h4 className="text-sm font-bold text-gray-300 mb-3 uppercase tracking-wide flex items-center gap-2">
                <Trophy className="text-yellow-500" size={16} />
                En İyi {results.results.length} Setup
                {results.cancelled && <span className="text-yellow-500 text-xs">(iptal edildi)</span>}
              </h4>

              {targetMissedWarning && (
                <div className="mb-3 bg-yellow-900/30 border border-yellow-700/60 rounded p-3 text-sm text-yellow-200 flex items-start gap-2">
                  <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                  <span>{targetMissedWarning.text}</span>
                </div>
              )}

              {results.results.length === 0 ? (
                <div className="bg-red-900/20 border border-red-700/40 rounded p-3 text-sm text-red-300">
                  Hiçbir setup kısıtları karşılayamadı. Grid aralığını genişlet veya kısıtları gevşet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400 text-xs">
                        <th className="pb-2 pl-3">#</th>
                        <th className="pb-2">Setup</th>
                        <th className="pb-2">NOS/DT/Pist·Lastik</th>
                        <th className="pb-2">Süre / Vites (Δ baseline)</th>
                        <th className="pb-2">Hız / Patinaj (Δ baseline)</th>
                        <th className="pb-2">Skor</th>
                        <th className="pb-2 pr-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      <BaselineRow
                        baseline={results.baseline}
                        surface={baselineSurface}
                        tire={baselineTire}
                      />
                      {results.results.map((entry, i) => (
                        <ResultRow
                          key={i}
                          entry={entry}
                          rank={i}
                          baseline={results.baseline}
                          onApply={handleApply}
                          onVerify={handleVerify}
                          verifyingId={verifyingId}
                          verified={verifiedResults[i]}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
