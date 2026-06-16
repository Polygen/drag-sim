import { useState, useEffect } from 'react';
import vehiclesData from '../data/vehicles.json';
import enginesData from '../data/engines.json';
import transmissionsData from '../data/transmissions.json';
import { X, Save, Car, Settings } from 'lucide-react';

export default function CarConfigModal({ onClose, onSave, initialConfig }) {
  const [selectedBase, setSelectedBase] = useState('');
  const [config, setConfig] = useState(initialConfig || {
    name: 'Özel Araç',
    drivetrain: 'RWD',
    transmissionType: 'Manual',
    hp: 300,
    torque: 400,
    weight: 1200,
    nosShot: 0,
    engine: null,
    transmission: null,
    hasLimiter: true,
    boostByGear: { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' }
  });

  // Seçilen baz araca göre verileri doldur (sadece yeni araç oluştururken veya yeni şablon seçildiğinde)
  useEffect(() => {
    if (selectedBase) {
      const v = vehiclesData.find(x => x.model === selectedBase);
      if (v) {
        // Find default engine and transmission for this car
        const defaultEngine = enginesData.find(e => e.engine_code === v.stock_engine_code);
        const defaultTrans = transmissionsData.find(t => t.transmission_code === v.stock_transmission) || transmissionsData[0];
        
        setConfig({
          name: `${v.make} ${v.model}`,
          drivetrain: v.drivetrain_stock,
          transmissionType: defaultTrans?.type.toLowerCase().includes('otomatik') || defaultTrans?.type.toLowerCase().includes('dct') ? 'Auto' : 'Manual',
          hp: defaultEngine ? parseInt(defaultEngine.stock_hp_at_rpm) : v.stock_hp,
          torque: defaultEngine ? parseInt(defaultEngine.stock_torque_nm_at_rpm) : v.stock_torque_nm,
          weight: v.curb_weight_kg,
          nosShot: 0,
          engine: defaultEngine || enginesData[0],
          transmission: defaultTrans,
          top_speed_kmh: v.top_speed_kmh,
          hasLimiter: true,
          boostByGear: { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' }
        });
      }
    }
  }, [selectedBase]);

  const handleEngineChange = (eCode) => {
    const engine = enginesData.find(e => e.engine_code === eCode);
    if (engine) {
      setConfig({
        ...config, 
        engine,
        hp: parseInt(engine.stock_hp_at_rpm),
        torque: parseInt(engine.stock_torque_nm_at_rpm)
      });
    }
  };

  const handleTransChange = (tCode) => {
    const trans = transmissionsData.find(t => t.transmission_code === tCode);
    if (trans) {
      setConfig({
        ...config,
        transmission: trans,
        transmissionType: trans.type.toLowerCase().includes('otomatik') || trans.type.toLowerCase().includes('dct') ? 'Auto' : 'Manual'
      });
    }
  };

  const getMechanicalTopSpeed = () => {
    if (!config.engine || !config.transmission) return 0;
    const redline = config.engine.redline_rpm || 7500;
    const gearRatios = config.transmission.gear_ratios;
    const finalDrive = config.transmission.final_drive_ratio;
    if (!gearRatios || !finalDrive) return 0;
    
    const topGear = gearRatios[gearRatios.length - 1];
    const maxSpeedMs = (redline * 2 * Math.PI * 0.32) / (topGear * finalDrive * 60);
    return Math.round(maxSpeedMs * 3.6);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(config);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#111111] bg-gradient-to-br from-[#1a1a1a] to-[#000000] border border-gray-700 rounded-xl w-full max-w-lg my-8 animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-black/50 sticky top-0 z-10">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Car size={20} className="text-red-500" /> Yeni Araç Ekle
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Şablon Araç (İsteğe Bağlı)</label>
            <select 
              className="w-full bg-black border border-gray-700 rounded p-2 text-white focus:border-red-500 focus:outline-none"
              value={selectedBase}
              onChange={(e) => setSelectedBase(e.target.value)}
            >
              <option value="">-- Sıfırdan Başla --</option>
              {vehiclesData.map((v, i) => (
                <option key={i} value={v.model}>{v.make} {v.model}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Araç Adı (Gösterim için)</label>
            <input 
              required
              type="text" 
              className="w-full bg-black border border-gray-700 rounded p-2 text-white focus:border-red-500 focus:outline-none"
              value={config.name}
              onChange={(e) => setConfig({...config, name: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-800 pt-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Motor Swap (Opsiyonel)</label>
              <select 
                className="w-full bg-black border border-gray-700 rounded p-2 text-white focus:border-red-500 focus:outline-none"
                value={config.engine?.engine_code || ''}
                onChange={(e) => handleEngineChange(e.target.value)}
              >
                <option value="">-- Motor Seç --</option>
                {enginesData.map((e, i) => (
                  <option key={i} value={e.engine_code}>{e.engine_code} ({e.displacement_cc}cc)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Şanzıman Seçimi</label>
              <select 
                className="w-full bg-black border border-gray-700 rounded p-2 text-white focus:border-red-500 focus:outline-none"
                value={config.transmission?.transmission_code || ''}
                onChange={(e) => handleTransChange(e.target.value)}
              >
                <option value="">-- Şanzıman Seç --</option>
                {transmissionsData.map((t, i) => (
                  <option key={i} value={t.transmission_code}>{t.transmission_code}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Güç (HP)</label>
              <input 
                required type="number" min="50" max="3000"
                className="w-full bg-black border border-gray-700 rounded p-2 text-white focus:border-red-500 focus:outline-none"
                value={config.hp}
                onChange={(e) => setConfig({...config, hp: Number(e.target.value)})}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Tork (Nm)</label>
              <input 
                required type="number" min="50" max="3500"
                className="w-full bg-black border border-gray-700 rounded p-2 text-white focus:border-red-500 focus:outline-none"
                value={config.torque}
                onChange={(e) => setConfig({...config, torque: Number(e.target.value)})}
              />
            </div>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded p-3 text-xs text-gray-300">
            <strong className="text-yellow-500">Fiziksel Analiz:</strong> {config.hp} HP güce ortalama devirlerde (6500 d/d) ulaşmak için <strong>{Math.round((config.hp * 7120) / 6500)} Nm</strong> tork üretmeniz önerilir.<br/>
            Şu an girdiğiniz <strong>{config.torque} Nm</strong> tork ile {config.hp} HP'ye ulaşabilmek için fiziksel olarak motorun en az <strong className={Math.round((config.hp * 7120) / config.torque) > 9000 ? "text-red-400" : "text-green-400"}>{Math.round((config.hp * 7120) / config.torque).toLocaleString('tr-TR')} RPM (devir)</strong> çevirmesi gerekmektedir.
          </div>

          {config.engine && config.transmission && (
            <div className="bg-gray-800/40 border border-gray-700 rounded p-3 text-xs text-gray-300">
              <strong className="text-gray-400">Mekanik Şanzıman Kesici Limiti:</strong> Bu motorun devir kesicisi ({config.engine.redline_rpm || 7500} RPM) ve seçtiğiniz <strong>{config.transmission.transmission_code}</strong> şanzıman dikkate alındığında, bu aracın ulaşabileceği teorik maksimum mekanik hız <strong>{getMechanicalTopSpeed()} km/h</strong> olarak hesaplanmıştır. Gücü ne kadar artırırsanız artırın bu hızı aşamaz.
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Ağırlık (kg)</label>
              <input 
                required type="number" min="500" max="4000"
                className="w-full bg-black border border-gray-700 rounded p-2 text-white focus:border-red-500 focus:outline-none"
                value={config.weight}
                onChange={(e) => setConfig({...config, weight: Number(e.target.value)})}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">NOS (Ekstra HP)</label>
              <input 
                required type="number" min="0" max="1000"
                className="w-full bg-black border border-gray-700 rounded p-2 text-white focus:border-red-500 focus:outline-none"
                value={config.nosShot}
                onChange={(e) => setConfig({...config, nosShot: Number(e.target.value)})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Çekiş</label>
              <select 
                className="w-full bg-black border border-gray-700 rounded p-2 text-white focus:border-red-500 focus:outline-none"
                value={config.drivetrain}
                onChange={(e) => setConfig({...config, drivetrain: e.target.value})}
              >
                <option value="FWD">FWD (Önden)</option>
                <option value="RWD">RWD (Arkadan)</option>
                <option value="AWD">AWD (Dört Çeker)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Şanzıman Tipi (Fizik İçin)</label>
              <select 
                className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-gray-300 focus:outline-none"
                value={config.transmissionType}
                disabled
              >
                <option value="Manual">Manuel (Yavaş Geçiş)</option>
                <option value="Auto">Otomatik/DCT (Hızlı Geçiş)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4 bg-gray-800/30 p-3 rounded border border-gray-700">
            <input 
              type="checkbox" 
              id="limiterToggle"
              checked={config.hasLimiter} 
              onChange={(e) => setConfig({...config, hasLimiter: e.target.checked})}
              className="w-4 h-4 text-red-600 bg-black border-gray-700 rounded focus:ring-red-500"
            />
            <label htmlFor="limiterToggle" className="text-sm font-medium text-gray-300">
              Elektronik Hız Kesici (Top Speed Limiter) Aktif
            </label>
            <span className="text-xs text-gray-500 ml-auto">Kapatılırsa mekanik sınıra (Redline) kadar hızlanır</span>
          </div>

          <div className="border-t border-gray-800 pt-4 mt-4">
            <h4 className="text-sm font-bold text-gray-300 mb-2 flex items-center gap-2">
              <Settings size={16} className="text-blue-500" /> Gelişmiş ECU Ayarları (Boost by Gear)
            </h4>
            <p className="text-xs text-gray-500 mb-3">Tekerlek patinaja düşüyorsa alt viteslerde beygir gücünü kısıtlayabilirsiniz. Boş bırakırsanız limitsiz güç verilir.</p>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {[1, 2, 3, 4, 5, 6].map(gear => (
                <div key={gear}>
                  <label className="block text-xs text-gray-400 mb-1">{gear}. Vites (HP)</label>
                  <input 
                    type="number" min="50" max="3000" placeholder="Limitsiz"
                    className="w-full bg-black border border-gray-700 rounded p-1.5 text-white text-sm focus:border-red-500 focus:outline-none"
                    value={config.boostByGear?.[gear] || ''}
                    onChange={(e) => {
                       const val = e.target.value;
                       setConfig({...config, boostByGear: {...(config.boostByGear || {}), [gear]: val ? Number(val) : ''}})
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-gray-800 text-white rounded font-medium hover:bg-gray-700 transition-colors"
            >
              İptal
            </button>
            <button 
              type="submit" 
              className="flex-1 py-3 px-4 bg-red-600 text-white rounded font-bold hover:bg-red-500 flex justify-center items-center gap-2 transition-colors"
            >
              <Save size={18} /> Piste Ekle
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
