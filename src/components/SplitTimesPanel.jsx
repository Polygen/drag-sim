import { Trophy, Clock, Gauge, Zap, AlertTriangle, ChevronUp, ChevronDown, Minus } from 'lucide-react';

/**
 * Split Zamanları ve Groathaus ET Panel
 * Yarış sonuçlarını detaylı gösterir
 */
export default function SplitTimesPanel({ results, raceMode }) {
  if (!results || results.length === 0) return null;

  const winner = results[0];
  const is400m = raceMode === '400m';

  // Groathaus ET karşılaştırması (sadece 400m için anlamlı)
  const groathausComparison = (result) => {
    if (!result.groathaus_et_s || !is400m) return null;
    const diff = result.elapsed_time_s - result.groathaus_et_s;
    return diff;
  };

  const SplitRow = ({ label, times, winnerTime }) => (
    <tr className="border-b border-gray-800/50 hover:bg-white/5 transition-colors">
      <td className="py-2 pl-3 text-xs text-gray-500 font-medium">{label}</td>
      {times.map((t, i) => {
        if (!t || t === 0) return <td key={i} className="py-2 text-center text-xs text-gray-600">—</td>;
        const isWinner = t === winnerTime;
        const diff = t - winnerTime;
        return (
          <td key={i} className="py-2 text-center">
            <span className={`font-mono text-xs font-bold ${isWinner ? 'text-yellow-400' : 'text-gray-300'}`}>
              {t.toFixed(3)}s
            </span>
            {!isWinner && diff > 0 && (
              <span className="text-red-400 text-xs block">+{diff.toFixed(3)}</span>
            )}
          </td>
        );
      })}
    </tr>
  );

  return (
    <div className="space-y-4">
      {/* Groathaus Analizi */}
      {is400m && results.some(r => r.groathaus_et_s) && (
        <div className="bg-purple-950/20 border border-purple-800/40 rounded-xl p-4">
          <h4 className="text-sm font-bold text-purple-400 mb-3 flex items-center gap-2">
            <Zap size={14} /> Groathaus ET Karşılaştırması
          </h4>
          <p className="text-xs text-gray-500 mb-3">
            Groathaus Formülü: ET = 5.825 × (ağırlık_lbs / HP)^(1/3) — Referans tahmin, gerçek pistle kıyaslama için
          </p>
          <div className="space-y-2">
            {results.map((r, i) => {
              const diff = groathausComparison(r);
              if (diff === null) return null;
              const isClose = Math.abs(diff) < 0.3;
              const faster = diff < 0;
              return (
                <div key={i} className="flex items-center justify-between bg-black/40 rounded-lg px-3 py-2">
                  <div>
                    <span className="text-white text-sm font-medium">{r.carInfo.name}</span>
                    <span className="text-gray-500 text-xs ml-2">{r.carInfo.hp} HP / {r.carInfo.weight} kg</span>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-xs">Gerçek: <strong className="text-yellow-400">{r.elapsed_time_s.toFixed(3)}s</strong></span>
                      <span className="text-gray-400 text-xs">Groathaus: <strong className="text-purple-400">{r.groathaus_et_s.toFixed(3)}s</strong></span>
                    </div>
                    <div className={`flex items-center justify-end gap-1 text-xs font-bold mt-0.5 ${
                      faster ? 'text-green-400' : isClose ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {faster ? <ChevronUp size={12} /> : diff > 0 ? <ChevronDown size={12} /> : <Minus size={12} />}
                      {faster ? 'Formula üstü' : '+' + diff.toFixed(3) + 's geride'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detaylı Split Tablosu */}
      {is400m && (
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl overflow-hidden">
          <div className="p-3 border-b border-gray-800 flex items-center gap-2">
            <Clock size={14} className="text-amber-500" />
            <h4 className="text-sm font-bold text-amber-500">Detaylı Split Zamanları</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="py-2 pl-3 text-left text-xs text-gray-500 font-medium">Nokta</th>
                  {results.map((r, i) => (
                    <th key={i} className="py-2 text-center text-xs text-gray-400 font-medium px-2">
                      {r.carInfo.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <SplitRow
                  label="60ft (18.3m)"
                  times={results.map(r => r.split_60ft_s)}
                  winnerTime={Math.min(...results.map(r => r.split_60ft_s || Infinity).filter(t => t < Infinity))}
                />
                <SplitRow
                  label="330ft (100.6m)"
                  times={results.map(r => r.split_330ft_s)}
                  winnerTime={Math.min(...results.map(r => r.split_330ft_s || Infinity).filter(t => t < Infinity))}
                />
                <SplitRow
                  label="660ft / 1/8 mil (201m)"
                  times={results.map(r => r.split_660ft_s)}
                  winnerTime={Math.min(...results.map(r => r.split_660ft_s || Infinity).filter(t => t < Infinity))}
                />
                <SplitRow
                  label="1000ft (304.8m)"
                  times={results.map(r => r.split_1000ft_s)}
                  winnerTime={Math.min(...results.map(r => r.split_1000ft_s || Infinity).filter(t => t < Infinity))}
                />
                <tr className="border-b border-gray-800/50 bg-yellow-900/10">
                  <td className="py-2 pl-3 text-xs text-yellow-500 font-bold">ET (400m)</td>
                  {results.map((r, i) => {
                    const isWin = i === 0;
                    return (
                      <td key={i} className="py-2 text-center">
                        <span className={`font-mono text-sm font-black ${isWin ? 'text-yellow-400' : 'text-gray-300'}`}>
                          {r.elapsed_time_s.toFixed(3)}s
                        </span>
                        {!isWin && (
                          <span className="text-red-400 text-xs block">+{(r.elapsed_time_s - winner.elapsed_time_s).toFixed(3)}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-b border-gray-800/50">
                  <td className="py-2 pl-3 text-xs text-gray-500">Trap Hızı</td>
                  {results.map((r, i) => (
                    <td key={i} className="py-2 text-center font-mono text-xs text-gray-300">
                      {r.speed_at_end_kmh.toFixed(1)} km/h
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ek istatistikler */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {results.map((r, i) => (
          <div key={i} className={`bg-[#0a0a0a] border rounded-xl p-4 ${i === 0 ? 'border-yellow-700/50' : 'border-gray-800'}`}>
            <div className="flex items-center gap-2 mb-3">
              {i === 0 && <Trophy size={14} className="text-yellow-500" />}
              <h4 className="text-sm font-bold text-white">{r.carInfo.name}</h4>
              {i === 0 && <span className="ml-auto text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full font-bold">🏆 1.</span>}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { label: 'Max G-Kuvveti', value: `${r.peak_g_force?.toFixed(2) || '—'} g`, color: 'text-purple-400' },
                { label: 'Patinaj Süresi', value: `${r.total_slip_time_s.toFixed(2)}s`, color: r.total_slip_time_s > 1 ? 'text-red-400' : 'text-green-400' },
                { label: 'Wheelie', value: r.had_wheelie ? `${r.wheelie_time_s.toFixed(2)}s` : 'Yok', color: r.had_wheelie ? 'text-orange-400' : 'text-gray-500' },
                { label: 'Slip Enerjisi', value: `${r.total_slip_energy_kJ?.toFixed(1) || 0} kJ`, color: 'text-amber-400' },
                { label: 'Arka Lastik Isısı', value: `${r.final_tire_temp_rear_c || '—'}°C`, color: (r.final_tire_temp_rear_c > 150) ? 'text-red-400' : 'text-green-400' },
                { label: 'Debriyaj Isısı', value: `${r.final_clutch_temp_c || '—'}°C`, color: (r.final_clutch_temp_c > 400) ? 'text-red-400' : 'text-green-400' },
              ].map((stat, j) => (
                <div key={j} className="bg-black/50 rounded-lg p-2">
                  <p className="text-gray-500">{stat.label}</p>
                  <p className={`font-bold ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
