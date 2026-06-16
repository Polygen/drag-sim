import { X, Activity, Thermometer, Gauge, Zap } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine, AreaChart, Area
} from 'recharts';

const COLORS = {
  speed:   '#ef4444',
  rpm:     '#f97316',
  gForce:  '#a855f7',
  tireTempRear:  '#f59e0b',
  tireTempFront: '#3b82f6',
  clutchTemp: '#ec4899',
  slip:    '#22c55e',
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-black/95 border border-gray-700 rounded-lg p-2 text-xs shadow-xl">
      <p className="text-gray-400 mb-1">{parseFloat(label).toFixed(2)}s</p>
      {payload.map(entry => (
        <p key={entry.dataKey} style={{ color: entry.color }} className="font-medium">
          {entry.name}: <strong>{typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}</strong>
        </p>
      ))}
    </div>
  );
};

export default function TelemetryModal({ result, carName, raceMode, onClose }) {
  if (!result || !result.time_series?.length) return null;

  const ts = result.time_series;

  // Vites geçişlerini tespit et (gear değiştiği anlar)
  const shiftTimes = result.gear_shifts?.map(gs => gs.time) || [];

  // Grafikler için renk teması
  const panelCls = "bg-[#0a0a0a] border border-gray-800 rounded-xl p-4";
  const titleCls = "text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2";

  // Küçük özet kartı
  const StatCard = ({ label, value, unit, color }) => (
    <div className="bg-black/60 border border-gray-800 rounded-lg p-3 text-center">
      <p className="text-gray-500 text-xs uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-black mt-1" style={{ color }}>{value}<span className="text-sm font-normal text-gray-400 ml-1">{unit}</span></p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#0d0d0d] border border-gray-700 rounded-2xl w-full max-w-5xl my-4 shadow-[0_0_80px_rgba(168,85,247,0.15)] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-black/60 sticky top-0 z-10 rounded-t-2xl">
          <h3 className="text-xl font-bold flex items-center gap-3">
            <Activity className="text-purple-500" size={24} />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
              Yarış Telemetrisi
            </span>
            <span className="text-gray-400 text-base font-normal">— {carName}</span>
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white p-1">
            <X size={24} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Özet metrikler */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Süre" value={result.elapsed_time_s.toFixed(3)} unit="s" color="#ef4444" />
            <StatCard label="Bitiş Hızı" value={result.speed_at_end_kmh.toFixed(1)} unit="km/h" color="#f97316" />
            <StatCard label="Maks G" value={result.peak_g_force.toFixed(2)} unit="g" color="#a855f7" />
            <StatCard label="Patinaj" value={result.total_slip_time_s.toFixed(2)} unit="s" color="#22c55e" />
          </div>

          {result.had_wheelie && (
            <div className="bg-orange-900/30 border border-orange-700/50 rounded-lg p-3 text-sm text-orange-300 flex items-center gap-2">
              🏋️ <strong>Wheelie Tespit Edildi!</strong> Ön tekerkler {result.wheelie_time_s.toFixed(2)}s boyunca havadaydı.
            </div>
          )}

          {/* Hız + G-Kuvveti */}
          <div className={panelCls}>
            <p className={titleCls}><Gauge size={14} /> Hız & G-Kuvveti</p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ts} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 6" stroke="#1a1a1a" />
                  <XAxis dataKey="time" stroke="#333" tick={{ fill: '#666', fontSize: 10 }}
                    tickFormatter={v => `${v}s`} />
                  <YAxis yAxisId="speed" stroke={COLORS.speed} tick={{ fill: COLORS.speed, fontSize: 10 }} />
                  <YAxis yAxisId="g" orientation="right" stroke={COLORS.gForce} tick={{ fill: COLORS.gForce, fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {shiftTimes.map((t, i) => (
                    <ReferenceLine key={i} yAxisId="speed" x={t} stroke="#444" strokeDasharray="3 3" label={{ value: 'V', fill: '#666', fontSize: 9 }} />
                  ))}
                  <Line yAxisId="speed" type="monotone" dataKey="speed_kmh" name="Hız (km/h)"
                    stroke={COLORS.speed} strokeWidth={2} dot={false} />
                  <Line yAxisId="g" type="monotone" dataKey="accel_g" name="İvme (g)"
                    stroke={COLORS.gForce} strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* RPM + Vites */}
          <div className={panelCls}>
            <p className={titleCls}><Zap size={14} /> Motor Devri & Vites</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ts} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rpmGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.rpm} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.rpm} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 6" stroke="#1a1a1a" />
                  <XAxis dataKey="time" stroke="#333" tick={{ fill: '#666', fontSize: 10 }} tickFormatter={v => `${v}s`} />
                  <YAxis yAxisId="rpm" stroke={COLORS.rpm} tick={{ fill: COLORS.rpm, fontSize: 10 }} />
                  <YAxis yAxisId="gear" orientation="right" stroke="#888" tick={{ fill: '#888', fontSize: 10 }}
                    domain={[0, 10]} tickCount={6} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {shiftTimes.map((t, i) => (
                    <ReferenceLine key={i} yAxisId="rpm" x={t} stroke="#333" strokeDasharray="2 2" />
                  ))}
                  <Area yAxisId="rpm" type="monotone" dataKey="rpm" name="Motor Devri (RPM)"
                    stroke={COLORS.rpm} strokeWidth={2} fill="url(#rpmGrad)" dot={false} />
                  <Line yAxisId="gear" type="stepAfter" dataKey="gear" name="Vites"
                    stroke="#888" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Lastik Sıcaklıkları */}
          <div className={panelCls}>
            <p className={titleCls}><Thermometer size={14} /> Lastik & Debriyaj Sıcaklıkları</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ts} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 6" stroke="#1a1a1a" />
                  <XAxis dataKey="time" stroke="#333" tick={{ fill: '#666', fontSize: 10 }} tickFormatter={v => `${v}s`} />
                  <YAxis stroke="#666" tick={{ fill: '#666', fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="tire_temp_rear_c" name="Arka Lastik (°C)"
                    stroke={COLORS.tireTempRear} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="tire_temp_front_c" name="Ön Lastik (°C)"
                    stroke={COLORS.tireTempFront} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="clutch_temp_c" name="Debriyaj (°C)"
                    stroke={COLORS.clutchTemp} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Patinaj Yüzdesi */}
          <div className={panelCls}>
            <p className={titleCls}><Activity size={14} /> Patinaj Yüzdesi</p>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ts} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="slipGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.slip} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={COLORS.slip} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 6" stroke="#1a1a1a" />
                  <XAxis dataKey="time" stroke="#333" tick={{ fill: '#666', fontSize: 10 }} tickFormatter={v => `${v}s`} />
                  <YAxis stroke={COLORS.slip} tick={{ fill: COLORS.slip, fontSize: 10 }} domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="slipPct" name="Patinaj (%)"
                    stroke={COLORS.slip} strokeWidth={2} fill="url(#slipGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
