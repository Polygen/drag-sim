import { X, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function DynoChartModal({ car, onClose }) {
  if (!car || !car.engine || !car.engine.torque_curve_rpm_points) return null;

  const redlineRpm = car.engine.redline_rpm || 7500;
  
  // Sadece redline'a kadar olan (veya redline'ı çok az geçen) noktaları al
  const basePoints = car.engine.torque_curve_rpm_points.filter(pt => pt.rpm <= redlineRpm + 500);
  
  // Find base peaks
  let baseMaxNm = 0;
  for (const pt of basePoints) {
    if (pt.nm > baseMaxNm) baseMaxNm = pt.nm;
  }
  
  // Calculate scaled points
  const nmRatio = baseMaxNm > 0 ? car.torque / baseMaxNm : 1;
  
  const chartData = basePoints.map(pt => {
    const scaledNm = Math.round(pt.nm * nmRatio);
    const scaledHp = Math.round((scaledNm * pt.rpm) / 7120.9);
    // Redline sonrasını sıfırlama veya kesme mantığı:
    if (pt.rpm > redlineRpm) {
       return { rpm: pt.rpm, tork: 0, guc: 0 }; // Redline'dan sonra güç kesilir
    }
    return {
      rpm: pt.rpm,
      tork: scaledNm,
      guc: scaledHp // NOS grafiğe dahil edilmez, çünkü NOS pistte basılır, motorda sabit değildir
    };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#111111] bg-gradient-to-br from-[#1a1a1a] to-[#000000] border border-gray-700 rounded-xl w-full max-w-4xl my-8 shadow-[0_0_50px_rgba(255,0,0,0.15)] animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-black/50 sticky top-0 z-10">
          <h3 className="text-2xl font-bold flex items-center gap-3">
            <Activity className="text-red-500 animate-pulse" size={28} /> 
            <img src="/rs-logo.png" alt="Preditech" className="h-8 object-contain mix-blend-screen" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-orange-400">
              DYNO: {car.name}
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

          <div className="h-[450px] w-full bg-gradient-to-b from-[#0f0f0f] to-[#050505] rounded-xl p-6 border border-gray-800 shadow-inner">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
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
                <XAxis dataKey="rpm" stroke="#444" tick={{fill: '#999', fontSize: 13, fontWeight: '500'}} tickMargin={12} axisLine={{stroke: '#333'}} />
                <YAxis yAxisId="left" stroke="#ff2a2a" tick={{fill: '#ff2a2a', fontSize: 13, fontWeight: 'bold'}} axisLine={{stroke: '#ff2a2a', strokeOpacity: 0.3}} tickMargin={8} />
                <YAxis yAxisId="right" orientation="right" stroke="#2a75ff" tick={{fill: '#2a75ff', fontSize: 13, fontWeight: 'bold'}} axisLine={{stroke: '#2a75ff', strokeOpacity: 0.3}} tickMargin={8} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(0,0,0,0.9)', borderColor: '#333', borderRadius: '8px' }}
                  itemStyle={{ fontWeight: 'bold' }}
                  labelStyle={{ color: '#888', marginBottom: '8px' }}
                  formatter={(value, name) => [value, name === 'guc' ? 'HP' : 'Nm']}
                  labelFormatter={(label) => `${label} RPM`}
                />
                <Legend />
                <Area 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="guc" 
                  name="Beygir Gücü (HP)" 
                  stroke="#ff2a2a" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorGuc)" 
                  activeDot={{ r: 7, fill: '#ff2a2a', stroke: '#fff', strokeWidth: 2 }}
                  style={{ filter: 'url(#neonGlow)' }}
                />
                <Area 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="tork" 
                  name="Tork (Nm)" 
                  stroke="#2a75ff" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorTork)" 
                  activeDot={{ r: 7, fill: '#2a75ff', stroke: '#fff', strokeWidth: 2 }}
                  style={{ filter: 'url(#neonGlow)' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          <div className="mt-6 text-center text-gray-500 text-sm">
            Tekerlek Gücü (WHP) hesaplaması %{car.transmission?.efficiency_pct || 85} aktarma organı verimliliği üzerinden yapılmaktadır.
          </div>
        </div>
      </div>
    </div>
  );
}
