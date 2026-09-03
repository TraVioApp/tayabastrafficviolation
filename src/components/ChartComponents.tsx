import { Bar, Doughnut } from "react-chartjs-2";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

interface ChartProps {
  labels: string[];
  data: number[];
  color?: string;
  secondaryData?: number[];
  secondaryColor?: string;
  colors?: string[];
}

const gridColor = "hsl(var(--border) / 0.65)";
const foregroundColor = "hsl(var(--foreground))";
const textColor = () => document.documentElement.classList.contains("dark") ? "#ffffff" : "#000000";

const sharedOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 900,
    easing: "easeOutQuart" as const,
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      enabled: true,
      displayColors: true,
      backgroundColor: "hsl(var(--card))",
      titleColor: foregroundColor,
      bodyColor: foregroundColor,
      borderColor: gridColor,
      borderWidth: 1,
      padding: 10,
      cornerRadius: 8,
      titleFont: { family: "Outfit", weight: 700 },
      bodyFont: { family: "Outfit" },
    },
  },
  interaction: {
    intersect: false,
    mode: "index" as const,
  },
};

const axisOptions = {
  ...sharedOptions,
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: textColor, font: { family: "Outfit", size: 11 } },
      border: { display: false },
    },
    y: {
      beginAtZero: true,
      grid: { color: gridColor, borderDash: [3, 5] },
      ticks: { color: textColor, precision: 0, font: { family: "Outfit", size: 10 } },
      border: { display: false },
    },
  },
};

function chartData(labels: string[], data: number[], color: string, secondaryData?: number[], secondaryColor?: string) {
  return {
    labels,
    datasets: [
      {
        label: "Primary",
        data,
        backgroundColor: color,
        borderRadius: 6,
        borderSkipped: false,
        hoverBackgroundColor: color,
        barPercentage: secondaryData ? 0.82 : 0.56,
        categoryPercentage: secondaryData ? 0.72 : 0.76,
      },
      ...(secondaryData
        ? [{
            label: "Secondary",
            data: secondaryData,
            backgroundColor: secondaryColor || "#f59e0b",
            borderRadius: 6,
            borderSkipped: false,
            hoverBackgroundColor: secondaryColor || "#f59e0b",
            barPercentage: 0.82,
            categoryPercentage: 0.72,
          }]
        : []),
    ],
  };
}

export function VerticalBarChartComponent({ labels, data, color = "#3b82f6" }: ChartProps) {
  return (
    <div className="w-full h-full">
      <Bar
        data={chartData(labels, data, color)}
        options={{ ...axisOptions, animation: { ...sharedOptions.animation, delay: (context) => context.dataIndex * 90 } }}
      />
    </div>
  );
}

export function BarChartComponent({ labels, data, secondaryData = [], color = "#3b82f6", secondaryColor = "#f59e0b" }: ChartProps) {
  return (
    <div className="w-full h-full">
      <Bar
        data={chartData(labels, data, color, secondaryData.length ? secondaryData : undefined, secondaryColor)}
        options={{ ...axisOptions, animation: { ...sharedOptions.animation, delay: (context) => context.dataIndex * 90 } }}
      />
    </div>
  );
}

export function DoughnutChartComponent({ labels, data, colors = [] }: ChartProps) {
  const total = data.reduce((sum, value) => sum + value, 0);

  return (
    <div className="relative flex items-center justify-center gap-6 w-full h-full">
      <div className="relative shrink-0" style={{ width: 190, height: 190 }}>
        <Doughnut
          data={{
            labels,
            datasets: [{
              data,
              backgroundColor: colors.length ? colors : ["#3b82f6", "#f59e0b", "#6b7280"],
              borderColor: "hsl(var(--card))",
              borderWidth: 3,
              hoverOffset: 10,
            }],
          }}
          options={{
            ...sharedOptions,
            cutout: "68%",
            animation: { ...sharedOptions.animation, animateRotate: true, animateScale: true },
            plugins: {
              ...sharedOptions.plugins,
              tooltip: {
                ...sharedOptions.plugins.tooltip,
                callbacks: { label: (context) => ` ${context.label}: ${context.parsed}` },
              },
            },
          }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold pointer-events-none" style={{ color: foregroundColor }}>{total}</span>
      </div>
      <div className="flex flex-col gap-2">
        {labels.map((label, index) => (
          <div key={label} className="flex items-center gap-2 text-xs" style={{ color: textColor() }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: colors[index] || "#3b82f6" }} />
            <span>{label}</span>
            <strong style={{ color: foregroundColor }}>{data[index] || 0}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}