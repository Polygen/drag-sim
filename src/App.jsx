import { useState } from 'react';
import CarConfigModal from './components/CarConfigModal';
import MultiLaneCanvas from './components/MultiLaneCanvas';
import DynoChartModal from './components/DynoChartModal';
import { Plus, Play, Trash2, Car, Edit2, Activity, Wind, Thermometer, Mountain, Droplets, ChevronDown, ChevronUp } from 'lucide-react';

function App() {
  const [cars, setCars] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [racing, setRacing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [raceSettings, setRaceSettings] = useState({
    mode: '400m',
    surface: 'good_asphalt',
    tire: 'street',
    temperature: 20,
    altitude: 0,
    humidity: 50,
    windSpeedMs: 0,
    inclineDeg: 0,
  });

  const [dynoViewIndex, setDynoViewIndex] = useState(null);
  const updRace = (patch) => setRaceSettings(s => ({ ...s, ...patch }));

  const handleAddCar = (carConfig) => {
    if (editingIndex !== null) {
      const newCars = [...cars];
      newCars[editingIndex] = carConfig;
      setCars(newCars);
    } else {
      setCars([...cars, carConfig]);
    }
    setIsModalOpen(false);
    setEditingIndex(null);
  };

  const editCar = (idx) => { setEditingIndex(idx); setIsModalOpen(true); };
  const removeCar = (idx) => setCars(cars.filter((_, i) => i !== idx));

  // Araç kartı özet bilgileri
  const CarBadge = ({ label, value, color = 'text-white' }) => (
    <div className="flex justify-between text-sm">
      <span className="text-gray-400">{label}</span>
      <span className={`font-medium ${color}`}>{value}</span>
    </div>
  );

  return (
    <div className="min-h-screen theme-rs">
      <header className="glass-panel rounded-none border-t-0 border-x-0 p-4 sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="flex items-center gap-4">
            <img src="/rs-logo.png" alt="Preditech" className="h-10 object-contain mix-blend-screen" />
            <span className="text-gray-600 text-sm font-bold">×</span>
            <img src="/preditech-logo.png" alt="RS Garage" className="h-10 object-contain mix-blend-screen" />
          </h1>
          <div className="text-sm text-gray-400">Drag Yarışı Simülatörü v2.0</div>
        </div>
      </header>

      <main className="container mx-auto p-4 py-8">
        {racing ? (
          <MultiLaneCanvas cars={cars} raceSettings={raceSettings} onBack={() => setRacing(false)} />
        ) : (
          <div className="animate-in fade-in duration-300">
            {/* Başlık */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <div>
                <h2 className="text-4xl font-bold mb-2 text-white">Yarış Lobisi</h2>
                <p className="text-gray-400">Piste dizilecek araçları ayarlayın. (Max 10 araç)</p>
              </div>
              <div className="flex gap-4 w-full md:w-auto">
                <button
                  onClick={() => { setEditingIndex(null); setIsModalOpen(true); }}
                  disabled={cars.length >= 10}
                  className="btn-primary bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2 flex-1 md:flex-none justify-center"
                >
                  <Plus size={20} /> Yeni Araç Ekle
                </button>
                <button
                  onClick={() => setRacing(true)}
                  disabled={cars.length < 1}
                  className="btn-primary bg-red-600 text-white hover:bg-red-500 disabled:opacity-50 flex items-center gap-2 flex-1 md:flex-none justify-center"
                >
                  <Play size={20} /> Yarışı Başlat
                </button>
              </div>
            </div>

            {/* Pist Ayarları — Temel */}
            <div className="glass-panel p-6 mb-4 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm text-gray-400 mb-2 font-medium">Yarış Modu</label>
                <select
                  className="w-full bg-black border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-red-500"
                  value={raceSettings.mode}
                  onChange={e => updRace({ mode: e.target.value })}
                >
                  <option value="200m">200 Metre (1/8 Mil)</option>
                  <option value="400m">400 Metre (1/4 Mil)</option>
                  <option value="800m">800 Metre (1/2 Mil)</option>
                  <option value="0-100">0-100 km/h</option>
                  <option value="100-200">100-200 km/h (Rolling)</option>
                  <option value="Top Speed">Son Hız (Top Speed)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2 font-medium">Zemin Kalitesi</label>
                <select
                  className="w-full bg-black border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-red-500"
                  value={raceSettings.surface}
                  onChange={e => updRace({ surface: e.target.value })}
                >
                  <option value="vht">Drag Pisti (VHT — Max Tutunma)</option>
                  <option value="good_asphalt">Kaliteli Asfalt</option>
                  <option value="turkey_asphalt">Türkiye Asfaltı (Kötü)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2 font-medium">Genel Lastik Tipi</label>
                <select
                  className="w-full bg-black border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-red-500"
                  value={raceSettings.tire}
                  onChange={e => updRace({ tire: e.target.value })}
                >
                  <option value="street">Sokak (Street)</option>
                  <option value="semi_slick">Yarı Slick</option>
                  <option value="slick">Tam Slick</option>
                </select>
                <p className="text-xs text-gray-600 mt-1">* Araç başına lastik tipi de CarConfig'den ayarlanabilir</p>
              </div>
            </div>

            {/* Çevresel Koşullar */}
            <div className="glass-panel p-5 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Sıcaklık */}
                <div>
                  <label className="flex justify-between text-sm text-gray-400 mb-2">
                    <span className="flex items-center gap-1.5"><Thermometer size={14} /> Hava Sıcaklığı</span>
                    <span className="text-white font-bold">{raceSettings.temperature}°C</span>
                  </label>
                  <input type="range" min="-10" max="50" step="1"
                    className="w-full accent-red-500"
                    value={raceSettings.temperature}
                    onChange={e => updRace({ temperature: Number(e.target.value) })} />
                  <p className="text-xs text-gray-600 mt-1">Sıcak hava motor gücünü düşürür, soğuk lastik tutunmayı azaltır.</p>
                </div>
                {/* Rakım */}
                <div>
                  <label className="flex justify-between text-sm text-gray-400 mb-2">
                    <span className="flex items-center gap-1.5"><Mountain size={14} /> Rakım</span>
                    <span className="text-white font-bold">{raceSettings.altitude} m</span>
                  </label>
                  <input type="range" min="0" max="3000" step="50"
                    className="w-full accent-blue-500"
                    value={raceSettings.altitude}
                    onChange={e => updRace({ altitude: Number(e.target.value) })} />
                  <p className="text-xs text-gray-600 mt-1">Yüksek rakımda oksijen azalır. Turbo motorlar kısmen telafi eder.</p>
                </div>
              </div>

              {/* Gelişmiş Çevresel Faktörler */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 mt-4 transition-colors"
              >
                {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                Gelişmiş Pist Koşulları (Rüzgar, Nem, Eğim)
              </button>

              {showAdvanced && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-4 pt-4 border-t border-gray-800 animate-in fade-in duration-200">
                  {/* Nem */}
                  <div>
                    <label className="flex justify-between text-sm text-gray-400 mb-2">
                      <span className="flex items-center gap-1.5"><Droplets size={14} /> Bağıl Nem</span>
                      <span className="text-white font-bold">%{raceSettings.humidity}</span>
                    </label>
                    <input type="range" min="10" max="100" step="5"
                      className="w-full accent-cyan-500"
                      value={raceSettings.humidity}
                      onChange={e => updRace({ humidity: Number(e.target.value) })} />
                    <p className="text-xs text-gray-600 mt-1">Nem hava yoğunluğunu hafifçe düşürür.</p>
                  </div>
                  {/* Rüzgar */}
                  <div>
                    <label className="flex justify-between text-sm text-gray-400 mb-2">
                      <span className="flex items-center gap-1.5"><Wind size={14} /> Rüzgar</span>
                      <span className={`font-bold ${raceSettings.windSpeedMs > 0 ? 'text-red-400' : raceSettings.windSpeedMs < 0 ? 'text-green-400' : 'text-white'}`}>
                        {raceSettings.windSpeedMs > 0 ? `+${raceSettings.windSpeedMs}` : raceSettings.windSpeedMs} m/s
                      </span>
                    </label>
                    <input type="range" min="-15" max="15" step="1"
                      className="w-full accent-yellow-500"
                      value={raceSettings.windSpeedMs}
                      onChange={e => updRace({ windSpeedMs: Number(e.target.value) })} />
                    <p className="text-xs text-gray-600 mt-1">
                      {raceSettings.windSpeedMs > 0 ? '⬅️ Baş rüzgar — yavaşlatır' : raceSettings.windSpeedMs < 0 ? '➡️ Arka rüzgar — hızlandırır' : 'Nötr'}
                    </p>
                  </div>
                  {/* Eğim */}
                  <div>
                    <label className="flex justify-between text-sm text-gray-400 mb-2">
                      <span className="flex items-center gap-1.5"><Mountain size={14} /> Pist Eğimi</span>
                      <span className={`font-bold ${raceSettings.inclineDeg > 0 ? 'text-red-400' : raceSettings.inclineDeg < 0 ? 'text-green-400' : 'text-white'}`}>
                        {raceSettings.inclineDeg > 0 ? `+${raceSettings.inclineDeg}` : raceSettings.inclineDeg}°
                      </span>
                    </label>
                    <input type="range" min="-5" max="5" step="0.5"
                      className="w-full accent-orange-500"
                      value={raceSettings.inclineDeg}
                      onChange={e => updRace({ inclineDeg: Number(e.target.value) })} />
                    <p className="text-xs text-gray-600 mt-1">
                      {raceSettings.inclineDeg > 0 ? '⬆️ Yokuş yukarı' : raceSettings.inclineDeg < 0 ? '⬇️ Yokuş aşağı' : 'Düz pist'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Araç Listesi */}
            {cars.length === 0 ? (
              <div className="glass-panel p-12 text-center text-gray-500 border-dashed border-2 border-gray-800">
                <Car size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-xl">Henüz hiç araç eklenmedi.</p>
                <p className="text-sm mt-2">Yarışa başlamak için "Yeni Araç Ekle" butonunu kullanın.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cars.map((car, idx) => (
                  <div key={idx} className="glass-panel p-5 relative group transition-all hover:border-gray-600">
                    {/* Aksiyon butonları */}
                    <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 p-1.5 rounded-lg border border-gray-700">
                      <button onClick={() => setDynoViewIndex(idx)}
                        className="text-gray-400 hover:text-green-500 transition-colors p-1" title="Dyno Grafiği">
                        <Activity size={16} />
                      </button>
                      <button onClick={() => editCar(idx)}
                        className="text-gray-400 hover:text-blue-500 transition-colors p-1" title="Düzenle">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => removeCar(idx)}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1" title="Sil">
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* Araç adı */}
                    <h3 className="text-xl font-bold text-white mb-3 pr-24 truncate" title={car.name}>{car.name}</h3>

                    <div className="space-y-1.5">
                      <CarBadge label="Güç" value={`${car.hp} HP${car.nosShot > 0 ? ` (+${car.nosShot} NOS)` : ''}`} color="text-red-400" />
                      <CarBadge label="Tork" value={`${car.torque} Nm`} />
                      <CarBadge label="Ağırlık" value={`${car.weight} kg`} />
                      <CarBadge label="Çekiş" value={car.drivetrain} color="text-amber-400" />
                      {car.transmission && <CarBadge label="Şanzıman" value={car.transmission.transmission_code} />}
                      {car.engine && <CarBadge label="Motor" value={car.engine.engine_code} color="text-blue-400" />}
                      {car.isForged && (
                        <div className="text-xs text-green-400 font-medium mt-1">🔨 Forged Internals</div>
                      )}
                      {car.tireCompoundId && (
                        <div className="text-xs text-gray-500 mt-1">
                          🛞 {car.tireCompoundId?.replace('tire_', '').replace(/_/g, ' ')}
                          {car.hasBurnout && <span className="text-orange-400 ml-1">🔥 Burnout</span>}
                        </div>
                      )}
                    </div>

                    {/* HP/Ağırlık oranı */}
                    <div className="mt-3 pt-3 border-t border-gray-800">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>HP/Ton:</span>
                        <span className="font-bold text-white">{Math.round(car.hp / (car.weight / 1000))}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modals */}
        {isModalOpen && (
          <CarConfigModal
            onClose={() => { setIsModalOpen(false); setEditingIndex(null); }}
            onSave={handleAddCar}
            initialConfig={editingIndex !== null ? cars[editingIndex] : null}
          />
        )}

        {dynoViewIndex !== null && (
          <DynoChartModal
            car={cars[dynoViewIndex]}
            onClose={() => setDynoViewIndex(null)}
          />
        )}
      </main>
    </div>
  );
}

export default App;
