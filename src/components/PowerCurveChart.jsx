import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function PowerCurveChart({ powerCurve, torqueCurve }) {
  if (!powerCurve || !torqueCurve || powerCurve.length === 0) return null;

  // powerCurve: [{rpm: 1000, hp: 100}, ...]
  // torqueCurve: [{rpm: 1000, nm: 200}, ...]
  // İki diziyi rpm üzerinden birleştiriyoruz
  const mergedData = powerCurve.map((pc, idx) => ({
    rpm: pc.rpm,
    hp: pc.hp,
    nm: torqueCurve[idx]?.nm || 0
  }));

  return (
    <div className="h-64 w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={mergedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="rpm" stroke="#888" tick={{fill: '#888', fontSize: 12}} />
          <YAxis yAxisId="left" stroke="#3b82f6" tick={{fontSize: 12}} />
          <YAxis yAxisId="right" orientation="right" stroke="#ef4444" tick={{fontSize: 12}} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#111', borderColor: '#333' }}
            itemStyle={{ color: '#fff' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line yAxisId="left" type="monotone" dataKey="hp" name="Beygir Gücü (HP)" stroke="#3b82f6" strokeWidth={2} dot={false} />
          <Line yAxisId="right" type="monotone" dataKey="nm" name="Tork (Nm)" stroke="#ef4444" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
