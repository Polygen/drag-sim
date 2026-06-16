import { useState } from 'react';
import CarConfigModal from './components/CarConfigModal';
import MultiLaneCanvas from './components/MultiLaneCanvas';
import DynoChartModal from './components/DynoChartModal';
import SetupOptimizer from './components/SetupOptimizer';
import { Plus, Play, Trash2, Car, Edit2, Activity, Settings } from 'lucide-react';

function App() {
  const [cars, setCars] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [racing, setRacing] = useState(false);
  const [testCars, setTestCars] = useState(null);
  const [testSettings, setTestSettings] = useState(null);

  const [raceSettings, setRaceSettings] = useState({
    mode: '400m',
    surface: 'good_asphalt',
    tire: 'street',
    driverStyle: 'balanced',
    launchGear: 1,
    temperature: 20,
    altitude: 0
  });
  
  const [dynoViewIndex, setDynoViewIndex] = useState(null);
  const [optimizerViewIndex, setOptimizerViewIndex] = useState(null);

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

  const editCar = (idx) => {
    setEditingIndex(idx);
    setIsModalOpen(true);
  };

  const removeCar = (idx) => {
    setCars(cars.filter((_, i) => i !== idx));
  };

  return (
    <div className="min-h-screen theme-rs">
      <header className="glass-panel rounded-none border-t-0 border-x-0 p-4 sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="flex items-center gap-4">
            <img src="/rs-logo.png" alt="Preditech" className="h-10 object-contain mix-blend-screen" />
            <span className="text-gray-600 text-sm font-bold">X</span>
            <img src="/preditech-logo.png" alt="RS Garage" className="h-10 object-contain mix-blend-screen" />
          </h1>
          <div className="text-sm text-gray-400">
            Drag Yarışı Lobisi
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 py-8">
        {racing ? (
          <MultiLaneCanvas 
            cars={testCars || cars} 
            raceSettings={testSettings || raceSettings} 
            onBack={() => { setRacing(false); setTestCars(null); setTestSettings(null); }} 
          />
        ) : (
          <div className="animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <div>
                <h2 className="text-4xl font-bold mb-2 text-white">Yarış Lobisi</h2>
                <p className="text-gray-400">Piste dizilecek araçları ayarlayın. (Max 10 araç)</p>
              </div>
              <div className="flex gap-4 w-full md:w-auto">
                <button 
                  onClick={() => {
                    setEditingIndex(null);
                    setIsModalOpen(true);
                  }}
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

            <div className="glass-panel p-6 mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Yarış Modu</label>
                <select 
                  className="w-full bg-black border border-gray-700 rounded p-2 text-white focus:outline-none"
                  value={raceSettings.mode}
                  onChange={e => setRaceSettings({...raceSettings, mode: e.target.value})}
                >
                  <option value="200m">200 Metre Drag (1/8 Mil)</option>
                  <option value="400m">400 Metre Drag (1/4 Mil)</option>
                  <option value="800m">800 Metre Drag (1/2 Mil)</option>
                  <option value="0-100">0-100 km/h (Süre Ölçümü)</option>
                  <option value="100-200">100-200 km/h (Rolling)</option>
                  <option value="Top Speed">Son Hız (Top Speed Sınaması)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Zemin / Yol Kalitesi</label>
                <select 
                  className="w-full bg-black border border-gray-700 rounded p-2 text-white focus:outline-none"
                  value={raceSettings.surface}
                  onChange={e => setRaceSettings({...raceSettings, surface: e.target.value})}
                >
                  <option value="vht">Drag Pisti (VHT - Max Tutunma)</option>
                  <option value="good_asphalt">Kaliteli Asfalt</option>
                  <option value="turkey_asphalt">Türkiye Asfaltı (Çok Kötü)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Genel Lastik Tipi (Tüm Araçlar İçin)</label>
                <select 
                  className="w-full bg-black border border-gray-700 rounded p-2 text-white focus:outline-none"
                  value={raceSettings.tire}
                  onChange={e => setRaceSettings({...raceSettings, tire: e.target.value})}
                >
                  <option value="street">Sokak (Street)</option>
                  <option value="semi_slick">Yarı Slick (Semi-Slick)</option>
                  <option value="slick">Tam Slick (Slick)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Şoför Stili</label>
                <select 
                  className="w-full bg-black border border-gray-700 rounded p-2 text-white focus:outline-none"
                  value={raceSettings.driverStyle || 'balanced'}
                  onChange={e => setRaceSettings({...raceSettings, driverStyle: e.target.value})}
                >
                  <option value="balanced">Dengeli (Standart)</option>
                  <option value="aggressive">Agresif (Hızlı vites, fazla patinaj)</option>
                  <option value="smooth">Pürüzsüz (Sıfır patinaj, yavaş vites)</option>
                </select>
              </div>
            </div>

            <div className="glass-panel p-6 mb-8 grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-gray-800">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Kalkış Vitesi</label>
                <select 
                  className="w-full bg-black border border-gray-700 rounded p-2 text-white focus:outline-none"
                  value={raceSettings.launchGear || 1}
                  onChange={e => setRaceSettings({...raceSettings, launchGear: Number(e.target.value)})}
                >
                  <option value={1}>1. Vites ile Kalkış</option>
                  <option value={2}>2. Vites ile Kalkış (Sarmayı Önler)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Sarmayı (patinajı) engellemek için torku düşürür.</p>
              </div>
              <div>
                <label className="flex justify-between text-sm text-gray-400 mb-2">
                  <span>Hava Sıcaklığı</span>
                  <span className="text-white font-bold">{raceSettings.temperature} °C</span>
                </label>
                <input 
                  type="range" min="-10" max="50" step="1"
                  className="w-full accent-red-500"
                  value={raceSettings.temperature}
                  onChange={e => setRaceSettings({...raceSettings, temperature: Number(e.target.value)})}
                />
                <p className="text-xs text-gray-500 mt-1">Sıcak hava motor gücünü düşürür.</p>
              </div>
              <div>
                <label className="flex justify-between text-sm text-gray-400 mb-2">
                  <span>Rakım (Deniz Seviyesinden Yükseklik)</span>
                  <span className="text-white font-bold">{raceSettings.altitude} Metre</span>
                </label>
                <input 
                  type="range" min="0" max="3000" step="50"
                  className="w-full accent-blue-500"
                  value={raceSettings.altitude}
                  onChange={e => setRaceSettings({...raceSettings, altitude: Number(e.target.value)})}
                />
                <p className="text-xs text-gray-500 mt-1">Yüksek rakımda oksijen azalır, rüzgar direnci düşer ancak motor ciddi güç kaybeder.</p>
              </div>
            </div>

            {cars.length === 0 ? (
              <div className="glass-panel p-12 text-center text-gray-500 border-dashed border-2 border-gray-800">
                <Car size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-xl">Henüz hiç araç eklenmedi.</p>
                <p className="text-sm mt-2">Yarışa başlamak için sağ üstten "Yeni Araç Ekle" butonunu kullanın.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cars.map((car, idx) => (
                  <div key={idx} className="glass-panel p-6 relative group">
                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 p-1.5 rounded-lg border border-gray-700">
                      <button 
                        onClick={() => setOptimizerViewIndex(idx)}
                        className="text-gray-400 hover:text-orange-500 transition-colors p-1"
                        title="Setup Analiz ve Optimizasyon"
                      >
                        <Settings size={18} />
                      </button>
                      <button 
                        onClick={() => setDynoViewIndex(idx)}
                        className="text-gray-400 hover:text-green-500 transition-colors p-1"
                        title="Dyno Grafiği"
                      >
                        <Activity size={18} />
                      </button>
                      <button 
                        onClick={() => editCar(idx)}
                        className="text-gray-400 hover:text-blue-500 transition-colors p-1"
                        title="Düzenle"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => removeCar(idx)}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                        title="Sil"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-4 pr-16 truncate" title={car.name}>{car.name}</h3>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-gray-400">
                        <span>Güç:</span>
                        <span className="text-white font-medium">{car.hp} HP {car.nosShot > 0 && <span className="text-blue-400 text-xs">(+{car.nosShot} NOS)</span>}</span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>Tork:</span>
                        <span className="text-white font-medium">{car.torque} Nm</span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>Ağırlık:</span>
                        <span className="text-white font-medium">{car.weight} kg</span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>Çekiş:</span>
                        <span className="text-amber-400 font-bold">{car.drivetrain}</span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>Şanzıman:</span>
                        <span className="text-white font-medium">{car.transmissionType}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isModalOpen && (
          <CarConfigModal 
            onClose={() => setIsModalOpen(false)} 
            onSave={handleAddCar} 
            initialConfig={editingIndex !== null ? cars[editingIndex] : null}
          />
        )}
        
        {dynoViewIndex !== null && !racing && (
          <DynoChartModal 
            car={cars[dynoViewIndex]} 
            onClose={() => setDynoViewIndex(null)} 
          />
        )}
        
        <div style={{ display: (optimizerViewIndex !== null && !racing) ? 'block' : 'none' }}>
          {optimizerViewIndex !== null && (
            <SetupOptimizer 
              carConfig={cars[optimizerViewIndex]} 
              onClose={() => setOptimizerViewIndex(null)} 
              onTestSetup={(car1, car2, settings) => {
                setTestCars([car1, car2]);
                setTestSettings({ ...raceSettings, ...settings });
                setRacing(true);
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
