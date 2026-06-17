import { useState, useMemo } from 'react';
import { X, Activity, Info } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { calcEffectiveEnginePower } from '../physics/engineModel.js';

export default function DynoChartModal({ car, onClose }) {
  const [testGear, setTestGear] = useState(1);
  const [testRpm, setTestRpm] = useState(2500);

  if (!car || !car.engine || !car.engine.torque_curve_rpm_points) return null;

  const redlineRpm = car.engine.redline_rpm || 7500;
  const basePoints = car.engine.torque_curve_rpm_points.filter(pt => pt.rpm <= redlineRpm + 500);
  
  let baseMaxNm = 0;
  for (const pt of basePoints) {
    if (pt.nm > baseMaxNm) baseMaxNm = pt.nm;
  }
  const nmRatio = baseMaxNm > 0 ? car.torque / baseMaxNm : 1;
  
  let maxHpRpm = 0;
  let maxHp = 0;

  const chartData = basePoints.map(pt => {
    const scaledNm = Math.round(pt.nm * nmRatio);
    const scaledHp = Math.round((scaledNm * pt.rpm) / 7120.9);
    
    if (pt.rpm <= redlineRpm && scaledHp > maxHp) {
      maxHp = scaledHp;
      maxHpRpm = pt.rpm;
    }

    if (pt.rpm > redlineRpm) return { rpm: pt.rpm, tork: 0, guc: 0 };
    return { rpm: pt.rpm, tork: scaledNm, guc: scaledHp };
  });

  // Shift advice
  let shiftAdviceRpm = maxHpRpm + 200;
  if (shiftAdviceRpm > redlineRpm) shiftAdviceRpm = redlineRpm;

  // Turbo simulator
  const configForTest = {
    baseTorqueNm: 200, // Dummy
    engineRpm: testRpm,
    aspiration: car.engine.aspiration,
    maxBoostBar: car.engine.max_boost_bar || 0,
    turboLagRpm: car.engine.turbo_lag_rpm || 2000,
    fullBoostRpm: car.engine.full_boost_rpm || 3500,
    intercoolerType: car.engine.intercooler_type,
    fuelType: car.fuelType,
    appliedMods: car.appliedMods,
    powerLossFactor: 1.0,
    atmosphericPressurePa: 101325
  };

  const testPower = calcEffectiveEnginePower(configForTest);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#111111] bg-gradient-to-br from-[#1a1a1a] to-[#000000] border border-gray-700 rounded-xl w-full max-w-4xl my-8 shadow-[0_0_50px_rgba(255,0,0,0.15)] animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-black/50 sticky top-0 z-10">
          <h3 className="text-2xl font-bold flex items-center gap-3">
            <Activity className="text-red-500 animate-pulse" size={28} /> 
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-orange-400">
              DYNO & ANALİZ: {car.name}
            </span>
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={28} />
          </button>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-[#0a0a0a] border-t-2 border-red-500/50 rounded-xl p-5 text-center shadow-[0_0_15px_rgba(239,68,68,0.1)] relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-b from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="text-gray-400 text-sm font-medium tracking-wider mb-1 uppercase">Maksimum Motor Gücü</div>
              <div className="text-4xl font-black text-white">{car.hp} <span className="text-lg text-red-500 font-bold">HP</span></div>
            </div>
            <div className="bg-[#0a0a0a] border-t-2 border-blue-500/50 rounded-xl p-5 text-center shadow-[0_0_15px_rgba(59,130,246,0.1)] relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="text-gray-400 text-sm font-medium tracking-wider mb-1 uppercase">Maksimum Tork</div>
              <div className="text-4xl font-black text-white">{car.torque} <span className="text-lg text-blue-500 font-bold">Nm</span></div>
            </div>
            <div className="bg-[#0a0a0a] border-t-2 border-orange-500/50 rounded-xl p-5 text-center shadow-[0_0_15px_rgba(249,115,22,0.1)] relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-b from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="text-gray-400 text-sm font-medium tracking-wider mb-1 uppercase">Devir Kesici (Redline)</div>
              <div className="text-4xl font-black text-white">{car.engine.redline_rpm || 7500} <span className="text-lg text-orange-500 font-bold">RPM</span></div>
            </div>
            <div className="bg-[#0a0a0a] border-t-2 border-gray-500/50 rounded-xl p-5 text-center shadow-[0_0_15px_rgba(156,163,175,0.1)] relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-b from-gray-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="text-gray-400 text-sm font-medium tracking-wider mb-1 uppercase">Araç Ağırlığı</div>
              <div className="text-4xl font-black text-white">{car.weight} <span className="text-lg text-gray-500 font-bold">kg</span></div>
            </div>
          </div>

          <div className="h-[350px] w-full bg-gradient-to-b from-[#0f0f0f] to-[#050505] rounded-xl p-6 border border-gray-800 shadow-inner mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorGuc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorTork" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 6" stroke="#2a2a2a" vertical={false} />
                <XAxis dataKey="rpm" stroke="#444" tick={{fill: '#999', fontSize: 13}} tickMargin={12} />
                <YAxis yAxisId="left" stroke="#ff2a2a" tick={{fill: '#ff2a2a', fontSize: 13}} />
                <YAxis yAxisId="right" orientation="right" stroke="#2a75ff" tick={{fill: '#2a75ff', fontSize: 13}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(0,0,0,0.9)', borderColor: '#333' }}
                  itemStyle={{ fontWeight: 'bold' }}
                  formatter={(value, name) => [value, name === 'guc' ? 'HP' : 'Nm']}
                />
                <Legend />
                <Area yAxisId="left" type="monotone" dataKey="guc" name="Beygir Gücü (HP)" stroke="#ff2a2a" strokeWidth={3} fill="url(#colorGuc)" />
                <Area yAxisId="right" type="monotone" dataKey="tork" name="Tork (Nm)" stroke="#2a75ff" strokeWidth={3} fill="url(#colorTork)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Shift Advice */}
            <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-5">
              <h4 className="text-white font-bold mb-3 flex items-center gap-2"><Info size={18} className="text-blue-400" /> Sürüş Tavsiyeleri</h4>
              <ul className="space-y-3 text-sm text-gray-300">
                <li className="flex justify-between bg-black/40 p-2 rounded">
                  <span>Maksimum Güç Devri:</span>
                  <span className="font-bold text-white">{maxHpRpm} RPM</span>
                </li>
                <li className="flex justify-between bg-black/40 p-2 rounded">
                  <span>Önerilen Vites Atma Noktası:</span>
                  <span className="font-bold text-green-400">{shiftAdviceRpm} RPM</span>
                </li>
                <li className="flex justify-between bg-black/40 p-2 rounded">
                  <span>Traction / Patinaj Riski:</span>
                  <span className="font-bold text-orange-400">{car.hp > 400 && car.drivetrain !== 'AWD' ? '1. ve 2. viteste yüksek' : 'Düşük/Orta'}</span>
                </li>
              </ul>
            </div>

            {/* Turbo Preview */}
            <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-5">
              <h4 className="text-white font-bold mb-3 flex items-center gap-2"><Activity size={18} className="text-orange-400" /> Turbo ve Basınç Simülatörü</h4>
              {car.engine.aspiration === 'turbo' || car.engine.max_boost_bar > 0 ? (
                <>
                  <div className="flex gap-4 mb-4">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 mb-1 block">Test Devri (RPM)</label>
                      <input type="range" min="1000" max={redlineRpm} step="100" className="w-full accent-orange-500"
                        value={testRpm} onChange={e => setTestRpm(Number(e.target.value))} />
                      <div className="text-right text-white font-bold text-sm">{testRpm} RPM</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm text-gray-300">
                    <div className="bg-black/40 p-3 rounded text-center">
                      <p className="text-gray-500 text-xs mb-1">Anlık Basınç (Boost)</p>
                      <p className="text-xl font-bold text-orange-400">{testPower.boostBar.toFixed(2)} Bar</p>
                    </div>
                    <div className="bg-black/40 p-3 rounded text-center">
                      <p className="text-gray-500 text-xs mb-1">Spool Yüzdesi</p>
                      <p className="text-xl font-bold text-white">{Math.round(testPower.boostFraction * 100)}%</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-3 text-center">
                    Bu hesaplama mevcut modifikasyonlar (Downpipe vb.) kullanılarak yapılır.
                  </p>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                  Bu araç atmosferik (NA). Turbo modülü aktif değil.
                </div>
              )}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
