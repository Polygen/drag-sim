import { useEffect, useRef, useState } from 'react';
import { simulateRun } from '../optimizer/simRunner';
import { ArrowLeft, Flag, Trophy, RotateCcw } from 'lucide-react';

export default function MultiLaneCanvas({ cars, raceSettings, onBack }) {
  const canvasRef = useRef(null);
  const [status, setStatus] = useState('Yarışa Hazırlanıyor...');
  const [results, setResults] = useState(null);
  const [animProgress, setAnimProgress] = useState(0);
  const [replayKey, setReplayKey] = useState(0);
  const [realisticScale, setRealisticScale] = useState(true);
  const scaleRef = useRef(true);

  useEffect(() => {
    setStatus('Fizik hesaplanıyor...');

    try {
      const allResults = cars.map((car, index) => {
        const res = simulateRun(car, raceSettings);
        return { ...res, carInfo: car, laneIndex: index };
      });

      // Sonuçları Sırala (Top Speed için Hıza göre, diğerleri için Süreye göre)
      if (raceSettings.mode === 'Top Speed') {
        allResults.sort((a, b) => b.speed_at_end_kmh - a.speed_at_end_kmh);
      } else {
        allResults.sort((a, b) => a.elapsed_time_s - b.elapsed_time_s);
      }

      setStatus('Animasyon Oynatılıyor...');
      setResults(allResults); // Skoru hemen göster
      startAnimation(allResults);
    } catch (err) {
      console.error('Simulation crash:', err);
      setStatus('Simülasyon Hatası: ' + err.message);
    }
  }, [cars, raceSettings, replayKey]);

  const startAnimation = (allResults) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const width = canvasRef.current.width;
    const height = canvasRef.current.height;

    // Bulunan maksimum süreyi al
    let maxSimTimeS = 0;
    let minSimTimeS = Infinity;
    allResults.forEach(r => {
      if (r.elapsed_time_s > maxSimTimeS) maxSimTimeS = r.elapsed_time_s;
      if (r.elapsed_time_s < minSimTimeS) minSimTimeS = r.elapsed_time_s;
    });

    const isSpeedMode = !['200m', '400m', '800m'].includes(raceSettings.mode);
    
    // Görüntü alanı için piksel hesabı
    let trackLengthPx = width - 150;
    let targetDist = 400;
    if (raceSettings.mode === '200m') targetDist = 200;
    if (raceSettings.mode === '800m') targetDist = 800;
    let pixelsPerMeter = trackLengthPx / targetDist; 
    
    // 0-100 veya 100-200 için en uzun giden arabanın mesafesini pist uzunluğu kabul et
    if (isSpeedMode) {
      let maxDist = 0;
      allResults.forEach(r => {
        const ts = r.time_series;
        const d = ts.length > 0 ? ts[ts.length - 1].distance : 0;
        if (d > maxDist) maxDist = d;
      });
      pixelsPerMeter = trackLengthPx / Math.max(10, maxDist);
    }

    let startTime = null;
    let animationFrameId;

    const draw = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsedMs = timestamp - startTime;
      const elapsedSimS = elapsedMs / 1000; // Real-time mapping

      let drawTimeS = elapsedSimS;
      if (elapsedSimS >= minSimTimeS) {
         drawTimeS = minSimTimeS; // Yarışın galibi bitiş çizgisini geçtiği an herkesi dondur (farkı göstermek için)
      }

      if (elapsedSimS >= minSimTimeS + 3) { // Bitişten sonra donuk kalmaya devam et
        setStatus(prev => prev !== 'Yarış Bitti!' ? 'Yarış Bitti!' : prev);
        // Loop bitmez, çalışmaya devam eder (böylece scale butonu anında etki eder)
      }

      ctx.clearRect(0, 0, width, height);
      
      // Arka plan
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, width, height);

      // Çizgiler
      ctx.fillStyle = '#fff';
      if (!isSpeedMode) {
        ctx.fillRect(100, 0, 5, height); // Start
        ctx.fillRect(100 + targetDist * pixelsPerMeter, 0, 5, height); // Finish
      } else {
        ctx.fillStyle = '#444';
        ctx.fillText(`Mod: ${raceSettings.mode}`, 10, 20);
      }

      const laneHeight = height / cars.length;

      allResults.forEach((res) => {
        const laneY = res.laneIndex * laneHeight;
        const ts = res.time_series;
        
        // Find the exact frame for the current real-time
        let state = ts[ts.length - 1]; // default to end state
        for (let i = 0; i < ts.length; i++) {
          if (ts[i].time >= drawTimeS) {
            state = ts[i];
            break;
          }
        }

        // Kulvar çizgisi
        ctx.strokeStyle = '#333';
        ctx.beginPath();
        ctx.moveTo(0, laneY + laneHeight);
        ctx.lineTo(width, laneY + laneHeight);
        ctx.stroke();

        const carX = 100 + state.distance * pixelsPerMeter;
        const carY = laneY + laneHeight / 2;

        ctx.save();
        ctx.translate(carX, carY);

        const carRealLengthM = 4.5;
        const carRealWidthM = 2.0;
        const isRealistic = scaleRef.current;
        const carLenPx = isRealistic ? (carRealLengthM * pixelsPerMeter) : 40;
        const carWidthPx = isRealistic ? (carRealWidthM * pixelsPerMeter) : 20;

        // Fish-tail (Yalpalama) Efekti
        // Daha gerçekçi ve yumuşatılmış
        if (state.slipPct > 5 && state.gear <= 3) {
          // Çok düşük hızda çılgınca vurmasın diye dampener koyalım
          const speedDampener = Math.min(state.speed_kmh / 30, 1.0); // 30km/h altında hafiflet
          const wobbleFreq = 10; // Daha doğal salınım
          const wobbleAmp = (state.slipPct / 100) * 0.15 * speedDampener; // Max açıyı düşürdük
          const wobbleAngle = Math.sin(elapsedSimS * wobbleFreq) * wobbleAmp;
          ctx.rotate(wobbleAngle);
          
          // Duman Efekti
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(state.slipPct/100, 0.7)})`;
          ctx.beginPath();
          const smokeX = res.carInfo.drivetrain === 'FWD' ? (carLenPx / 4) : (-carLenPx / 2);
          ctx.arc(smokeX, (Math.random() - 0.5) * 10, 15 + Math.random() * 15, 0, Math.PI * 2);
          ctx.fill();
        }

        // NOS Efekti
        if (res.carInfo.nosShot > 0 && state.gear > 1 && state.speed_kmh > 50 && !isFinished(state, raceSettings.mode)) {
          ctx.fillStyle = '#3b82f6';
          ctx.beginPath();
          ctx.moveTo(-carLenPx / 2, -5);
          ctx.lineTo(-carLenPx / 2 - 20 - Math.random() * 20, 0);
          ctx.lineTo(-carLenPx / 2, 5);
          ctx.fill();
        }

        // Araç çizimi
        ctx.fillStyle = res.laneIndex % 2 === 0 ? '#ef4444' : '#3b82f6';
        ctx.fillRect(-carLenPx / 2, -carWidthPx / 2, carLenPx, carWidthPx); // Şasi
        
        ctx.fillStyle = '#000';
        // Camı arabanın ortasına/biraz önüne koyalım
        ctx.fillRect(-carLenPx * 0.1, -carWidthPx * 0.4, carLenPx * 0.3, carWidthPx * 0.8); // Cam
        
        ctx.restore();

        // Araç İsmi ve Hız
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.fillText(`${res.carInfo.name}`, Math.max(10, carX - carLenPx/2), carY - 15);
        ctx.fillStyle = '#aaa';
        ctx.fillText(`${state.speed_kmh.toFixed(0)} km/h - Vites: ${state.gear}`, Math.max(10, carX - carLenPx/2), carY + 20);
      });

      setAnimProgress((elapsedSimS / minSimTimeS) * 100);
      animationFrameId = requestAnimationFrame(draw);
    };

    animationFrameId = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(animationFrameId);
  };

  const isFinished = (state, mode) => {
    if (mode === '200m' && state.distance >= 200) return true;
    if (mode === '400m' && state.distance >= 400) return true;
    if (mode === '800m' && state.distance >= 800) return true;
    if (mode === '0-100' && state.speed_kmh >= 100) return true;
    if (mode === '100-200' && state.speed_kmh >= 200) return true;
    // Top speed mode finishes when simulation finishes naturally
    return false; 
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-800 transition-colors">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-4">
            <img src="/rs-logo.png" alt="Preditech" className="h-14 object-contain mix-blend-screen" /> 
            <span className="text-yellow-500">Pisti</span>
          </h2>
          <p className="text-gray-400">{status}</p>
        </div>
        {results && (
          <div className="ml-auto flex gap-2">
            <button 
              onClick={() => {
                scaleRef.current = !scaleRef.current;
                setRealisticScale(scaleRef.current);
              }} 
              className="btn-primary bg-gray-700 text-white hover:bg-gray-600 flex items-center gap-2"
            >
              {realisticScale ? 'Büyük Araç Görünümü' : 'Gerçek Boyutlu Görünüm'}
            </button>
            <button 
              onClick={() => {
                setResults(null);
                setAnimProgress(0);
                setReplayKey(k => k + 1);
              }} 
              className="btn-primary bg-blue-600 text-white hover:bg-blue-500 flex items-center gap-2"
            >
              <RotateCcw size={20} /> Yeniden Oynat
            </button>
          </div>
        )}
      </div>

      <div className="glass-panel p-4 mb-6 relative overflow-hidden">
        <canvas 
          ref={canvasRef} 
          width={1000} 
          height={Math.max(300, cars.length * 60)} 
          className="w-full bg-black rounded-lg border border-gray-800"
        />
        
        <div className="absolute bottom-0 left-0 h-1 bg-gray-800 w-full">
          <div 
            className="h-full bg-red-500 transition-all duration-75" 
            style={{ width: `${Math.min(100, animProgress)}%` }}
          />
        </div>
      </div>

      {results && (
        <div className="glass-panel p-6 animate-in slide-in-from-bottom-8">
          <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Trophy className="text-yellow-500" /> Yarış Sonuçları ({raceSettings.mode})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="pb-3 pl-4">Sıra</th>
                  <th className="pb-3">Araç</th>
                  <th className="pb-3">{raceSettings.mode === 'Top Speed' ? 'Ulaşılan Süre' : 'Süre'}</th>
                  <th className="pb-3">Fark</th>
                  <th className="pb-3">{raceSettings.mode === 'Top Speed' ? 'Bitiş Hızı (V-MAX)' : 'Bitiş Hızı'}</th>
                  <th className="pb-3">Patinaj Süresi</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => {
                  let gapText = "-";
                  if (i > 0 && raceSettings.mode !== 'Top Speed') {
                    const winnerTime = results[0].elapsed_time_s;
                    const ts = r.time_series;
                    let distAtWin = ts[ts.length - 1].distance;
                    for (let j = 0; j < ts.length; j++) {
                       if (ts[j].time >= winnerTime) {
                          if (j > 0) {
                             const p = ts[j - 1];
                             const c = ts[j];
                             const ratio = (winnerTime - p.time) / (c.time - p.time);
                             distAtWin = p.distance + ratio * (c.distance - p.distance);
                          } else {
                             distAtWin = ts[j].distance;
                          }
                          break;
                       }
                    }
                    let winnerDist = 400;
                    if (raceSettings.mode === '200m') winnerDist = 200;
                    if (raceSettings.mode === '800m') winnerDist = 800;
                    if (raceSettings.mode === '0-100' || raceSettings.mode === '100-200') {
                       winnerDist = results[0].time_series[results[0].time_series.length - 1].distance;
                    }
                    const gapM = Math.max(0, winnerDist - distAtWin);
                    const gapB = gapM / 4.5;
                    gapText = `+${(r.elapsed_time_s - winnerTime).toFixed(3)}s (${gapM.toFixed(1)}m / ${gapB.toFixed(1)} Boy)`;
                  }

                  return (
                    <tr key={i} className={`border-b border-gray-800/50 ${i === 0 ? 'bg-yellow-900/10' : ''}`}>
                      <td className="py-4 pl-4 font-bold text-xl text-gray-500">#{i + 1}</td>
                      <td className="py-4">
                        <div className="font-bold text-white">{r.carInfo.name}</div>
                        <div className="text-xs text-gray-500">{r.carInfo.hp} HP / {r.carInfo.weight} kg</div>
                      </td>
                      <td className={`py-4 font-mono ${raceSettings.mode !== 'Top Speed' ? 'text-amber-400 text-xl' : 'text-gray-400'}`}>
                        {r.elapsed_time_s.toFixed(3)}s
                      </td>
                      <td className="py-4 font-mono text-gray-300">
                        {gapText}
                      </td>
                      <td className={`py-4 font-mono ${raceSettings.mode === 'Top Speed' ? 'text-amber-400 text-2xl font-bold' : 'text-gray-300'}`}>
                        {r.speed_at_end_kmh.toFixed(1)} km/h
                      </td>
                      <td className="py-4 text-sm text-red-400">{r.total_slip_time_s.toFixed(2)}s patinaj</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
