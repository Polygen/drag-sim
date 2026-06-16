import React, { useState } from 'react';
import { X, Play, Activity, TrendingUp, AlertTriangle, Trophy } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { runOptimization } from '../physics/optimizer';
import { runGearAndLaunchOptimization } from '../physics/launchAndGearOptimizer';
import { runPowerWeightAnalysis } from '../physics/powerWeightAnalyzer';

export default function SetupOptimizer({ carConfig, onClose, onTestSetup }) {
  const [mode, setMode] = useState('400m');
  const [maxHpLimit, setMaxHpLimit] = useState(2000);
  const [maxTqLimit, setMaxTqLimit] = useState(2000);
  const [maxRpm, setMaxRpm] = useState(carConfig.engine?.redline_rpm || 7500);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [showSensible, setShowSensible] = useState(true);
  const [testTire, setTestTire] = useState('street');

  const [activeTab, setActiveTab] = useState('hp_tq');
  const [isGearRunning, setIsGearRunning] = useState(false);
  const [gearProgress, setGearProgress] = useState(0);
  const [gearResults, setGearResults] = useState(null);
  const [gearSurface, setGearSurface] = useState('vht');
  const [gearTire, setGearTire] = useState('slick');

  const [pwRunning, setPwRunning] = useState(false);
  const [pwResults, setPwResults] = useState(null);
  const [pwHpAdd, setPwHpAdd] = useState(200);
  const [pwWeightDrop, setPwWeightDrop] = useState(150);

  const handleRun = async () => {
    setIsRunning(true);
    setProgress(0);
    setResults(null);
    
    // Yüzlerce iterasyon asenkron çalışacağı için Promise.resolve veya timeout ile render şansı veriyoruz.
    // Ancak optimizer içindeki yieldToMain sayesinde UI kilitlenmeyecektir.
    try {
      const optResults = await runOptimization(carConfig, mode, maxHpLimit, maxTqLimit, maxRpm, (p) => {
        setProgress(Math.round(p * 100));
      });
      setResults(optResults);
    } catch (e) {
      console.error(e);
      alert("Optimizasyon sırasında hata: " + e.message);
    }
    
    setIsRunning(false);
    setProgress(100);
  };

  const handleGearRun = async () => {
    setIsGearRunning(true);
    setGearProgress(0);
    setGearResults(null);
    try {
      const res = await runGearAndLaunchOptimization(carConfig, mode, gearSurface, gearTire, (p) => {
        setGearProgress(Math.round(p * 100));
      });
      setGearResults(res);
    } catch (e) {
      console.error(e);
      alert("Analiz hatası: " + e.message);
    }
    setIsGearRunning(false);
    setGearProgress(100);
  };

  const handlePwRun = async () => {
    setPwRunning(true);
    setPwResults(null);
    try {
      // Tork artışını HP'nin %75'i olarak kabaca belirliyoruz
      const res = await runPowerWeightAnalysis(carConfig, mode, gearSurface, gearTire, pwHpAdd, Math.round(pwHpAdd * 0.75), pwWeightDrop);
      setPwResults(res);
    } catch (e) {
      console.error(e);
      alert("Analiz hatası: " + e.message);
    }
    setPwRunning(false);
  };

  const renderResultCard = (surfaceData, surfaceId) => {
    if (!surfaceData || !surfaceData.bestSetup) return null;
    
    const best = surfaceData.bestSetup;
    const sensible = surfaceData.sensibleSetup;
    
    const displaySetup = (showSensible && sensible) ? sensible : best;
    const isSensibleUsed = (showSensible && sensible);

    return (
      <div className="glass-panel p-4 mb-4 border-l-4 border-l-red-500">
        <h3 className="text-xl font-bold text-white mb-4">{surfaceData.surfaceName} Sonuçları</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className={`p-4 rounded border ${isSensibleUsed ? 'bg-gray-800/30 border-gray-700' : 'bg-red-900/20 border-red-800'}`}>
            <div className="text-sm text-gray-400 mb-1">Mutlak En İyi Setup</div>
            <div className="text-2xl font-bold text-white mb-2">{best.time.toFixed(3)}s</div>
            <div className="text-sm text-gray-300">
              <span className="text-red-400 font-bold">{best.hp} HP</span> / <span className="text-orange-400">{best.tq} Nm</span>
            </div>
            <div className="text-sm text-gray-300 mt-1">Lastik: <span className="text-amber-400">{best.tire}</span></div>
            <div className="text-xs text-gray-500 mt-1">Patinaj: {best.slip.toFixed(2)}s</div>
          </div>
          
          {sensible && (
            <div className={`p-4 rounded border ${isSensibleUsed ? 'bg-green-900/20 border-green-800' : 'bg-gray-800/30 border-gray-700'}`}>
              <div className="text-sm text-green-400 mb-1 font-bold flex items-center gap-1">
                <AlertTriangle size={14} /> Mantıklı Setup Önerisi
              </div>
              <div className="text-2xl font-bold text-white mb-2">{sensible.time.toFixed(3)}s</div>
              <div className="text-sm text-gray-300">
                <span className="text-red-400 font-bold">{sensible.hp} HP</span> / <span className="text-orange-400">{sensible.tq} Nm</span>
              </div>
              <div className="text-sm text-gray-300 mt-1">Lastik: <span className="text-amber-400">{sensible.tire}</span></div>
              <div className="text-xs text-green-500 mt-1">
                {- (best.hp - sensible.hp)} HP tasarruf (+{(sensible.time - best.time).toFixed(3)}s fark)
              </div>
            </div>
          )}
        </div>

        <div className="h-72 mt-6">
          <h4 className="text-sm font-bold text-gray-400 mb-2">
            Performans Eğrisi (Zaman vs Beygir Gücü)
          </h4>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={surfaceData.data}
              margin={{ top: 15, right: 10, left: -20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis 
                dataKey="hp" 
                stroke="#666" 
                tick={{fill: '#aaa', fontSize: 12}} 
                label={{ value: 'Motor Gücü (HP)', position: 'insideBottomRight', offset: -10, fill: '#666' }} 
              />
              <YAxis 
                stroke="#666" 
                tick={{fill: '#aaa', fontSize: 12}} 
                domain={['auto', 'auto']}
              />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-[#111] border border-[#333] p-3 rounded shadow-lg">
                        <p className="text-gray-300 font-bold border-b border-gray-700 pb-2 mb-2">{label} HP</p>
                        {payload.map((entry, index) => {
                          const tqVal = entry.payload[`${entry.dataKey}_tq`];
                          return (
                            <div key={index} style={{ color: entry.color }} className="flex justify-between items-center gap-4 py-1 text-sm">
                              <span className="font-medium">{entry.name}:</span>
                              <span>
                                {entry.value.toFixed(3)}s 
                                {tqVal && <span className="text-gray-400 text-xs ml-2">({tqVal} Nm)</span>}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend wrapperStyle={{ paddingTop: '10px', paddingBottom: '10px' }} />
              
              {/* Mantıklı Nokta Çizgisi */}
              {sensible && (
                <ReferenceLine 
                  x={sensible.hp} 
                  stroke="#22c55e" 
                  strokeDasharray="3 3" 
                  label={{ position: 'insideTopLeft', value: 'Düzleşme Noktası', fill: '#22c55e', fontSize: 12, offset: 10 }} 
                />
              )}

              {/* Süre Çizgileri */}
              <Line type="monotone" dataKey="Slick" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Semi-Slick" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Street" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {onTestSetup && (
          <div className="flex flex-col gap-3 w-full mt-6 bg-gray-800/30 p-4 rounded-lg border border-gray-700">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-gray-300">Orijinal (Mevcut) Araç Lastiği:</span>
              <select 
                className="bg-black border border-gray-600 rounded px-3 py-1 text-white text-sm focus:outline-none focus:border-red-500 transition-colors"
                value={testTire}
                onChange={e => setTestTire(e.target.value)}
              >
                <option value="street">Sokak (Street)</option>
                <option value="semi_slick">Yarı Slick</option>
                <option value="slick">Tam Slick</option>
              </select>
            </div>
            <div className="flex gap-2 w-full">
              {sensible && (
                <button
                  onClick={() => {
                    const car1 = { ...carConfig, name: carConfig.name + ' (Mevcut Setup)', overrideTire: testTire };
                    const car2 = { 
                      ...carConfig, 
                      name: carConfig.name + ' (Mantıklı)',
                      hp: sensible.hp,
                      torque: sensible.tq,
                      overrideTire: sensible.tire.toLowerCase().replace('-', '_'),
                      engine: { ...carConfig.engine, stock_hp_at_rpm: undefined, stock_torque_nm_at_rpm: undefined }
                    };
                    onTestSetup(car1, car2, { mode: mode, tire: sensible.tire.toLowerCase().replace('-', '_'), surface: surfaceId });
                  }}
                  className="btn-primary flex-1 bg-green-600 hover:bg-green-500 text-white flex items-center justify-center gap-2"
                >
                  <Play size={18} /> Mantıklı Setup Test Et
                </button>
              )}
              <button
                onClick={() => {
                  const car1 = { ...carConfig, name: carConfig.name + ' (Mevcut Setup)', overrideTire: testTire };
                  const car2 = { 
                    ...carConfig, 
                    name: carConfig.name + ' (Mutlak En İyi)',
                    hp: best.hp,
                    torque: best.tq,
                    overrideTire: best.tire.toLowerCase().replace('-', '_'),
                    engine: { ...carConfig.engine, stock_hp_at_rpm: undefined, stock_torque_nm_at_rpm: undefined }
                  };
                  onTestSetup(car1, car2, { mode: mode, tire: best.tire.toLowerCase().replace('-', '_'), surface: surfaceId });
                }}
                className="btn-primary flex-1 bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-2"
              >
                <Play size={18} /> Mutlak Setup Test Et
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#111111] bg-gradient-to-br from-[#1a1a1a] to-[#000000] border border-gray-700 rounded-xl w-full max-w-4xl my-8 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-black/50 shrink-0">
          <h3 className="text-xl font-bold flex items-center gap-2 text-white">
            <Activity className="text-red-500" /> Setup Analiz ve Optimizasyon
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex border-b border-gray-800 bg-black/30 shrink-0">
          <button 
            className={`flex-1 py-3 font-bold transition-colors ${activeTab === 'hp_tq' ? 'text-red-500 border-b-2 border-red-500 bg-red-900/10' : 'text-gray-500 hover:text-gray-300'}`} 
            onClick={() => setActiveTab('hp_tq')}
          >
            Motor Gücü (HP / Tork)
          </button>
          <button 
            className={`flex-1 py-3 font-bold transition-colors ${activeTab === 'gear_launch' ? 'text-red-500 border-b-2 border-red-500 bg-red-900/10' : 'text-gray-500 hover:text-gray-300'}`} 
            onClick={() => setActiveTab('gear_launch')}
          >
            Şanzıman ve Kalkış (Final Drive / RPM)
          </button>
          <button 
            className={`flex-1 py-3 font-bold transition-colors ${activeTab === 'power_weight' ? 'text-red-500 border-b-2 border-red-500 bg-red-900/10' : 'text-gray-500 hover:text-gray-300'}`} 
            onClick={() => setActiveTab('power_weight')}
          >
            Güç mü, Ağırlık mı? (Strateji)
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto grow">
          {activeTab === 'hp_tq' ? (
            <>
              <div className="mb-6 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-900/50 p-4 rounded-lg border border-gray-800">
            <div>
              <div className="text-gray-400 text-sm">Seçili Araç</div>
              <div className="text-xl font-bold text-white">{carConfig.name} ({carConfig.weight} kg, {carConfig.drivetrain})</div>
            </div>
            
            <div className="flex gap-4 items-center w-full md:w-auto">
              <select 
                className="bg-black border border-gray-700 rounded p-2 text-white focus:outline-none flex-1 md:flex-none"
                value={mode}
                onChange={e => setMode(e.target.value)}
                disabled={isRunning}
              >
                <option value="400m">400 Metre Drag</option>
                <option value="800m">800 Metre Drag</option>
                <option value="0-100">0-100 km/h</option>
                <option value="100-200">100-200 km/h</option>
              </select>

              <div className="flex gap-2">
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Max HP</label>
                  <input 
                    type="number" 
                    className="bg-black border border-gray-700 rounded p-2 text-white w-20 focus:outline-none"
                    value={maxHpLimit}
                    onChange={e => setMaxHpLimit(Number(e.target.value))}
                    disabled={isRunning}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Max Tork</label>
                  <input 
                    type="number" 
                    className="bg-black border border-gray-700 rounded p-2 text-white w-20 focus:outline-none"
                    value={maxTqLimit}
                    onChange={e => setMaxTqLimit(Number(e.target.value))}
                    disabled={isRunning}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Max Devir (RPM)</label>
                  <input 
                    type="number" 
                    step="500"
                    className="bg-black border border-gray-700 rounded p-2 text-white w-24 focus:outline-none"
                    value={maxRpm}
                    onChange={e => setMaxRpm(Number(e.target.value))}
                    disabled={isRunning}
                  />
                </div>
              </div>
              
              <button
                onClick={handleRun}
                disabled={isRunning}
                className="btn-primary bg-red-600 text-white hover:bg-red-500 px-6 py-2 rounded font-bold flex items-center gap-2 disabled:opacity-50"
              >
                {isRunning ? (
                  <>Analiz Ediliyor... %{progress}</>
                ) : (
                  <><Play size={18} /> Optimizasyonu Başlat</>
                )}
              </button>
            </div>
          </div>

          {isRunning && (
            <div className="mb-8">
              <div className="flex justify-between text-sm text-gray-400 mb-2">
                <span>Fizik motoru tüm olasılıkları deniyor...</span>
                <span>%{progress}</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div className="bg-red-600 h-2 rounded-full transition-all duration-300" style={{width: `${progress}%`}}></div>
              </div>
            </div>
          )}

          {results && (
            <div className="animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center gap-2 mb-4 bg-gray-800/30 p-3 rounded border border-gray-700">
                <input 
                  type="checkbox" 
                  id="sensibleToggle"
                  checked={showSensible} 
                  onChange={(e) => setShowSensible(e.target.checked)}
                  className="w-4 h-4 text-red-600 bg-black border-gray-700 rounded focus:ring-red-500"
                />
                <label htmlFor="sensibleToggle" className="text-sm font-medium text-gray-300 cursor-pointer">
                  "Mantıklı Setup" önerisini varsayılan olarak göster
                </label>
                <span className="text-xs text-gray-500 ml-auto hidden sm:block">Bu ayar, maksimum gücün sadece minik bir getiri sağladığı durumlarda daha düşük güç önerir.</span>
              </div>

              {Object.keys(results).map(key => (
                <div key={key}>
                  {renderResultCard(results[key], key)}
                </div>
              ))}
            </div>
          )}

          {!isRunning && !results && (
            <div className="text-center p-12 border-2 border-dashed border-gray-800 rounded-lg">
              <TrendingUp size={48} className="mx-auto text-gray-600 mb-4" />
              <p className="text-gray-400">Bu aracın seçili metrik için en kısa süreyi vereceği HP ve Tork kombinasyonunu bulmak için optimizasyonu başlatın.</p>
              <p className="text-gray-500 text-sm mt-2">Bu işlem binlerce farklı kombinasyonu test edecektir.</p>
            </div>
          )}
            </>
          ) : activeTab === 'gear_launch' ? (
            <>
              <div className="mb-6 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-900/50 p-4 rounded-lg border border-gray-800">
                <div>
                  <div className="text-gray-400 text-sm">Seçili Araç</div>
                  <div className="text-xl font-bold text-white">{carConfig.name} ({carConfig.hp} HP, {carConfig.torque} Nm)</div>
                </div>
                
                <div className="flex gap-4 items-center w-full md:w-auto">
                  <select 
                    className="bg-black border border-gray-700 rounded p-2 text-white focus:outline-none"
                    value={mode}
                    onChange={e => setMode(e.target.value)}
                    disabled={isGearRunning}
                  >
                    <option value="400m">400 Metre Drag</option>
                    <option value="800m">800 Metre Drag</option>
                    <option value="0-100">0-100 km/h</option>
                  </select>
                  <select 
                    className="bg-black border border-gray-700 rounded p-2 text-white focus:outline-none"
                    value={gearSurface}
                    onChange={e => setGearSurface(e.target.value)}
                    disabled={isGearRunning}
                  >
                    <option value="vht">VHT (Drag Pisti)</option>
                    <option value="good_asphalt">Kaliteli Asfalt</option>
                    <option value="turkey_asphalt">Türkiye Asfaltı</option>
                  </select>
                  <select 
                    className="bg-black border border-gray-700 rounded p-2 text-white focus:outline-none"
                    value={gearTire}
                    onChange={e => setGearTire(e.target.value)}
                    disabled={isGearRunning}
                  >
                    <option value="slick">Slick</option>
                    <option value="semi_slick">Semi-Slick</option>
                    <option value="street">Street</option>
                  </select>
                  
                  <button
                    onClick={handleGearRun}
                    disabled={isGearRunning}
                    className="btn-primary bg-blue-600 text-white hover:bg-blue-500 px-6 py-2 rounded font-bold flex items-center gap-2 disabled:opacity-50"
                  >
                    {isGearRunning ? `Analiz... %${gearProgress}` : <><Play size={18} /> Analizi Başlat</>}
                  </button>
                </div>
              </div>

              {isGearRunning && (
                <div className="mb-8">
                  <div className="flex justify-between text-sm text-gray-400 mb-2">
                    <span>Dişli Oranları ve Kalkış Devirleri Taranıyor...</span>
                    <span>%{gearProgress}</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{width: `${gearProgress}%`}}></div>
                  </div>
                </div>
              )}

              {gearResults && gearResults.optimized && (
                <div className="animate-in fade-in slide-in-from-bottom-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass-panel p-6 border-l-4 border-l-gray-500">
                      <h3 className="text-xl font-bold text-white mb-4">Mevcut Durum</h3>
                      <div className="text-3xl font-bold text-gray-300 mb-2">{gearResults.base.time.toFixed(3)}s</div>
                      <div className="space-y-2 text-gray-400">
                        <div>Kalkış Devri: <span className="text-white">{gearResults.base.launchRpm.toFixed(0)} RPM</span></div>
                        <div>Son Dişli (Final Drive): <span className="text-white">{gearResults.base.finalDrive.toFixed(2)}</span></div>
                        <div>Bitiş Çizgisi: <span className="text-amber-400">{gearResults.base.finishGear}. Vites ({gearResults.base.finishRpm.toFixed(0)} RPM)</span></div>
                      </div>
                      {gearResults.base.finishRpm > carConfig.engine?.redline_rpm - 200 && (
                        <div className="mt-4 text-xs text-red-400 bg-red-900/20 p-2 rounded border border-red-800/50">
                          UYARI: Bitiş çizgisinde devir kesiciye giriyorsun! Vites oranları çok kısa kalıyor.
                        </div>
                      )}
                    </div>

                    <div className="glass-panel p-6 border-l-4 border-l-blue-500 bg-blue-900/10">
                      <h3 className="text-xl font-bold text-white mb-4">Önerilen Setup</h3>
                      <div className="text-3xl font-bold text-blue-400 mb-2">{gearResults.optimized.time.toFixed(3)}s</div>
                      <div className="space-y-2 text-gray-400">
                        <div>En İyi Kalkış Devri: <span className="text-white font-bold">{gearResults.optimized.launchRpm.toFixed(0)} RPM</span></div>
                        <div>Önerilen Final Drive: <span className="text-white font-bold">{gearResults.optimized.finalDrive.toFixed(2)}</span></div>
                        <div>Bitiş Çizgisi: <span className="text-blue-300">{gearResults.optimized.finishGear}. Vites ({gearResults.optimized.finishRpm.toFixed(0)} RPM)</span></div>
                      </div>
                      <div className="mt-4 text-sm text-green-400 font-bold bg-green-900/20 p-2 rounded border border-green-800/50">
                        Kazanım: {(gearResults.base.time - gearResults.optimized.time).toFixed(3)} Saniye!
                      </div>
                    </div>
                  </div>

                  {onTestSetup && (
                    <div className="mt-6 flex justify-end">
                      <button
                        onClick={() => {
                          const car1 = { ...carConfig, name: carConfig.name + ' (Mevcut Dişli)', overrideTire: gearTire };
                          const car2 = { 
                            ...carConfig, 
                            name: carConfig.name + ' (Önerilen Dişli)',
                            overrideTire: gearTire,
                            transmission: {
                               ...carConfig.transmission,
                               final_drive_ratio: gearResults.optimized.finalDrive
                            },
                            engine: {
                               ...carConfig.engine,
                               idle_rpm: 800
                            },
                            launchRpm: gearResults.optimized.launchRpm // Özel olarak bu setup için
                          };
                          // Canvas'ın bunu anlaması için launchRpm modifiyesini simulation algılamalı.
                          // Biz car2'ye config ekleyebilir miyiz? car config içinde launchRpm olursa simulation.js alacak mı bakalım
                          onTestSetup(car1, car2, { mode: mode, tire: gearTire, surface: gearSurface });
                        }}
                        className="btn-primary bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-2 px-8 py-3"
                      >
                        <Play size={20} /> Vites Önerisini Test Et
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : activeTab === 'power_weight' ? (
            <>
              <div className="mb-6 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-900/50 p-4 rounded-lg border border-gray-800">
                <div>
                  <div className="text-gray-400 text-sm">Seçili Araç</div>
                  <div className="text-xl font-bold text-white">{carConfig.name}</div>
                  <div className="text-sm text-gray-500">{carConfig.hp} HP / {carConfig.weight} kg</div>
                </div>
                
                <div className="flex gap-4 items-center w-full md:w-auto">
                  <div className="flex flex-col">
                    <label className="text-xs text-green-400 mb-1">Eklenecek Güç (HP)</label>
                    <input 
                      type="number" 
                      className="bg-black border border-green-900/50 rounded p-2 text-white w-24 focus:outline-none focus:border-green-500"
                      value={pwHpAdd}
                      onChange={e => setPwHpAdd(Number(e.target.value))}
                      disabled={pwRunning}
                    />
                  </div>
                  <div className="text-gray-500 font-bold mt-4">VS</div>
                  <div className="flex flex-col">
                    <label className="text-xs text-blue-400 mb-1">Atılacak Ağırlık (kg)</label>
                    <input 
                      type="number" 
                      className="bg-black border border-blue-900/50 rounded p-2 text-white w-24 focus:outline-none focus:border-blue-500"
                      value={pwWeightDrop}
                      onChange={e => setPwWeightDrop(Number(e.target.value))}
                      disabled={pwRunning}
                    />
                  </div>
                  
                  <button
                    onClick={handlePwRun}
                    disabled={pwRunning}
                    className="btn-primary bg-purple-600 text-white hover:bg-purple-500 px-6 py-2 rounded font-bold flex items-center gap-2 mt-4 disabled:opacity-50"
                  >
                    {pwRunning ? "Karşılaştırılıyor..." : <><Activity size={18} /> Karşılaştır</>}
                  </button>
                </div>
              </div>

              {pwResults && (
                <div className="animate-in fade-in slide-in-from-bottom-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    {/* BASE */}
                    <div className="glass-panel p-4 border-t-4 border-t-gray-600 opacity-70">
                      <div className="text-sm text-gray-400 mb-1">Şu Anki Durum</div>
                      <div className="text-2xl font-bold text-white mb-2">{pwResults.base.time.toFixed(3)}s</div>
                      <div className="text-xs text-gray-500 mb-1">Bitiş Hızı: {pwResults.base.speed.toFixed(1)} km/h</div>
                      <div className="text-xs text-gray-500 mb-1">Kalkış (60ft): {pwResults.base.split60.toFixed(3)}s</div>
                      <div className="text-xs text-red-500/70">Patinaj: {pwResults.base.slip.toFixed(2)}s</div>
                    </div>

                    {/* POWER */}
                    <div className="glass-panel p-4 border-t-4 border-t-green-500 bg-green-900/5">
                      <div className="text-sm text-green-400 font-bold mb-1">+{pwHpAdd} HP Eklersen</div>
                      <div className="text-3xl font-bold text-white mb-2">{pwResults.powerAdded.time.toFixed(3)}s</div>
                      <div className="text-xs text-gray-400 mb-1">Yeni Güç: {pwResults.powerAdded.hp} HP / {pwResults.powerAdded.weight} kg</div>
                      <div className="text-xs text-gray-400 mb-1">Bitiş Hızı: <span className="text-green-300">{pwResults.powerAdded.speed.toFixed(1)} km/h</span></div>
                      <div className="text-xs text-gray-400 mb-1">Kalkış (60ft): {pwResults.powerAdded.split60.toFixed(3)}s</div>
                      <div className="text-xs text-red-400">Patinaj: {pwResults.powerAdded.slip.toFixed(2)}s</div>
                    </div>

                    {/* WEIGHT */}
                    <div className="glass-panel p-4 border-t-4 border-t-blue-500 bg-blue-900/5">
                      <div className="text-sm text-blue-400 font-bold mb-1">-{pwWeightDrop} kg Hafifletirsen</div>
                      <div className="text-3xl font-bold text-white mb-2">{pwResults.weightReduced.time.toFixed(3)}s</div>
                      <div className="text-xs text-gray-400 mb-1">Yeni Güç: {pwResults.weightReduced.hp} HP / {pwResults.weightReduced.weight} kg</div>
                      <div className="text-xs text-gray-400 mb-1">Bitiş Hızı: {pwResults.weightReduced.speed.toFixed(1)} km/h</div>
                      <div className="text-xs text-gray-400 mb-1">Kalkış (60ft): <span className="text-blue-300">{pwResults.weightReduced.split60.toFixed(3)}s</span></div>
                      <div className="text-xs text-red-400">Patinaj: {pwResults.weightReduced.slip.toFixed(2)}s</div>
                    </div>
                  </div>

                  <div className="glass-panel p-6 bg-purple-900/10 border border-purple-500/30">
                    <h3 className="text-xl font-bold text-purple-400 mb-3 flex items-center gap-2">
                      <Trophy size={20} /> Karar Motoru
                    </h3>
                    <p className="text-gray-300 text-lg">
                      {pwResults.weightReduced.time < pwResults.powerAdded.time ? (
                        <>
                          <span className="font-bold text-blue-400">AĞIRLIK ATMAK</span> senin için daha mantıklı! Arabaya {pwHpAdd} HP eklemek sana <span className="text-red-400">{(pwResults.base.time - pwResults.powerAdded.time).toFixed(3)}s</span> kazandırırken, {pwWeightDrop} kg hafifletmek kalkış ivmesini inanılmaz artırdığı için sana <span className="text-green-400">{(pwResults.base.time - pwResults.weightReduced.time).toFixed(3)}s</span> kazandırıyor!
                        </>
                      ) : (
                        <>
                          <span className="font-bold text-green-400">GÜÇ EKLEMEK</span> senin için daha mantıklı! {pwWeightDrop} kg hafifletmek sana {(pwResults.base.time - pwResults.weightReduced.time).toFixed(3)}s kazandırırken, {pwHpAdd} HP güç yüklemesi yapmak özellikle yüksek hızlarda daha çok işe yarıyor ve sana <span className="text-green-400">{(pwResults.base.time - pwResults.powerAdded.time).toFixed(3)}s</span> kazandırıyor!
                        </>
                      )}
                    </p>
                    
                    {(pwResults.powerAdded.slip > pwResults.weightReduced.slip + 0.1) && (
                      <p className="mt-3 text-sm text-yellow-500 border-t border-yellow-900/30 pt-3">
                        <AlertTriangle size={14} className="inline mr-1" /> Not: Güç eklediğinde patinaj süren ciddi şekilde artıyor ({pwResults.powerAdded.slip.toFixed(2)}s). Beygirleri yola aktaramıyorsun, lastiklerini güçlendirmen veya Boost by Gear (Vites Güç Limiti) kullanman şart. Ağırlık atmanın en güzel yanı patinajı artırmamasıdır!
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
