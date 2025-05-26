
"use client";

import { Users, Percent, ListChecks, CalendarDays } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

const kpiData = [
  {
    title: 'Total de Alunos',
    value: '7,542',
    icon: Users,
    bgColorClass: 'bg-[hsl(var(--dashboard-kpi-alunos-bg))]',
    fgColorClass: 'text-[hsl(var(--dashboard-kpi-alunos-fg))]',
    iconBgClass: 'bg-black/10 dark:bg-white/10',
  },
  {
    title: 'Média de Presença',
    value: '3,671',
    icon: Percent,
    bgColorClass: 'bg-[hsl(var(--dashboard-kpi-presenca-bg))]',
    fgColorClass: 'text-[hsl(var(--dashboard-kpi-presenca-fg))]',
    iconBgClass: 'bg-black/10 dark:bg-black/20',
  },
  {
    title: 'Classes Ativas',
    value: '255',
    icon: ListChecks,
    bgColorClass: 'bg-[hsl(var(--dashboard-kpi-classes-bg))]',
    fgColorClass: 'text-[hsl(var(--dashboard-kpi-classes-fg))]',
    iconBgClass: 'bg-white/20 dark:bg-black/20',
  },
  {
    title: 'Eventos Mensais',
    value: '2,318',
    icon: CalendarDays,
    bgColorClass: 'bg-[hsl(var(--dashboard-kpi-eventos-bg))]',
    fgColorClass: 'text-[hsl(var(--dashboard-kpi-eventos-fg))]',
    iconBgClass: 'bg-white/20 dark:bg-black/20',
  },
];

const monthlyAttendanceData = [
  { month: 'Jan', attendance: 65, previous: 60 },
  { month: 'Fev', attendance: 59, previous: 55 },
  { month: 'Mar', attendance: 80, previous: 75 },
  { month: 'Abr', attendance: 81, previous: 78 },
  { month: 'Mai', attendance: 56, previous: 50 },
  { month: 'Jun', attendance: 55, previous: 52 },
  { month: 'Jul', attendance: 70, previous: 65 },
];

const chartConfig = {
  attendance: {
    label: "Atual",
    color: "hsl(var(--chart-1))",
  },
  previous: {
    label: "Anterior",
    color: "hsl(var(--chart-2))",
  },
} satisfies Parameters<typeof ChartContainer>[0]["config"];

export default function DashboardPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="text-left mb-6">
        <h1 className="text-3xl font-bold text-foreground">Painel Central</h1>
        <p className="text-md text-muted-foreground">Visão geral do sistema EBD</p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-4 md:gap-6">
        {kpiData.map((item, index) => (
          <Card key={index} className={cn("shadow-lg rounded-xl p-4 flex items-center space-x-3 min-h-[100px]", item.bgColorClass)}>
            <div className={cn("p-2 rounded-lg flex items-center justify-center", item.iconBgClass)}>
              <item.icon className={cn("h-6 w-6", item.fgColorClass)} />
            </div>
            <div>
              <p className={cn("text-2xl font-bold", item.fgColorClass)}>{item.value}</p>
              <p className={cn("text-xs font-medium", item.fgColorClass)}>{item.title}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Monthly Attendance Chart Card */}
      <Card className="shadow-lg rounded-xl bg-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-card-foreground">Frequência Mensal</CardTitle>
        </CardHeader>
        <CardContent className="h-[250px] p-2">
          <ChartContainer config={chartConfig} className="w-full h-full">
            <LineChart
              data={monthlyAttendanceData}
              margin={{
                top: 5,
                right: 10,
                left: -15, 
                bottom: 0,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border)/0.5)" />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={(value) => `${value}`}
                width={30}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="line" hideLabel className="bg-popover border-border shadow-xl text-popover-foreground" />}
              />
              <Line
                dataKey="attendance"
                type="monotone"
                strokeWidth={2}
                stroke="var(--color-attendance)"
                dot={{
                  r: 4,
                  fill: "var(--color-attendance)",
                  stroke: "hsl(var(--background))", 
                  strokeWidth: 2,
                }}
                activeDot={{
                  r: 6,
                  fill: "var(--color-attendance)",
                  stroke: "hsl(var(--background))",
                  strokeWidth: 2,
                }}
              />
              <Line
                dataKey="previous"
                type="monotone"
                strokeWidth={2}
                stroke="var(--color-previous)"
                 dot={{
                  r: 4,
                  fill: "var(--color-previous)",
                  stroke: "hsl(var(--background))",
                  strokeWidth: 2,
                }}
                 activeDot={{
                  r: 6,
                  fill: "var(--color-previous)",
                  stroke: "hsl(var(--background))",
                  strokeWidth: 2,
                }}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
