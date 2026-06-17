import { useState, useEffect, useMemo } from 'react';
import vehiclesData from '../data/vehicles.json';
import enginesData from '../data/engines.json';
import transmissionsData from '../data/transmissions.json';
import tireCompoundsData from '../data/tire_compounds.json';
import tireSizesData from '../data/tire_sizes.json';
import { X, Save, Car, Zap, Settings, Circle, Wind, Flame, ChevronRight, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { analyzeWheelieRisk } from '../physics/wheelieModel.js';
import { checkForgedLimit } from '../physics/engineModel.js';
import { parseTireSize } from '../physics/tireModel.js';
import modificationsData from '../data/modifications.json';

const TABS = [
  { id: 'base', label: 'Araç', icon: Car },
  { id: 'engine', label: 'Motor', icon: Zap },
  { id: 'chassis', label: 'Şasi', icon: Settings },
  { id: 'tires', label: 'Lastik', icon: Circle },
  { id: 'trans', label: 'Şanzıman', icon: Settings },
  { id: 'aero', label: 'Aero', icon: Wind },
  { id: 'extras', label: 'Özel', icon: Flame },
];

const DEFAULT_CONFIG = {
  name: 'Özel Araç',
  drivetrain: 'RWD',
  transmissionType: 'Manual',
  hp: 300,
  torque: 400,
  weight: 1200,
  nosShot: 0,
  nosActivationSpeedKmh: 50,
  engine: null,
  transmission: null,
  hasLimiter: true,
  // Motor
  isForged: false,
  flywheelType: 'standard',
  fuelType: '95',
  engineMods: { stage1: false, stage2: false, stage3: false, intercoolerUpgrade: false },
  appliedMods: [], // Tüm modifikasyon listesi
  // Şasi
  driverWeightKg: 80,
  baseCarWeightKg: 1200,
  baseEngineWeightKg: 150,
  baseWeightDistFrontPct: 50,
  cogHeightM: 0.50,
  wheelbaseM: 2.6,
  weightDistFrontPct: 50,
  ballastFront: 0,
  ballastRear: 0,
  // Lastik
  rearTireSize: '225/45R17',
  frontTireSize: '225/45R17',
  tireCompound: null,
  tireCompoundId: 'tire_high_perf_street',
  hasBurnout: false,
  tirePressurePsi: 32,
  // Şanzıman
  differentialType: 'lsd',
  finalDriveOverride: null,
  shiftRpmThreshold: 200,
  // Aero
  liftCoefficient: 0.05,
  wingDownforceCl: 0,
  aeroMods: { frontSplitter: false, rearWing: false, diffuser: false, undertray: false },
};

export default function CarConfigModal({ onClose, onSave, initialConfig }) {
  const [activeTab, setActiveTab] = useState('base');
  const [selectedBase, setSelectedBase] = useState('');
  const [config, setConfig] = useState(initialConfig || DEFAULT_CONFIG);

  const upd = (patch) => setConfig(c => ({ ...c, ...patch }));

  // Araç şablonu seçilince doldur
  useEffect(() => {
    if (!selectedBase) return;
    const v = vehiclesData.find(x => x.model === selectedBase);
    if (!v) return;
    const defaultEngine = enginesData.find(e => e.engine_code === v.stock_engine_code);
    const defaultTrans = transmissionsData.find(t => t.transmission_code === v.stock_transmission) || transmissionsData[0];
    const compound = tireCompoundsData.find(c => c.id === 'tire_high_perf_street');

    setConfig({
      ...DEFAULT_CONFIG,
      name: `${v.make} ${v.model}`,
      drivetrain: v.drivetrain_stock,
      transmissionType: defaultTrans?.type?.toLowerCase().includes('dct') || defaultTrans?.type?.toLowerCase().includes('auto') ? 'Auto' : 'Manual',
      hp: defaultEngine ? parseInt(defaultEngine.stock_hp_at_rpm) : v.stock_hp,
      torque: defaultEngine ? parseInt(defaultEngine.stock_torque_nm_at_rpm) : v.stock_torque_nm,
      weight: v.curb_weight_kg,
      baseCarWeightKg: v.curb_weight_kg,
      baseEngineWeightKg: defaultEngine ? defaultEngine.engine_weight_kg : 150,
      baseWeightDistFrontPct: v.weight_distribution_front_pct || 50,
      engine: defaultEngine || null,
      transmission: defaultTrans || null,
      top_speed_kmh: v.top_speed_kmh,
      hasLimiter: true,
      weightDistFrontPct: v.weight_distribution_front_pct || 50,
      wheelbaseM: (v.wheelbase_mm || 2600) / 1000,
      tireCompound: compound,
      tireCompoundId: compound?.id || 'tire_high_perf_street',
      isForged: defaultEngine?.is_forged || false,
      fuelType: defaultEngine?.fuel_type || '95',
      differentialType: v.drivetrain_stock === 'AWD' ? 'lsd' : 'lsd',
      appliedMods: [],
    });
  }, [selectedBase]);

  const handleEngineChange = (eCode) => {
    const engine = enginesData.find(e => e.engine_code === eCode);
    if (engine) {
      upd({
        engine,
        hp: parseInt(engine.stock_hp_at_rpm),
        torque: parseInt(engine.stock_torque_nm_at_rpm),
        isForged: engine.is_forged || false,
        fuelType: engine.fuel_type || '95',
      });
    }
  };

  // Ağrılık ve Denge Hesaplama (Engine Swap & Mods)
  useEffect(() => {
    let totalWeight = config.baseCarWeightKg || 1200;
    let frontWeight = totalWeight * ((config.baseWeightDistFrontPct || 50) / 100);

    // Motor değişimi ağırlık farkı
    if (config.engine && config.baseEngineWeightKg) {
      const engineWeightDiff = config.engine.engine_weight_kg - config.baseEngineWeightKg;
      totalWeight += engineWeightDiff;
      frontWeight += engineWeightDiff; // Motorun önde olduğunu varsayıyoruz
    }

    // Modifikasyon ağırlık etkileri
    if (config.appliedMods) {
      for (const mod of config.appliedMods) {
        if (mod.weight_change_kg) {
          totalWeight += mod.weight_change_kg;
          if (mod.weight_dist_shift_pct === undefined) {
            frontWeight += mod.weight_change_kg * 0.5;
          }
        }
      }
    }

    const newDist = (frontWeight / totalWeight) * 100;
    let finalDist = newDist;
    if (config.appliedMods) {
      for (const mod of config.appliedMods) {
         if (mod.weight_dist_shift_pct) finalDist += mod.weight_dist_shift_pct;
      }
    }

    upd({ weight: Math.round(totalWeight), weightDistFrontPct: Math.round(finalDist * 10) / 10 });
  }, [config.engine, config.appliedMods, config.baseCarWeightKg, config.baseEngineWeightKg, config.baseWeightDistFrontPct]);

  const toggleMod = (mod) => {
    const isApplied = config.appliedMods?.find(m => m.id === mod.id);
    let newMods = [...(config.appliedMods || [])];
    if (isApplied) {
      newMods = newMods.filter(m => m.id !== mod.id);
    } else {
      newMods.push(mod);
    }
    upd({ appliedMods: newMods });
  };

  const getModsByCategory = (cats) => modificationsData.filter(m => cats.includes(m.category));

  const handleTransChange = (tCode) => {
    const trans = transmissionsData.find(t => t.transmission_code === tCode);
    if (trans) {
      upd({
        transmission: trans,
        transmissionType: trans.type.toLowerCase().includes('dct') || trans.type.toLowerCase().includes('auto') ? 'Auto' : 'Manual'
      });
    }
  };

  const handleTireCompoundChange = (id) => {
    const compound = tireCompoundsData.find(c => c.id === id);
    upd({ tireCompound: compound, tireCompoundId: id });
  };

  // Lastik geometrisi hesapla
  const rearTireGeo = useMemo(() => parseTireSize(config.rearTireSize), [config.rearTireSize]);
  const frontTireGeo = useMemo(() => parseTireSize(config.frontTireSize), [config.frontTireSize]);

  // Mekanik max hız
  const getMechTopSpeed = () => {
    if (!config.engine || !config.transmission) return 0;
    const redline = config.engine.redline_rpm || 7500;
    const topGear = config.transmission.gear_ratios?.slice(-1)[0] || 0.8;
    const fd = config.finalDriveOverride || config.transmission.final_drive_ratio || 3.5;
    const maxSpeedMs = (redline * 2 * Math.PI * rearTireGeo.radiusM) / (topGear * fd * 60);
    return Math.round(maxSpeedMs * 3.6);
  };

  // Forged limit analizi
  const forgedAnalysis = useMemo(() => {
    if (!config.engine) return null;
    return checkForgedLimit(
      config.hp,
      config.isForged,
      parseInt(config.engine.stock_hp_at_rpm) || config.hp,
      config.engine.max_hp_potential
    );
  }, [config.hp, config.isForged, config.engine]);

  // Wheelie risk analizi
  const wheelieRisk = useMemo(() => {
    if (!config.engine) return null;
    const fakeVehicle = {
      curb_weight_kg: config.weight,
      wheelbase_mm: (config.wheelbaseM || 2.6) * 1000,
      weight_distribution_front_pct: config.weightDistFrontPct || 50,
      drivetrain_stock: config.drivetrain,
    };
    return analyzeWheelieRisk(config.engine, fakeVehicle);
  }, [config.engine, config.weight, config.wheelbaseM, config.weightDistFrontPct, config.drivetrain]);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Tüm fizik parametrelerini birleştir
    const finalConfig = {
      ...config,
      // Lastik kompound
      tireCompound: tireCompoundsData.find(c => c.id === config.tireCompoundId) || null,
      // Final drive
      finalDriveRatio: config.finalDriveOverride || config.transmission?.final_drive_ratio || 3.5,
    };
    onSave(finalConfig);
  };

  const inputCls = "w-full bg-black border border-gray-700 rounded p-2 text-white focus:border-red-500 focus:outline-none text-sm";
  const labelCls = "block text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide";
  const sectionTitle = (t) => <h4 className="text-sm font-bold text-gray-300 mb-3 mt-4 flex items-center gap-2 border-b border-gray-800 pb-2">{t}</h4>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#0d0d0d] border border-gray-700 rounded-2xl w-full max-w-2xl my-4 shadow-[0_0_60px_rgba(220,38,38,0.15)] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-black/60 sticky top-0 z-10 rounded-t-2xl">
          <h3 className="text-lg font-bold flex items-center gap-2 text-white">
            <Car size={20} className="text-red-500" />
            {initialConfig ? 'Aracı Düzenle' : 'Yeni Araç Ekle'}
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1">
            <X size={22} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 bg-black/40 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold whitespace-nowrap transition-all border-b-2
                  ${activeTab === tab.id
                    ? 'border-red-500 text-red-400 bg-red-500/10'
                    : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5'
                  }`}
              >
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3">

            {/* ═══ TAB: ARAÇ TEMEL ═══ */}
            {activeTab === 'base' && (
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Şablon Araç</label>
                  <select className={inputCls} value={selectedBase} onChange={e => setSelectedBase(e.target.value)}>
                    <option value="">— Sıfırdan Başla —</option>
                    {vehiclesData.map((v, i) => (
                      <option key={i} value={v.model}>{v.make} {v.model} ({v.year_range})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelCls}>Araç Adı</label>
                  <input required type="text" className={inputCls} value={config.name}
                    onChange={e => upd({ name: e.target.value })} />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Çekiş</label>
                    <select className={inputCls} value={config.drivetrain} onChange={e => upd({ drivetrain: e.target.value })}>
                      <option value="FWD">FWD (Ön)</option>
                      <option value="RWD">RWD (Arka)</option>
                      <option value="AWD">AWD (4×4)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Güç (HP)</label>
                    <input required type="number" min="50" max="3000" className={inputCls}
                      value={config.hp} onChange={e => upd({ hp: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className={labelCls}>Tork (Nm)</label>
                    <input required type="number" min="50" max="4000" className={inputCls}
                      value={config.torque} onChange={e => upd({ torque: Number(e.target.value) })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Araç Ağırlığı (kg)</label>
                    <input required type="number" min="500" max="4000" className={inputCls}
                      value={config.weight} onChange={e => upd({ weight: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className={labelCls}>Motor Seçimi</label>
                    <select className={inputCls} value={config.engine?.engine_code || ''}
                      onChange={e => handleEngineChange(e.target.value)}>
                      <option value="">— Motor Seç —</option>
                      {enginesData.map((e, i) => (
                        <option key={i} value={e.engine_code}>{e.engine_code} ({e.displacement_cc}cc – {e.stock_hp_at_rpm})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Fizik analizi kutusu */}
                <div className="bg-gray-900/60 border border-gray-700 rounded-lg p-3 text-xs space-y-1">
                  <p className="text-yellow-400 font-bold">⚡ Fizik Analizi</p>
                  <p className="text-gray-300">
                    {config.hp} HP için gereken devir (tork = {config.torque} Nm ile):
                    <strong className={Math.round((config.hp * 7120) / config.torque) > 9000 ? ' text-red-400' : ' text-green-400'}>
                      {' '}{Math.round((config.hp * 7120) / config.torque).toLocaleString('tr-TR')} RPM
                    </strong>
                  </p>
                  {forgedAnalysis && (
                    <p className={`font-medium ${forgedAnalysis.riskLevel === 'safe' ? 'text-green-400' : forgedAnalysis.riskLevel === 'warning' ? 'text-yellow-400' : 'text-red-400'}`}>
                      {forgedAnalysis.riskLevel === 'safe' ? '✅' : forgedAnalysis.riskLevel === 'warning' ? '⚠️' : '🔴'}
                      {' '}Motor güvenli limit: {Math.round(forgedAnalysis.safeHp)} HP
                      {forgedAnalysis.isOverLimit && ` (${forgedAnalysis.overLimitPct}% aşıldı!)`}
                    </p>
                  )}
                  {wheelieRisk && wheelieRisk.riskLevel !== 'none' && (
                    <p className={`font-medium ${wheelieRisk.riskLevel === 'low' ? 'text-yellow-400' : wheelieRisk.riskLevel === 'medium' ? 'text-orange-400' : 'text-red-500'}`}>
                      🏋️ Wheelie riski: {wheelieRisk.riskLevel.toUpperCase()} (eşik: ~{wheelieRisk.wheelieThresholdHp} HP)
                    </p>
                  )}
                </div>

                {config.engine && config.transmission && (
                  <div className="bg-blue-950/30 border border-blue-800/50 rounded-lg p-3 text-xs text-blue-300">
                    <strong>🏁 Mekanik Top Speed:</strong> {getMechTopSpeed()} km/h
                    (Redline {config.engine.redline_rpm} RPM @ son vites)
                  </div>
                )}
              </div>
            )}

            {/* ═══ TAB: MOTOR ═══ */}
            {activeTab === 'engine' && (
              <div className="space-y-4">
                {sectionTitle('🔩 Motor İç Yapısı')}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-start gap-3 bg-gray-900/50 border border-gray-700 rounded-lg p-3 col-span-2">
                    <input type="checkbox" id="forgedCheck" checked={config.isForged}
                      onChange={e => upd({ isForged: e.target.checked })}
                      className="w-4 h-4 mt-0.5 accent-red-500 cursor-pointer" />
                    <div>
                      <label htmlFor="forgedCheck" className="font-bold text-white text-sm cursor-pointer">🔨 Forged Internals</label>
                      <p className="text-gray-500 text-xs mt-0.5">Forged piston, connecting rod ve blok. Güvenli güç limiti yükselir.
                        {config.engine && <span className="text-green-400"> Mevcut limit: ~{Math.round(config.engine.max_hp_potential)} HP</span>}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Volan Tipi (Flywheel)</label>
                    <select className={inputCls} value={config.flywheelType} onChange={e => upd({ flywheelType: e.target.value })}>
                      <option value="heavy">Ağır (OEM)</option>
                      <option value="standard">Standart</option>
                      <option value="light">Hafif (Aftermarket)</option>
                      <option value="ultralight">Ultra Hafif (Yarış)</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Hafif volan → daha hızlı devir tepkisi, daha az depolanan kinetik enerji</p>
                  </div>
                  <div>
                    <label className={labelCls}>Yakıt Tipi</label>
                    <select className={inputCls} value={config.fuelType} onChange={e => upd({ fuelType: e.target.value })}>
                      <option value="95">95 Oktan (Normal)</option>
                      <option value="98">98 Oktan (Süper)</option>
                      <option value="E85">E85 (Etanol Karışımı)</option>
                      <option value="E100">E100 (Saf Etanol)</option>
                      <option value="Race">Racing Fuel (C16)</option>
                    </select>
                  </div>
                </div>

                {sectionTitle('💨 Zorlamalı Havalandırma (Turbo/SC)')}
                {config.engine?.aspiration === 'turbo' || config.engine?.max_boost_bar > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Boost (bar)</label>
                      <input type="number" min="0" max="3" step="0.1" className={inputCls}
                        value={config.engine?.max_boost_bar || 0}
                        onChange={e => upd({ engine: { ...config.engine, max_boost_bar: parseFloat(e.target.value) } })} />
                    </div>
                    <div>
                      <label className={labelCls}>İntercooler Tipi</label>
                      <select className={inputCls}
                        value={config.engine?.intercooler_type || 'none'}
                        onChange={e => upd({ engine: { ...config.engine, intercooler_type: e.target.value } })}>
                        <option value="none">Yok (NA)</option>
                        <option value="TMIC">TMIC (Üstten)</option>
                        <option value="FMIC">FMIC (Önden)</option>
                        <option value="air-air">Air-Air (Generic)</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-xs bg-gray-900/40 rounded p-3">Seçilen motor atmosferik (NA). Turbo/SC motoru seçerseniz boost ayarları burada görünür.</p>
                )}

                {sectionTitle('⚙️ Motor, Yakıt ve Yazılım Modifikasyonları')}
                <div className="space-y-2">
                  {getModsByCategory(['motor', 'yakit', 'atesleme', 'yazilim']).map(mod => {
                    const isChecked = !!config.appliedMods?.find(m => m.id === mod.id);
                    return (
                      <div key={mod.id} className="flex items-center gap-3 bg-gray-900/40 border border-gray-800 rounded-lg p-2.5">
                        <input type="checkbox" id={`mod-${mod.id}`}
                          checked={isChecked}
                          onChange={() => toggleMod(mod)}
                          className="w-4 h-4 accent-red-500 cursor-pointer flex-shrink-0" />
                        <div>
                          <label htmlFor={`mod-${mod.id}`} className="text-sm text-white cursor-pointer font-medium">{mod.name}</label>
                          <p className="text-xs text-gray-500">{mod.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ═══ TAB: ŞASİ ═══ */}
            {activeTab === 'chassis' && (
              <div className="space-y-4">
                {sectionTitle('👤 Sürücü & Ağırlık')}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Sürücü Ağırlığı (kg)</label>
                    <input type="number" min="50" max="200" className={inputCls}
                      value={config.driverWeightKg || 80}
                      onChange={e => upd({ driverWeightKg: Number(e.target.value) })} />
                    <p className="text-xs text-gray-500 mt-1">Toplam kütle: {config.weight + (config.driverWeightKg || 80)} kg</p>
                  </div>
                  <div>
                    <label className={labelCls}>Ön Ağırlık Dağılımı (%)</label>
                    <input type="number" min="30" max="70" className={inputCls}
                      value={config.weightDistFrontPct || 50}
                      onChange={e => upd({ weightDistFrontPct: Number(e.target.value) })} />
                    <p className="text-xs text-gray-500 mt-1">Arka: %{100 - (config.weightDistFrontPct || 50)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Ağırlık Merkezi Yüksekliği (m)</label>
                    <input type="number" min="0.30" max="0.90" step="0.01" className={inputCls}
                      value={config.cogHeightM || 0.50}
                      onChange={e => upd({ cogHeightM: Number(e.target.value) })} />
                    <p className="text-xs text-gray-500 mt-1">Lowered: ~0.42m | Stock: ~0.50m | SUV: ~0.65m</p>
                  </div>
                  <div>
                    <label className={labelCls}>Dingil Mesafesi (m)</label>
                    <input type="number" min="1.8" max="3.5" step="0.01" className={inputCls}
                      value={config.wheelbaseM || 2.60}
                      onChange={e => upd({ wheelbaseM: Number(e.target.value) })} />
                  </div>
                </div>

                {sectionTitle('⚖️ Ballast (Ek Ağırlık)')}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Öne Eklenen Ağırlık (kg)</label>
                    <input type="number" min="0" max="200" className={inputCls}
                      value={config.ballastFront || 0}
                      onChange={e => upd({ ballastFront: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className={labelCls}>Arkaya Eklenen Ağırlık (kg)</label>
                    <input type="number" min="0" max="200" className={inputCls}
                      value={config.ballastRear || 0}
                      onChange={e => upd({ ballastRear: Number(e.target.value) })} />
                  </div>
                </div>

                {/* CG hesaplama önizleme */}
                <div className="bg-gray-900/60 border border-gray-700 rounded-lg p-3 text-xs">
                  <p className="text-yellow-400 font-bold mb-2">⚖️ Ağırlık Dağılımı Analizi</p>
                  <div className="space-y-1 text-gray-300">
                    <p>Araç: {config.weight} kg + Sürücü: {config.driverWeightKg || 80} kg + Ballast: {(config.ballastFront || 0) + (config.ballastRear || 0)} kg</p>
                    <p>Toplam: <strong className="text-white">{config.weight + (config.driverWeightKg || 80) + (config.ballastFront || 0) + (config.ballastRear || 0)} kg</strong></p>
                    <p>Ön aks yükü: <strong className="text-white">{Math.round((config.weight + (config.driverWeightKg || 80)) * (config.weightDistFrontPct || 50) / 100 + (config.ballastFront || 0))} kg</strong></p>
                    <p>Arka aks yükü: <strong className="text-white">{Math.round((config.weight + (config.driverWeightKg || 80)) * (1 - (config.weightDistFrontPct || 50) / 100) + (config.ballastRear || 0))} kg</strong></p>
                    {config.drivetrain === 'RWD' && (
                      <p className="text-green-400">✅ RWD için arka ağırlıklı yapı idealdir.</p>
                    )}
                    {config.drivetrain === 'FWD' && config.weightDistFrontPct > 65 && (
                      <p className="text-yellow-400">⚠️ FWD'de çok fazla ön ağırlık tork steer riskini artırır.</p>
                    )}
                  </div>
                </div>

                {sectionTitle('🏎️ Şasi ve Ağırlık Modifikasyonları')}
                <div className="space-y-2">
                  {getModsByCategory(['sasi', 'agirlik']).map(mod => {
                    const isChecked = !!config.appliedMods?.find(m => m.id === mod.id);
                    return (
                      <div key={mod.id} className="flex items-center gap-3 bg-gray-900/40 border border-gray-800 rounded-lg p-2.5">
                        <input type="checkbox" id={`mod-${mod.id}`}
                          checked={isChecked}
                          onChange={() => toggleMod(mod)}
                          className="w-4 h-4 accent-purple-500 cursor-pointer flex-shrink-0" />
                        <div>
                          <label htmlFor={`mod-${mod.id}`} className="text-sm text-white cursor-pointer font-medium">{mod.name}</label>
                          <p className="text-xs text-gray-500">{mod.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ═══ TAB: LASTİK ═══ */}
            {activeTab === 'tires' && (
              <div className="space-y-4">
                {sectionTitle('📐 Lastik Boyutları')}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'rearTireSize', label: 'Arka Lastik', geo: rearTireGeo },
                    { key: 'frontTireSize', label: 'Ön Lastik', geo: frontTireGeo },
                  ].map(({ key, label, geo }) => (
                    <div key={key}>
                      <label className={labelCls}>{label}</label>
                      <select className={inputCls} value={config[key]}
                        onChange={e => upd({ [key]: e.target.value })}>
                        {tireSizesData.map((t, i) => (
                          <option key={i} value={t.size}>{t.size} — {t.common_name}</option>
                        ))}
                      </select>
                      {geo && (
                        <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                          <p>Yarıçap: <strong className="text-gray-300">{geo.radiusM.toFixed(4)} m</strong> | Çevre: {geo.circumferenceM.toFixed(3)} m</p>
                          <p>Dış çap: {geo.outerDiameterMm?.toFixed(0)} mm | Yan duvar: {geo.sidewallMm?.toFixed(0)} mm</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div>
                  <label className={labelCls}>Lastik Bileşiği (Compound)</label>
                  <div className="space-y-2">
                    {tireCompoundsData.map(c => (
                      <div key={c.id}
                        onClick={() => handleTireCompoundChange(c.id)}
                        className={`flex items-start gap-3 rounded-lg p-3 border cursor-pointer transition-all ${config.tireCompoundId === c.id
                            ? 'border-red-500 bg-red-500/10'
                            : 'border-gray-700 bg-gray-900/40 hover:border-gray-600'
                          }`}>
                        <div className={`w-4 h-4 rounded-full mt-0.5 border-2 flex items-center justify-center flex-shrink-0 ${config.tireCompoundId === c.id ? 'border-red-500 bg-red-500' : 'border-gray-600'
                          }`}>
                          {config.tireCompoundId === c.id && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-white text-sm">{c.name}</span>
                            <span className="text-xs text-green-400">μ {c.mu_street_dry}</span>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{c.description}</p>
                          <p className="text-xs text-gray-500 mt-0.5">Optimal: {c.optimal_temp_c_min}–{c.optimal_temp_c_max}°C</p>
                          {c.requires_warmup && (
                            <span className="text-xs text-orange-400 font-medium">🔥 Isınma gerektirir</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Lastik Basıncı (PSI)</label>
                    <input type="number" min="20" max="50" className={inputCls}
                      value={config.tirePressurePsi || 32}
                      onChange={e => upd({ tirePressurePsi: Number(e.target.value) })} />
                    <p className="text-xs text-gray-500 mt-1">Slick için 14-18 PSI, street için 28-35 PSI</p>
                  </div>
                  <div className="flex items-start gap-3 bg-gray-900/40 border border-gray-800 rounded-lg p-3">
                    <input type="checkbox" id="burnoutCheck" checked={config.hasBurnout || false}
                      onChange={e => upd({ hasBurnout: e.target.checked })}
                      className="w-4 h-4 mt-0.5 accent-orange-500 cursor-pointer" />
                    <div>
                      <label htmlFor="burnoutCheck" className="font-bold text-white text-sm cursor-pointer">🔥 Burnout Yapıldı</label>
                      <p className="text-gray-500 text-xs mt-0.5">Lastikler önceden ısıtıldı, optimal tutunma ile başlanır.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ TAB: ŞANZIMAN ═══ */}
            {activeTab === 'trans' && (
              <div className="space-y-4">
                {sectionTitle('⚙️ Şanzıman Seçimi')}
                <div>
                  <label className={labelCls}>Şanzıman</label>
                  <select className={inputCls} value={config.transmission?.transmission_code || ''}
                    onChange={e => handleTransChange(e.target.value)}>
                    <option value="">— Şanzıman Seç —</option>
                    {transmissionsData.map((t, i) => (
                      <option key={i} value={t.transmission_code}>
                        {t.transmission_code} ({t.type}, {t.gear_count} vitES, {t.shift_time_ms}ms)
                      </option>
                    ))}
                  </select>
                </div>

                {config.transmission && (
                  <div className="bg-gray-900/60 border border-gray-700 rounded-lg p-3 text-xs">
                    <p className="text-gray-400 font-bold mb-2">Vites Oranları</p>
                    <div className="grid grid-cols-4 gap-1">
                      {config.transmission.gear_ratios?.map((r, i) => (
                        <div key={i} className="text-center bg-black/40 rounded p-1">
                          <p className="text-gray-500 text-[10px]">{i + 1}. Vites</p>
                          <p className="text-white font-bold">{r.toFixed(2)}</p>
                        </div>
                      ))}
                      <div className="text-center bg-red-900/30 rounded p-1 border border-red-800/50">
                        <p className="text-gray-500 text-[10px]">Final</p>
                        <p className="text-red-400 font-bold">{config.finalDriveOverride || config.transmission.final_drive_ratio}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-gray-400">Maks tork kapasitesi: <strong className="text-white">{config.transmission.max_torque_capacity_nm} Nm</strong>
                      {config.torque > config.transmission.max_torque_capacity_nm * 0.9 && (
                        <span className="text-red-400 ml-2">⚠️ Limit yakın!</span>
                      )}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Final Drive Override</label>
                    <input type="number" min="2.0" max="6.0" step="0.01" className={inputCls}
                      placeholder={`Varsayılan: ${config.transmission?.final_drive_ratio || 3.5}`}
                      value={config.finalDriveOverride || ''}
                      onChange={e => upd({ finalDriveOverride: e.target.value ? Number(e.target.value) : null })} />
                    <p className="text-xs text-gray-500 mt-1">Boş bırakırsan şanzımandan alınır</p>
                  </div>
                  <div>
                    <label className={labelCls}>Vites Atlama Eşiği (RPM önce)</label>
                    <input type="number" min="0" max="1000" step="50" className={inputCls}
                      value={config.shiftRpmThreshold || 200}
                      onChange={e => upd({ shiftRpmThreshold: Number(e.target.value) })} />
                    <p className="text-xs text-gray-500 mt-1">Redline - {config.shiftRpmThreshold || 200} RPM'de vites atlıyor</p>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Diferansiyel Tipi</label>
                  <select className={inputCls} value={config.differentialType || 'lsd'}
                    onChange={e => upd({ differentialType: e.target.value })}>
                    <option value="open">Açık Diferansiyel (Open) — Zayıf çekiş</option>
                    <option value="lsd">LSD (Generic) — Dengeli</option>
                    <option value="helical">Helical/Torsen LSD — Güçlü</option>
                    <option value="clutch_pack">Clutch Pack LSD — Ayarlanabilir</option>
                    <option value="plated_lsd">Plated LSD (Competition) — Çok güçlü</option>
                    <option value="spool">Spool (Weld/Full Lock) — Maksimum çekiş</option>
                  </select>
                </div>

                {sectionTitle('⚙️ Şanzıman ve Aktarma Modifikasyonları')}
                <div className="space-y-2">
                  {getModsByCategory(['sanziman']).map(mod => {
                    const isChecked = !!config.appliedMods?.find(m => m.id === mod.id);
                    return (
                      <div key={mod.id} className="flex items-center gap-3 bg-gray-900/40 border border-gray-800 rounded-lg p-2.5">
                        <input type="checkbox" id={`mod-${mod.id}`}
                          checked={isChecked}
                          onChange={() => toggleMod(mod)}
                          className="w-4 h-4 accent-blue-500 cursor-pointer flex-shrink-0" />
                        <div>
                          <label htmlFor={`mod-${mod.id}`} className="text-sm text-white cursor-pointer font-medium">{mod.name}</label>
                          <p className="text-xs text-gray-500">{mod.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ═══ TAB: AERO ═══ */}
            {activeTab === 'aero' && (
              <div className="space-y-4">
                {sectionTitle('💨 Temel Aerodinamik')}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Drag Katsayısı (Cd)</label>
                    <input type="number" min="0.18" max="0.60" step="0.01" className={inputCls}
                      value={config.dragCoefficient || 0.30}
                      onChange={e => upd({ dragCoefficient: Number(e.target.value) })} />
                    <p className="text-xs text-gray-500 mt-1">Drag araç: 0.24 | Sedan: 0.30 | SUV: 0.38+</p>
                  </div>
                  <div>
                    <label className={labelCls}>Ön Yüzey Alanı (m²)</label>
                    <input type="number" min="1.5" max="3.5" step="0.05" className={inputCls}
                      value={config.frontalAreaM2 || 2.2}
                      onChange={e => upd({ frontalAreaM2: Number(e.target.value) })} />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Wing/Splitter Downforce Katsayısı (Cl)</label>
                  <div className="flex items-center gap-2">
                    <input type="range" min="0" max="1.5" step="0.05" className="flex-1 accent-blue-500"
                      value={config.wingDownforceCl || 0}
                      onChange={e => upd({ wingDownforceCl: Number(e.target.value) })} />
                    <span className="text-white font-bold text-sm w-12 text-right">{(config.wingDownforceCl || 0).toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    100 km/h'de ≈ {Math.round(0.5 * 1.225 * (config.wingDownforceCl || 0) * (config.frontalAreaM2 || 2.2) * (100 / 3.6) ** 2)} N basma kuvveti
                  </p>
                </div>

                {sectionTitle('🔩 Aero Modifikasyonlar')}
                {[
                  { key: 'frontSplitter', label: '🔲 Ön Splitter', desc: '+Cd biraz, +Cl ön' },
                  { key: 'rearWing', label: '✈️ Arka Kanat', desc: '+Cd fazla, +Cl çok — drag pistte dezavantaj!' },
                  { key: 'diffuser', label: '📐 Diffüzör', desc: '-Cd hafif, +Cl — ideal' },
                  { key: 'undertray', label: '🔲 Underfloor / Splitter', desc: '-Cd, +Cl — yarış aracı' },
                ].map(mod => (
                  <div key={mod.key} className="flex items-center gap-3 bg-gray-900/40 border border-gray-800 rounded-lg p-2.5">
                    <input type="checkbox" id={`aero-${mod.key}`}
                      checked={config.aeroMods?.[mod.key] || false}
                      onChange={e => upd({ aeroMods: { ...(config.aeroMods || {}), [mod.key]: e.target.checked } })}
                      className="w-4 h-4 accent-blue-500 cursor-pointer" />
                    <div>
                      <label htmlFor={`aero-${mod.key}`} className="text-sm text-white cursor-pointer font-medium">{mod.label}</label>
                      <p className="text-xs text-gray-500">{mod.desc}</p>
                    </div>
                  </div>
                ))}

                <div className="bg-blue-950/30 border border-blue-800/40 rounded-lg p-3 text-xs text-blue-300">
                  <p className="font-bold mb-1">ℹ️ Drag Pistte Aero Notu</p>
                  <p>Drag yarışında downforce düzlükte <strong>traksiyon artırır</strong> ama <strong>aero drag da artar</strong>.
                    Uzun pistte (400m+) kanat genellikle bitiş hızını düşürür.
                    Kısa pist ve kalkışta tutunum kritikse kanat avantajlıdır.</p>
                </div>
              </div>
            )}

            {/* ═══ TAB: ÖZEL ═══ */}
            {activeTab === 'extras' && (
              <div className="space-y-4">
                {sectionTitle('💉 NOS Sistemi')}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>NOS Gücü (Ekstra HP)</label>
                    <input type="number" min="0" max="1500" className={inputCls}
                      value={config.nosShot || 0}
                      onChange={e => upd({ nosShot: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className={labelCls}>NOS Aktivasyon Hızı (km/h)</label>
                    <input type="number" min="0" max="200" className={inputCls}
                      value={config.nosActivationSpeedKmh || 50}
                      onChange={e => upd({ nosActivationSpeedKmh: Number(e.target.value) })} />
                  </div>
                </div>

                {sectionTitle('🏁 Hız Kesici (Limiter)')}
                <div className="flex items-center gap-3 bg-gray-900/40 border border-gray-800 rounded-lg p-3">
                  <input type="checkbox" id="limiterToggle"
                    checked={config.hasLimiter !== false}
                    onChange={e => upd({ hasLimiter: e.target.checked })}
                    className="w-4 h-4 accent-red-500 cursor-pointer" />
                  <div>
                    <label htmlFor="limiterToggle" className="font-bold text-white text-sm cursor-pointer">Elektronik Hız Kesici Aktif</label>
                    <p className="text-gray-500 text-xs mt-0.5">Kapatılırsa mekanik sınıra (redline) kadar hızlanır. Maks: {getMechTopSpeed()} km/h</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-gray-900/40 border border-gray-800 rounded-lg p-3">
                  <input type="checkbox" id="launchControl"
                    checked={config.hasLaunchControl || false}
                    onChange={e => upd({ hasLaunchControl: e.target.checked })}
                    className="w-4 h-4 accent-green-500 cursor-pointer" />
                  <div>
                    <label htmlFor="launchControl" className="font-bold text-white text-sm cursor-pointer">🚀 Launch Control</label>
                    <p className="text-gray-500 text-xs mt-0.5">Kalkış devrini otomatik optimize eder. AWD araçlarda en etkili.</p>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-800 flex gap-3 bg-black/40 rounded-b-2xl">
            <button type="button" onClick={() => {
              const tabs = TABS.map(t => t.id);
              const ci = tabs.indexOf(activeTab);
              if (ci > 0) setActiveTab(tabs[ci - 1]);
            }} className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-30"
              disabled={activeTab === TABS[0].id}>
              ← Geri
            </button>
            <div className="flex-1" />
            {activeTab !== TABS[TABS.length - 1].id ? (
              <button type="button" onClick={() => {
                const tabs = TABS.map(t => t.id);
                const ci = tabs.indexOf(activeTab);
                if (ci < tabs.length - 1) setActiveTab(tabs[ci + 1]);
              }} className="flex items-center gap-1 px-5 py-2 bg-gray-700 text-white rounded-lg text-sm font-semibold hover:bg-gray-600 transition-colors">
                İleri <ChevronRight size={16} />
              </button>
            ) : (
              <button type="submit"
                className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-500 transition-colors">
                <Save size={16} /> Piste Ekle
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
