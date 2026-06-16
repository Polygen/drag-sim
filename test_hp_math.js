import fs from 'fs';
const engines = JSON.parse(fs.readFileSync('./src/data/engines.json', 'utf-8'));
let hpTorqueMismatches = 0;
engines.forEach(e => {
    let mathMismatch = false;
    for (let i = 0; i < e.power_curve_rpm_points.length; i++) {
        const pPoint = e.power_curve_rpm_points[i];
        const tPoint = e.torque_curve_rpm_points[i];
        
        if (pPoint.rpm !== tPoint.rpm) continue;
        
        // HP = (Torque * RPM) / 7120.9
        const expectedHp = (tPoint.nm * tPoint.rpm) / 7120.9;
        
        if (Math.abs(pPoint.hp - expectedHp) > expectedHp * 0.1 && expectedHp > 10) {
            mathMismatch = true;
            break;
        }
    }
    
    if (mathMismatch) {
        hpTorqueMismatches++;
        console.log(`Engine ${e.engine_code} HP/Torque math doesn't align!`);
    }
});
console.log('Total internal math mismatches:', hpTorqueMismatches);
