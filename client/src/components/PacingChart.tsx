import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { formatCurrency } from "../lib/utils";

interface PacingDataPoint {
  label: string;
  amount: number;
}

interface Props {
  data: PacingDataPoint[];
  budgetPerPeriod?: number;
  height?: number;
}

export function PacingChart({ data, budgetPerPeriod, height = 140 }: Props) {
  if (data.length === 0) return null;

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ left: 0, right: 0, top: 5, bottom: 5 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: "#a8a29e" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide />
          <Tooltip
            formatter={(value) => formatCurrency(Number(value))}
            contentStyle={{ fontSize: 12, border: "1px solid #e7e5e4", borderRadius: 8, boxShadow: "none" }}
          />
          <Bar dataKey="amount" fill="#57534e" radius={[3, 3, 0, 0]} />
          {budgetPerPeriod && (
            <ReferenceLine
              y={budgetPerPeriod}
              stroke="#d6d3d1"
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
