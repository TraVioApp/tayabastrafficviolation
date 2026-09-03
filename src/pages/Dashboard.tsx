import { useMemo } from "react";
import {
  FileText,
  AlertCircle,
  Users,
  TrendingUp,
  Clock,
  Award,
} from "lucide-react";
import { DoughnutChartComponent, BarChartComponent, VerticalBarChartComponent } from "../components/ChartComponents";

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface ViolationRecord {
  id: string;
  referenceNumber: string;
  driverName: string;
  plateNumber: string;
  vehicleType: string;
  violations: Array<{ name: string; fine: number; severity: string }>;
  violationDate: string;
  totalAmount: number;
  status: "pending" | "paid" | "cancelled";
  createdAt: string;
  officerId: string;
  location: string;
}

interface Enforcer {
  id: string;
  name: string;
  badgeNumber: string;
  station: string;
  rank: string;
  status?: "active" | "inactive";
  isSystemAdmin?: boolean;
}

interface Props {
  violations: ViolationRecord[];
  enforcers: Enforcer[];
  loading: boolean;
}

/* ─────────────────────────────────────────
   COLOUR HELPERS
───────────────────────────────────────── */
const SEVERITY_COLORS: Record<string, string> = {
  grave: "#ef4444",
  "less-grave": "#f97316",
  minor: "#22c55e",
};

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ─────────────────────────────────────────
   CHART PALETTE
───────────────────────────────────────── */
function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
  trend?: string;
}) {
  return (
    <div
      className="stat-card group cursor-default"
      style={{ background: "hsl(var(--card))" }}
    >
      <div className="flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>
          {label}
        </p>
        <p className="text-2xl font-bold mt-1 leading-none" style={{ color: "hsl(var(--foreground))" }}>
          {value}
        </p>
        {sub && (
          <p className="text-xs mt-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>
            {sub}
          </p>
        )}
        {trend && (
          <p className="text-xs mt-1 font-medium" style={{ color }}>
            {trend}
          </p>
        )}
      </div>
      <div
        className="icon-container"
        style={{ background: `${color}18`, color }}
      >
        <Icon className="w-6 h-6" />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   CHART WRAPPER CARD
───────────────────────────────────────── */
function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="card flex flex-col gap-4" style={{ minHeight: 430, marginTop: "0.75rem", marginBottom: "0.5rem", padding: "1.4rem 1.2rem 1.2rem" }}>
      <div className="mb-2">
        <h3 className="font-semibold" style={{ color: "hsl(var(--foreground))", fontSize: "1rem", letterSpacing: "-0.02em" }}>{title}</h3>
        {subtitle && (
          <p className="mt-1" style={{ color: "hsl(var(--muted-foreground))", fontSize: "0.72rem" }}>{subtitle}</p>
        )}
      </div>
      <div className="flex-1 flex flex-col justify-center px-1 md:px-2">
        {children}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   MAIN DASHBOARD COMPONENT
───────────────────────────────────────── */
export function Dashboard({ violations, enforcers, loading }: Props) {
  /* ── KPI values ── */
  const today = new Date().toISOString().slice(0, 10);

  const kpi = useMemo(() => {
    const paid = violations.filter((v) => v.status === "paid");
    const pending = violations.filter((v) => v.status === "pending");
    const cancelled = violations.filter((v) => v.status === "cancelled");
    const todayCount = violations.filter(
      (v) => v.violationDate?.slice(0, 10) === today || v.createdAt?.slice(0, 10) === today
    ).length;
    const collected = paid.reduce((s, v) => s + Number(v.totalAmount || 0), 0);
    const pendingAmt = pending.reduce((s, v) => s + Number(v.totalAmount || 0), 0);
    const collectionRate = violations.length > 0 ? (paid.length / violations.length) * 100 : 0;
    const activeOfficers = enforcers.filter((e) => e.status !== "inactive" && !e.isSystemAdmin).length;

    return { paid, pending, cancelled, todayCount, collected, pendingAmt, collectionRate, activeOfficers };
  }, [violations, enforcers, today]);

  /* ── Severity breakdown ── */
  const severityData = useMemo(() => {
    const counts: Record<string, number> = { grave: 0, "less-grave": 0, minor: 0 };
    violations.forEach((v) => {
      (v.violations || []).forEach((viol) => {
        const sev = typeof viol === "string" ? "minor" : (viol.severity || "minor");
        const key = sev in counts ? sev : "minor";
        counts[key]++;
      });
    });
    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    return [
      { label: "Grave", value: counts["grave"], color: SEVERITY_COLORS.grave, pct: total ? (counts["grave"] / total) * 100 : 0 },
      { label: "Less Grave", value: counts["less-grave"], color: SEVERITY_COLORS["less-grave"], pct: total ? (counts["less-grave"] / total) * 100 : 0 },
      { label: "Minor", value: counts["minor"], color: SEVERITY_COLORS.minor, pct: total ? (counts["minor"] / total) * 100 : 0 },
    ];
  }, [violations]);

  /* ── Monthly trend (last 6 months) ── */
  const monthlyTrend = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const count = violations.filter((v) => (v.violationDate || v.createdAt || "").slice(0, 7) === key).length;
      return { label: MONTH_LABELS[d.getMonth()], value: count };
    });
  }, [violations]);

  /* ── Revenue by month (paid vs pending, last 6) ── */
  const revenueByMonth = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthV = violations.filter((v) => (v.violationDate || v.createdAt || "").slice(0, 7) === key);
      const paid = monthV.filter((v) => v.status === "paid").reduce((s, v) => s + Number(v.totalAmount || 0), 0);
      const pending = monthV.filter((v) => v.status === "pending").reduce((s, v) => s + Number(v.totalAmount || 0), 0);
      return { label: MONTH_LABELS[d.getMonth()], value: Math.round(paid / 1000), secondaryValue: Math.round(pending / 1000) };
    });
  }, [violations]);

  /* ── Payment status ── */
  const statusSlices = useMemo(() => {
    const total = violations.length || 1;
    return [
      { label: "Paid", value: kpi.paid.length, color: "#10b981", pct: (kpi.paid.length / total) * 100 },
      { label: "Pending", value: kpi.pending.length, color: "#f59e0b", pct: (kpi.pending.length / total) * 100 },
      { label: "Cancelled", value: kpi.cancelled.length, color: "#6b7280", pct: (kpi.cancelled.length / total) * 100 },
    ];
  }, [kpi, violations.length]);

  /* ── Top violation types ── */
  const topViolationTypes = useMemo(() => {
    const counts: Record<string, number> = {};
    violations.forEach((v) => {
      (v.violations || []).forEach((viol) => {
        const name = typeof viol === "string" ? viol : (viol.name || "Unknown");
        counts[name] = (counts[name] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [violations]);

  /* ── Top officers by reports ── */
  const topOfficers = useMemo(() => {
    const counts: Record<string, number> = {};
    violations.forEach((v) => {
      if (v.officerId) counts[v.officerId] = (counts[v.officerId] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([id, value]) => {
        const enforcer = enforcers.find((e) => e.id === id);
        return { label: enforcer?.name || id.slice(0, 8) + "…", value };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [violations, enforcers]);


  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ minHeight: 400 }}>
        <div className="w-10 h-10 rounded-full border-4 border-blue-500 border-t-transparent animate-spin mb-4" />
        <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>Loading analytics data…</p>
      </div>
    );
  }

  /* ── RENDER ── */
  return (
    <div className="space-y-6 fade-in">

      {/* ── KPI ROW ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          label="Total Reports"
          value={violations.length.toLocaleString()}
          sub={`${kpi.todayCount} filed today`}
          icon={FileText}
          color="#3b82f6"
        />
        <KpiCard
          label="Revenue Collected"
          value={`₱${(kpi.collected / 1000).toFixed(1)}k`}
          sub={`${kpi.paid.length} paid records`}
          icon={() => <span className="text-xl font-bold">₱</span>}
          color="#10b981"
        />
        <KpiCard
          label="Pending Revenue"
          value={`₱${(kpi.pendingAmt / 1000).toFixed(1)}k`}
          sub={`${kpi.pending.length} pending`}
          icon={AlertCircle}
          color="#f59e0b"
        />
        <KpiCard
          label="Collection Rate"
          value={`${kpi.collectionRate.toFixed(1)}%`}
          sub="Paid vs total"
          icon={TrendingUp}
          color="#8b5cf6"
        />
        <KpiCard
          label="Active Officers"
          value={kpi.activeOfficers.toLocaleString()}
          sub={`of ${enforcers.filter(e => !e.isSystemAdmin).length} total`}
          icon={Users}
          color="#06b6d4"
        />
        <KpiCard
          label="Today's Reports"
          value={kpi.todayCount.toLocaleString()}
          sub={new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          icon={Clock}
          color="#ec4899"
        />
      </div>

      {/* ── ROW 2: Monthly Trend + Revenue ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Monthly Violations Trend" subtitle="Report count over the last 6 months">
          <div className="my-3 w-full" style={{ height: "320px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <VerticalBarChartComponent
              labels={monthlyTrend.map(d => d.label)}
              data={monthlyTrend.map(d => d.value)}
              color="#3b82f6"
            />
          </div>
        </ChartCard>

        <ChartCard title="Revenue by Month" subtitle="Paid (₱k) vs Pending (₱k) — last 6 months">
          <div className="my-3 w-full" style={{ height: "320px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BarChartComponent
              labels={revenueByMonth.map(d => d.label)}
              data={revenueByMonth.map(d => d.value)}
              secondaryData={revenueByMonth.map(d => d.secondaryValue)}
              color="#3b82f6"
              secondaryColor="#f59e0b"
            />
          </div>
        </ChartCard>
      </div>

      {/* ── ROW 3: Severity + Status ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Violations by Severity" subtitle="Distribution across all records">
          <div className="flex items-center justify-center my-2" style={{ minHeight: "260px", width: "100%" }}>
            <div style={{ width: "100%", maxWidth: "360px", height: "250px" }}>
              <DoughnutChartComponent
                labels={severityData.map(s => s.label)}
                data={severityData.map(s => s.value)}
                colors={severityData.map(s => s.color)}
              />
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Payment Status" subtitle="Current status of all violation records">
          <div className="flex items-center justify-center my-2" style={{ minHeight: "260px", width: "100%" }}>
            <div style={{ width: "100%", maxWidth: "360px", height: "250px" }}>
              <DoughnutChartComponent
                labels={statusSlices.map(s => s.label)}
                data={statusSlices.map(s => s.value)}
                colors={statusSlices.map(s => s.color)}
              />
            </div>
          </div>
        </ChartCard>
      </div>

      {/* ── ROW 4: Top Violation Types + Top Officers ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Top Violation Types" subtitle="Most frequently issued offenses">
          <div className="my-3 px-4 w-full" style={{ minHeight: "280px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {topViolationTypes.length > 0 ? (
              <div style={{ width: "100%", height: "100%" }}>
                <BarChartComponent
                  labels={topViolationTypes.map(d => d.label)}
                  data={topViolationTypes.map(d => d.value)}
                  color="#3b82f6"
                />
              </div>
            ) : (
              <p className="text-sm text-center py-8" style={{ color: "hsl(var(--muted-foreground))" }}>No data available</p>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Top Officers by Reports Filed" subtitle="Officers with most violations issued">
          <div className="my-3 px-4 w-full" style={{ minHeight: "280px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {topOfficers.length > 0 ? (
              <div style={{ width: "100%", height: "100%" }}>
                <BarChartComponent
                  labels={topOfficers.map(d => d.label)}
                  data={topOfficers.map(d => d.value)}
                  color="#8b5cf6"
                />
              </div>
            ) : (
              <p className="text-sm text-center py-8" style={{ color: "hsl(var(--muted-foreground))" }}>No data available</p>
            )}
          </div>
        </ChartCard>
      </div>


      {/* ── ROW 6: Officers Overview Table ── */}
      <ChartCard title="Officers Performance Overview" subtitle="Summary of all active enforcement personnel">
        <div className="overflow-x-auto">
          <table className="data-table" style={{ paddingTop: 0 }}>
            <thead>
              <tr>
                <th>Officer</th>
                <th>Badge</th>
                <th>Station</th>
                <th>Rank</th>
                <th className="text-center">Reports</th>
                <th className="text-right">Revenue</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {enforcers.filter((e) => !e.isSystemAdmin).slice(0, 8).map((officer) => {
                const officerViolations = violations.filter((v) => v.officerId === officer.id);
                const officerRevenue = officerViolations
                  .filter((v) => v.status === "paid")
                  .reduce((s, v) => s + Number(v.totalAmount || 0), 0);
                return (
                  <tr key={officer.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ background: "#3b82f6" }}
                        >
                          {(officer.name || "?").charAt(0)}
                        </div>
                        <span className="font-medium text-sm" style={{ color: "hsl(var(--foreground))" }}>
                          {officer.name}
                        </span>
                      </div>
                    </td>
                    <td className="font-mono text-xs" style={{ color: "#3b82f6" }}>{officer.badgeNumber}</td>
                    <td className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{officer.station}</td>
                    <td className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{officer.rank}</td>
                    <td className="text-center">
                      <span
                        className="inline-flex items-center gap-1 text-xs font-semibold"
                        style={{ color: "hsl(var(--foreground))" }}
                      >
                        <Award className="w-3 h-3" style={{ color: "#f59e0b" }} />
                        {officerViolations.length}
                      </span>
                    </td>
                    <td className="text-right text-xs font-bold" style={{ color: "#10b981" }}>
                      ₱{officerRevenue.toLocaleString()}
                    </td>
                    <td className="text-center">
                      <span
                        className="badge"
                        style={{
                          background: officer.status === "inactive" ? "#6b728020" : "#10b98120",
                          color: officer.status === "inactive" ? "#6b7280" : "#10b981",
                        }}
                      >
                        {officer.status || "active"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {enforcers.filter((e) => !e.isSystemAdmin).length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center p-6" style={{ color: "hsl(var(--muted-foreground))" }}>
                    No officer records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ChartCard>

    </div>
  );
}
