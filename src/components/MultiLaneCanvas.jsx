import { useEffect, useRef, useState } from 'react';
import { simulate } from '../physics/simulation';
import { calcAeroFromMods } from '../physics/aerodynamics.js';
import { parseTireSize } from '../physics/tireModel.js';
import { ArrowLeft, Flag, Trophy, RotateCcw, Activity, BarChart2 } from 'lucide-react';
import TelemetryModal from './TelemetryModal.jsx';
import SplitTimesPanel from './SplitTimesPanel.jsx';
import tireCompoundsData from '../data/tire_compounds.json';

// Sabit renkler — araç indeksine göre
const CAR_COLORS = [
  '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'
];

function buildSimConfig(car, raceSettings) {
  // Lastik compound
  const compound = car.tireCompound || tireCompoundsData.find(c => c.id === (car.tireCompoundId || 'tire_high_perf_street'));

  // Mu hesabı — pist yüzeyi × lastik compound
  let surfaceMu = 1.0;
  if (raceSettings.surface === 'vht') surfaceMu = 1.35;
  else if (raceSettings.surface === 'good_asphalt') surfaceMu = 1.0;
  else if (raceSettings.surface === 'turkey_asphalt') surfaceMu = 0.72;

  // Lastik bileşiği mu — pist yüzeyi ile çarpılır
  const compoundMu = raceSettings.surface === 'vht'
    ? (compound?.mu_prep_dry || 1.0)
    : (compound?.mu_street_dry || 1.0);

  const finalMu = surfaceMu * compoundMu;

  // Lastik geometrisi
  const rearTireGeo = parseTireSize(car.rearTireSize || '225/45R17');

  // Tork eğrisi ölçekleme
  let mappedTqCurve = [];
  if (car.engine?.torque_curve_rpm_points) {
    const stockTq = parseInt(car.engine.stock_torque_nm_at_rpm) || 1;
    const tqRatio = car.torque / stockTq;
    mappedTqCurve = car.engine.torque_curve_rpm_points.map(p => ({
      rpm: p.rpm,
      nm: p.nm * tqRatio
    }));
  } else {
    const peakTqRpm  = 4000;
    const peakHpRpm  = 6500;
    const tqAtPeakHp = (car.hp * 7120) / peakHpRpm;
    mappedTqCurve = [1000, 2000, 3000, 4000, 5000, 6000, 6500, 7000, 8000].map(rpm => {
      let nm;
      if (rpm <= peakTqRpm) {
        nm = car.torque * 0.7 + (car.torque * 0.3) * (rpm / peakTqRpm);
      } else if (rpm <= peakHpRpm) {
        const ratio = (rpm - peakTqRpm) / (peakHpRpm - peakTqRpm);
        nm = car.torque - (car.torque - tqAtPeakHp) * ratio;
      } else {
        const ratio = (rpm - peakHpRpm) / (8000 - peakHpRpm);
        nm = tqAtPeakHp * (1 - ratio * 0.3);
      }
      return { rpm, nm };
    });
  }

  const gearRatios  = car.transmission?.gear_ratios  || [3.5, 2.0, 1.4, 1.0, 0.8, 0.6];
  const finalDrive  = car.finalDriveOverride || car.transmission?.final_drive_ratio || 3.5;
  const shiftTime   = car.transmission?.shift_time_ms || (car.transmissionType === 'Auto' ? 100 : 300);
  const eff         = car.transmission?.efficiency_pct || (car.transmissionType === 'Auto' ? 90 : 95);

  // Aerodinamik
  const baseCD  = car.dragCoefficient || 0.30;
  const baseCL  = car.liftCoefficient || 0.05;
  const { totalCd, totalCl } = calcAeroFromMods(car.aeroMods || {}, baseCD, baseCL);

  // Ağırlık — ballast dahil
  const totalWeight = car.weight + (car.ballastFront || 0) + (car.ballastRear || 0);

  // Ön ağırlık dağılımı — ballast ile güncelle
  let weightFrontPct = car.weightDistFrontPct || (car.drivetrain === 'FWD' ? 62 : 50);
  if (car.ballastFront || car.ballastRear) {
    const totalBallast = (car.ballastFront || 0) + (car.ballastRear || 0);
    const extraFront = (car.ballastFront || 0) / (totalWeight + totalBallast) * 100;
    weightFrontPct = ((car.weight * weightFrontPct / 100) + (car.ballastFront || 0)) / totalWeight * 100;
  }

  return {
    raceMode:     raceSettings.mode,
    weightKg:     totalWeight,
    weightDistFrontPct: weightFrontPct,
    drivetrain:   car.drivetrain,
    wheelbaseM:   car.wheelbaseM || 2.6,
    cogHeightM:   car.cogHeightM || 0.50,
    seatHeightM:  car.seatHeightM || 0.35,
    seatPositionPct: car.seatPositionPct || 45,
    driverWeightKg: car.driverWeightKg || 80,
    dragCoefficient: totalCd,
    liftCoefficient: totalCl,
    wingDownforceCl: car.wingDownforceCl || 0,
    frontalAreaM2: car.frontalAreaM2 || 2.2,
    rollingResistanceCoefficient: compound?.rolling_resistance_coeff || 0.012,
    rearTireSize: car.rearTireSize || '225/45R17',
    frontTireSize: car.frontTireSize || car.rearTireSize || '225/45R17',
    tireRadiusM:  rearTireGeo.radiusM,
    redlineRpm:   car.engine?.redline_rpm || 7500,
    idleRpm:      car.engine?.idle_rpm || 800,
    launchRpm:    (car.engine?.idle_rpm || 800) + (car.hasLaunchControl ? 3500 : 2800),
    gearRatios,
    finalDriveRatio: finalDrive,
    shiftTimeMs:  shiftTime,
    efficiencyPct: eff,
    shiftRpmThreshold: car.shiftRpmThreshold || 200,
    differentialType: car.differentialType || 'lsd',
    mu:           finalMu,
    tireCompound: compound,
    hasBurnout:   car.hasBurnout || false,
    temperatureC: raceSettings.temperature || 20,
    altitudeM:    raceSettings.altitude || 0,
    humidityPct:  raceSettings.humidity || 50,
    windSpeedMs:  raceSettings.windSpeedMs || 0,
    inclineDeg:   raceSettings.inclineDeg || 0,
    torqueCurve:  mappedTqCurve,
    nosShot:      car.nosShot || 0,
    nosActivationSpeedKmh: car.nosActivationSpeedKmh || 50,
    topSpeedKmh:  car.hasLimiter !== false ? (car.top_speed_kmh || 350) : null,
    hp:           car.hp,
    // Motor modeli parametreleri
    engineAspiration: car.engine?.aspiration || 'NA',
    maxBoostBar:  car.engine?.max_boost_bar || 0,
    turboLagRpm:  car.engine?.turbo_lag_rpm || 2000,
    fullBoostRpm: car.engine?.boost_threshold_rpm || 3500,
    intercoolerType: car.engine?.intercooler_type || 'none',
    fuelType:     car.fuelType || car.engine?.fuel_type || '95',
    engineMods:   car.engineMods || {},
    engineInertiaKgm2: car.engine?.engine_inertia_kgm2 || 0.25,
    flywheelType: car.flywheelType || 'standard',
    clutchCapacityNm: car.transmission?.max_torque_capacity_nm || 800,
  };
}

export default function MultiLaneCanvas({ cars, raceSettings, onBack }) {
  const canvasRef   = useRef(null);
  const scaleRef    = useRef(true);
  const animIdRef   = useRef(null);

  const [status,         setStatus]         = useState('Yarışa Hazırlanıyor...');
  const [results,        setResults]        = useState(null);
  const [animProgress,   setAnimProgress]   = useState(0);
  const [replayKey,      setReplayKey]      = useState(0);
  const [realisticScale, setRealisticScale] = useState(true);
  const [telemetryIdx,   setTelemetryIdx]   = useState(null);
  const [showSplits,     setShowSplits]     = useState(false);

  useEffect(() => {
    setStatus('Fizik motoru çalışıyor...');

    try {
      const allResults = cars.map((car, index) => {
        const simConfig = buildSimConfig(car, raceSettings);
        const res = simulate(simConfig);
        return { ...res, carInfo: car, laneIndex: index };
      });

      // Sırala
      if (raceSettings.mode === 'Top Speed') {
        allResults.sort((a, b) => b.speed_at_end_kmh - a.speed_at_end_kmh);
      } else {
        allResults.sort((a, b) => a.elapsed_time_s - b.elapsed_time_s);
      }

      setStatus('Animasyon hazırlanıyor...');
      setResults(allResults);
      startAnimation(allResults);
    } catch (err) {
      console.error('Simulation crash:', err);
      setStatus('Simülasyon Hatası: ' + err.message);
    }
  }, [cars, raceSettings, replayKey]);

  // Canvas temizle
  useEffect(() => {
    return () => {
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
    };
  }, []);

  const startAnimation = (allResults) => {
    if (!canvasRef.current) return;
    const ctx    = canvasRef.current.getContext('2d');
    const width  = canvasRef.current.width;
    const height = canvasRef.current.height;

    let maxSimTimeS = 0, minSimTimeS = Infinity;
    allResults.forEach(r => {
      if (r.elapsed_time_s > maxSimTimeS) maxSimTimeS = r.elapsed_time_s;
      if (r.elapsed_time_s < minSimTimeS) minSimTimeS = r.elapsed_time_s;
    });

    const isSpeedMode = !['200m', '400m', '800m'].includes(raceSettings.mode);
    let trackLengthPx = width - 150;
    let targetDist = raceSettings.mode === '200m' ? 200 : raceSettings.mode === '800m' ? 800 : 400;
    let pixelsPerMeter = trackLengthPx / targetDist;

    if (isSpeedMode) {
      let maxDist = 0;
      allResults.forEach(r => {
        const ts = r.time_series;
        const d  = ts.length > 0 ? ts[ts.length - 1].distance : 0;
        if (d > maxDist) maxDist = d;
      });
      pixelsPerMeter = trackLengthPx / Math.max(10, maxDist);
    }

    let startTime = null;

    const draw = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsedMs  = timestamp - startTime;
      const elapsedSimS = elapsedMs / 1000;
      let drawTimeS = Math.min(elapsedSimS, minSimTimeS);

      if (elapsedSimS >= minSimTimeS + 3) {
        setStatus('Yarış Bitti!');
      }

      ctx.clearRect(0, 0, width, height);

      // Arkaplan gradyanı
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#0a0a0a');
      bgGrad.addColorStop(1, '#111111');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Finish line
      if (!isSpeedMode) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(100, 0, 4, height); // Start
        const finishX = 100 + targetDist * pixelsPerMeter;
        // Finish checkered pattern
        for (let y = 0; y < height; y += 12) {
          ctx.fillStyle = (Math.floor(y / 12) % 2 === 0) ? '#ffffff' : '#000000';
          ctx.fillRect(finishX, y, 8, 12);
          ctx.fillStyle = (Math.floor(y / 12) % 2 === 0) ? '#000000' : '#ffffff';
          ctx.fillRect(finishX + 8, y, 8, 12);
        }
      }

      const laneHeight = height / Math.max(1, cars.length);

      allResults.forEach((res) => {
        const laneY = res.laneIndex * laneHeight;
        const ts    = res.time_series;
        const color = CAR_COLORS[res.laneIndex % CAR_COLORS.length];

        // State bul
        let state = ts[ts.length - 1];
        for (let i = 0; i < ts.length; i++) {
          if (ts[i].time >= drawTimeS) { state = ts[i]; break; }
        }

        // Kulvar çizgisi
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, laneY + laneHeight);
        ctx.lineTo(width, laneY + laneHeight);
        ctx.stroke();

        // Kulvar orta çizgisi
        ctx.strokeStyle = '#111';
        ctx.setLineDash([10, 20]);
        ctx.beginPath();
        ctx.moveTo(100, laneY + laneHeight / 2);
        ctx.lineTo(width - 50, laneY + laneHeight / 2);
        ctx.stroke();
        ctx.setLineDash([]);

        const carX = 100 + state.distance * pixelsPerMeter;
        const carY = laneY + laneHeight / 2;

        ctx.save();
        ctx.translate(carX, carY);

        const carRealLengthM = 4.5;
        const carRealWidthM  = 2.0;
        const isRealistic    = scaleRef.current;
        const carLenPx  = isRealistic ? Math.max(20, carRealLengthM * pixelsPerMeter) : 50;
        const carWidthPx = isRealistic ? Math.max(12, carRealWidthM * pixelsPerMeter) : 22;

        // Wheelie efekti
        if (state.wheelie_deg > 2) {
          const wheelieAngleRad = (state.wheelie_deg / 90) * Math.PI * 0.25;
          ctx.rotate(-wheelieAngleRad);
        }

        // Fish-tail (patinaj efekti)
        if (state.slipPct > 8 && state.gear <= 3) {
          const speedDamp = Math.min(state.speed_kmh / 30, 1.0);
          const wobbleAmp = (state.slipPct / 100) * 0.12 * speedDamp;
          ctx.rotate(Math.sin(elapsedSimS * 12) * wobbleAmp);

          // Duman
          ctx.fillStyle = `rgba(200, 200, 200, ${Math.min(state.slipPct / 100, 0.6)})`;
          const smokeX = res.carInfo.drivetrain === 'FWD' ? (carLenPx / 4) : (-carLenPx / 2);
          for (let s = 0; s < 3; s++) {
            ctx.beginPath();
            ctx.arc(smokeX + (Math.random() - 0.5) * 8, (Math.random() - 0.5) * carWidthPx, 8 + Math.random() * 10, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // NOS efekti
        if (res.carInfo.nosShot > 0 && state.speed_kmh > (res.carInfo.nosActivationSpeedKmh || 50)) {
          const nosGrad = ctx.createLinearGradient(-carLenPx / 2 - 30, 0, -carLenPx / 2, 0);
          nosGrad.addColorStop(0, 'rgba(59, 130, 246, 0)');
          nosGrad.addColorStop(1, 'rgba(59, 130, 246, 0.9)');
          ctx.fillStyle = nosGrad;
          ctx.beginPath();
          ctx.moveTo(-carLenPx / 2, -5);
          ctx.lineTo(-carLenPx / 2 - 25 - Math.random() * 15, 0);
          ctx.lineTo(-carLenPx / 2, 5);
          ctx.fill();
        }

        // Araç gövdesi — gradient
        const carGrad = ctx.createLinearGradient(0, -carWidthPx / 2, 0, carWidthPx / 2);
        carGrad.addColorStop(0, color);
        carGrad.addColorStop(0.5, color + 'cc');
        carGrad.addColorStop(1, color + '88');
        ctx.fillStyle = carGrad;
        ctx.beginPath();
        ctx.roundRect(-carLenPx / 2, -carWidthPx / 2, carLenPx, carWidthPx, 3);
        ctx.fill();

        // Cam
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(-carLenPx * 0.05, -carWidthPx * 0.38, carLenPx * 0.28, carWidthPx * 0.76);

        // Tekerlek (basit)
        ctx.fillStyle = '#111';
        [[-carLenPx * 0.35, carWidthPx / 2], [carLenPx * 0.3, carWidthPx / 2],
         [-carLenPx * 0.35, -carWidthPx / 2], [carLenPx * 0.3, -carWidthPx / 2]].forEach(([wx, wy]) => {
          ctx.beginPath();
          ctx.arc(wx, wy, Math.max(2, carWidthPx * 0.18), 0, Math.PI * 2);
          ctx.fill();
        });

        ctx.restore();

        // Araç ismi & telemetri
        const textX = Math.max(110, carX - carLenPx / 2);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillText(res.carInfo.name, textX, carY - 14);

        ctx.font = '10px Inter, sans-serif';
        ctx.fillStyle = color;
        ctx.fillText(`${state.speed_kmh.toFixed(0)} km/h`, textX, carY + 20);

        ctx.fillStyle = '#888';
        ctx.fillText(`${state.rpm.toLocaleString()} RPM • Vites ${state.gear}`, textX + 60, carY + 20);

        if (state.wheelie_deg > 2) {
          ctx.fillStyle = '#f97316';
          ctx.fillText(`🏋️ ${state.wheelie_deg.toFixed(0)}°`, textX + 180, carY + 20);
        }
      });

      // Progress
      setAnimProgress((elapsedSimS / minSimTimeS) * 100);
      animIdRef.current = requestAnimationFrame(draw);
    };

    if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
    animIdRef.current = requestAnimationFrame(draw);
  };

  return (
    <div className="animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-800 transition-colors">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-4">
            <img src="/rs-logo.png" alt="Preditech" className="h-14 object-contain mix-blend-screen" />
            <span className="text-yellow-500">Pist</span>
          </h2>
          <p className="text-gray-400">{status}</p>
        </div>

        {results && (
          <div className="ml-auto flex gap-2 flex-wrap">
            <button
              onClick={() => setShowSplits(!showSplits)}
              className="btn-primary bg-amber-700 text-white hover:bg-amber-600 flex items-center gap-2 text-sm"
            >
              <BarChart2 size={16} /> {showSplits ? 'Animasyon' : 'Split Zamanları'}
            </button>
            <button
              onClick={() => {
                scaleRef.current = !scaleRef.current;
                setRealisticScale(scaleRef.current);
              }}
              className="btn-primary bg-gray-700 text-white hover:bg-gray-600 text-sm flex items-center gap-2"
            >
              {realisticScale ? 'Büyük Görünüm' : 'Gerçek Boyut'}
            </button>
            <button
              onClick={() => {
                setResults(null);
                setAnimProgress(0);
                setShowSplits(false);
                setReplayKey(k => k + 1);
              }}
              className="btn-primary bg-blue-600 text-white hover:bg-blue-500 text-sm flex items-center gap-2"
            >
              <RotateCcw size={16} /> Tekrar
            </button>
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="glass-panel p-4 mb-6 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          width={1000}
          height={Math.max(300, cars.length * 65)}
          className="w-full bg-black rounded-lg border border-gray-800"
        />
        <div className="absolute bottom-0 left-0 h-1 bg-gray-800 w-full">
          <div
            className="h-full bg-gradient-to-r from-red-600 to-yellow-500 transition-all duration-75"
            style={{ width: `${Math.min(100, animProgress)}%` }}
          />
        </div>
      </div>

      {/* Split zamanları paneli */}
      {results && showSplits && (
        <div className="mb-6 animate-in slide-in-from-bottom-4">
          <SplitTimesPanel results={results} raceMode={raceSettings.mode} />
        </div>
      )}

      {/* Sonuç tablosu */}
      {results && (
        <div className="glass-panel p-6 animate-in slide-in-from-bottom-8">
          <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Trophy className="text-yellow-500" /> Yarış Sonuçları ({raceSettings.mode})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wide">
                  <th className="pb-3 pl-4">Sıra</th>
                  <th className="pb-3">Araç</th>
                  <th className="pb-3">Süre</th>
                  <th className="pb-3">Fark</th>
                  <th className="pb-3">Trap Hızı</th>
                  <th className="pb-3">60ft</th>
                  <th className="pb-3">Patinaj</th>
                  <th className="pb-3">Maks G</th>
                  <th className="pb-3 pr-2">Telemetri</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => {
                  const winnerTime = results[0].elapsed_time_s;
                  const gapS = i > 0 && raceSettings.mode !== 'Top Speed'
                    ? `+${(r.elapsed_time_s - winnerTime).toFixed(3)}s`
                    : '—';
                  const color = CAR_COLORS[r.laneIndex % CAR_COLORS.length];

                  return (
                    <tr key={i} className={`border-b border-gray-800/50 hover:bg-white/5 transition-colors ${i === 0 ? 'bg-yellow-900/10' : ''}`}>
                      <td className="py-4 pl-4 font-bold text-xl text-gray-500">
                        {i === 0 ? '🏆' : `#${i + 1}`}
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                          <div>
                            <div className="font-bold text-white">{r.carInfo.name}</div>
                            <div className="text-xs text-gray-500">
                              {r.carInfo.hp} HP / {r.carInfo.weight} kg
                              {r.carInfo.nosShot > 0 && <span className="text-blue-400 ml-1">(+{r.carInfo.nosShot} NOS)</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={`py-4 font-mono font-black ${raceSettings.mode !== 'Top Speed' ? 'text-amber-400 text-xl' : 'text-gray-400'}`}>
                        {r.elapsed_time_s.toFixed(3)}s
                      </td>
                      <td className="py-4 font-mono text-red-400 text-sm">{gapS}</td>
                      <td className={`py-4 font-mono ${raceSettings.mode === 'Top Speed' ? 'text-amber-400 text-xl font-bold' : 'text-gray-300'}`}>
                        {r.speed_at_end_kmh.toFixed(1)} km/h
                      </td>
                      <td className="py-4 font-mono text-xs text-gray-400">
                        {r.split_60ft_s > 0 ? `${r.split_60ft_s.toFixed(3)}s` : '—'}
                      </td>
                      <td className="py-4 text-xs">
                        <span className={r.total_slip_time_s > 0.5 ? 'text-red-400' : 'text-green-400'}>
                          {r.total_slip_time_s.toFixed(2)}s
                        </span>
                        {r.had_wheelie && <span className="ml-1 text-orange-400">🏋️</span>}
                      </td>
                      <td className="py-4 text-xs text-purple-400 font-mono">
                        {r.peak_g_force?.toFixed(2) || '—'}g
                      </td>
                      <td className="py-4 pr-2">
                        <button
                          onClick={() => setTelemetryIdx(i)}
                          className="p-1.5 rounded-lg bg-purple-900/30 border border-purple-700/50 text-purple-400 hover:bg-purple-800/40 transition-colors"
                          title="Telemetri Grafiği"
                        >
                          <Activity size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Telemetri modal */}
      {telemetryIdx !== null && results && (
        <TelemetryModal
          result={results[telemetryIdx]}
          carName={results[telemetryIdx].carInfo.name}
          raceMode={raceSettings.mode}
          onClose={() => setTelemetryIdx(null)}
        />
      )}
    </div>
  );
}
