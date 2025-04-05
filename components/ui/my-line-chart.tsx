"use client"

import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis, Area, AreaChart } from "recharts"
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart" 
// ^ Provided by ShadCN if you did `npx shadcn add chart`

interface MyLineChartProps {
  data: { week: number; score: number|null }[]
}

// Minimal custom line chart
export function MyLineChart({ data }: MyLineChartProps) {
  return (
    <ChartContainer
      className="min-h-[150px] w-[400px]" // wide so it can scroll horizontally
      config={{
        legend: { color: "#fbbf24" },
        tooltip: { color: "#fbbf24" }
      }}
    >
      <LineChart data={data} width={400} height={150}>
        <CartesianGrid stroke="#ccc" vertical={false} />
        <XAxis
          dataKey="week"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "#ffffff", fontSize: 12 }} // that didnt work I tried to pass props 
          // We'll label them "W1", "W2", etc.
          tickFormatter={(value) => `W${value}`}
        />
        <YAxis
          domain={[0, 100]} // from 0 to 100
          tickCount={6}     // e.g., 0, 20, 40, 60, 80, 100
          tickLine={false}
          axisLine={false}
          tick={{ fill: "#ffffff", fontSize: 12 }}
        />
        {/* ShadCN custom tooltip */}
        <Tooltip content={<ChartTooltipContent />} />

        The line itself: "shades of orange"
        <Line
          type="monotone"
          dataKey="score"
          stroke="#fbbf24"    // Tailwind orange-400, for example
          strokeWidth={3}
          dot={{ r: 4 }}      // visible dots
          activeDot={{ r: 6 }} 
        />
      </LineChart>
    </ChartContainer>
  )
}
