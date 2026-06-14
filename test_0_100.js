import fs from 'fs';
import { simulate } from './src/physics/simulation.js';

const vehicles = JSON.parse(fs.readFileSync('./src/data/vehicles.json', 'utf-8'));
const engines = JSON.parse(fs.readFileSync('./src/data/engines.json', 'utf-8'));
const transmissions = JSON.parse(fs.readFileSync('./src/data/transmissions.json', 'utf-8'));

vehicles.forEach(car => {
    const engine = engines.find(e => e.engine_code === car.stock_engine_code);
    const transmission = transmissions.find(t => t.transmission_code === car.stock_transmission);

    const simConfig = {
        weightKg: car.curb_weight_kg,
        weightDistFrontPct: car.weight_distribution_front_pct,
        drivetrain: car.drivetrain_stock,
        wheelbaseM: car.wheelbase_mm / 1000,
        cogHeightM: 0.5,
        dragCoefficient: car.aero_drag_coefficient,
        frontalAreaM2: car.frontal_area_m2,
        rollingResistanceCoefficient: 0.012,
        tireRadiusM: 0.32,
        redlineRpm: engine.redline_rpm,
        idleRpm: engine.idle_rpm,
        launchRpm: engine.idle_rpm + 2000,
        gearRatios: transmission.gear_ratios,
        finalDriveRatio: transmission.final_drive_ratio,
        shiftTimeMs: transmission.shift_time_ms,
        efficiencyPct: transmission.efficiency_pct,
        mu: 1.0,
        tractionFactor: 0.8,
        airDensity: 1.225,
        torqueCurve: engine.torque_curve_rpm_points,
        topSpeedKmh: car.top_speed_kmh,
        raceMode: '0-100'
    };

    const res = simulate(simConfig);
    const maxHp = Math.max(...engine.power_curve_rpm_points.map(p => p.hp));
    const powerToWeight = maxHp / (car.curb_weight_kg / 1000);
    
    console.log(`${car.make} ${car.model}: ${res.elapsed_time_s}s (P/W: ${powerToWeight.toFixed(1)} hp/ton)`);
});
