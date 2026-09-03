import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Loader2 } from 'lucide-react';

type ReportMode = 'monthly-financial' | 'top-violations';

interface ViolationDetail {
  name?: string;
  fine?: number;
  severity?: string;
}

interface ViolationRow {
  id: string;
  violationDate: string;
  totalAmount?: number | string;
  status?: string;
  referenceNumber?: string;
  driverName?: string;
  location?: string;
  violations?: ViolationDetail[] | string | null;
  officerId?: string;
}

const formatViolationTypes = (violations: ViolationRow['violations']) => {
  if (Array.isArray(violations)) {
    const names = violations.map(violation => violation?.name).filter(Boolean);
    return names.length ? names.join(', ') : 'Unknown';
  }

  return typeof violations === 'string' && violations.trim() ? violations.trim() : 'Unknown';
};

export function Reports() {
  const [mode, setMode] = useState<ReportMode>('monthly-financial');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [officerId, setOfficerId] = useState<string | null>(null);
  const [years, setYears] = useState<number[]>([]);
  const [officers, setOfficers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [hotspots, setHotspots] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: vdata } = await supabase.from('violations').select('violationDate');
        const yrs = new Set<number>();
        (vdata || []).forEach((r: any) => {
          const d = new Date(r.violationDate);
          if (!isNaN(d.getTime())) yrs.add(d.getFullYear());
        });
        const sorted = Array.from(yrs).sort((a: number, b: number) => b - a);
        setYears(sorted.length ? sorted : [new Date().getFullYear()]);

        const { data: edata } = await supabase.from('enforcers').select('id,name');
        setOfficers(edata || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Generic paged fetch helper
  const fetchPagedViolations = async (from: string, to: string, officerFilter?: string | null) => {
    const pageSize = 1000;
    let offset = 0;
    let allRows: ViolationRow[] = [];

    while (true) {
      let q: any = supabase
        .from('violations')
        .select('id,violationDate,totalAmount,status,referenceNumber,driverName,location,violations,officerId')
        .gte('violationDate', from)
        .lte('violationDate', to)
        .range(offset, offset + pageSize - 1);

      if (officerFilter) q = q.eq('officerId', officerFilter);

      const { data, error } = await q;
      if (error) {
        if ((error as any)?.code === '57014' || (error as any)?.message?.toLowerCase?.().includes('statement timeout')) {
          throw new Error('DB_TIMEOUT');
        }
        throw error;
      }

      const rows: ViolationRow[] = (data || []) as ViolationRow[];
      if (!rows.length) break;
      allRows = allRows.concat(rows);
      if (rows.length < pageSize) break;
      offset += pageSize;
    }

    return allRows;
  };

  const runMonthlyFinancial = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSummary(null);
    try {
      if (officerId && officerId.startsWith('OFF-')) {
        setErrorMsg('Selected officer is local-only; reports require DB-backed officer.');
        return;
      }

      const from = `${year}-01-01`;
      const to = `${year}-12-31`;
      const rows = await fetchPagedViolations(from, to, officerId);

      const perMonth: Record<number, { pending: number; collected: number; count: number }> = {} as any;
      for (let m = 1; m <= 12; m++) perMonth[m] = { pending: 0, collected: 0, count: 0 };

      let totalPending = 0;
      let totalCollected = 0;

      rows.forEach(r => {
        const d = new Date(r.violationDate);
        const m = d.getMonth() + 1;
        const amt = Number(r.totalAmount || 0);
        if (r.status === 'paid') {
          perMonth[m].collected += amt;
          totalCollected += amt;
        } else {
          perMonth[m].pending += amt;
          totalPending += amt;
        }
        perMonth[m].count += 1;
      });

      setSummary({ perMonth, totalPending, totalCollected, rowsCount: rows.length });
    } catch (e: any) {
      if (e?.message === 'DB_TIMEOUT') setErrorMsg('Query timed out. Narrow the date range or add DB indexes on violationDate/officerId.');
      else setErrorMsg(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const runTopViolations = async () => {
    setLoading(true);
    setErrorMsg(null);
    setHotspots(null);
    try {
      if (officerId && officerId.startsWith('OFF-')) {
        setErrorMsg('Selected officer is local-only; reports require DB-backed officer.');
        return;
      }

      // For hotspots we aggregate counts by violationType and by location
      const from = `${year}-01-01`;
      const to = `${year}-12-31`;
      const rows = await fetchPagedViolations(from, to, officerId);

      // Top violation types
      const typeCounts: Record<string, { count: number; total: number }> = {};
      const locationCounts: Record<string, { count: number; total: number }> = {};

      rows.forEach(r => {
        const t = formatViolationTypes(r.violations);
        const loc = (r.location || 'Unknown').trim();
        const amt = Number(r.totalAmount || 0);

        if (!typeCounts[t]) typeCounts[t] = { count: 0, total: 0 };
        typeCounts[t].count += 1;
        typeCounts[t].total += amt;

        if (!locationCounts[loc]) locationCounts[loc] = { count: 0, total: 0 };
        locationCounts[loc].count += 1;
        locationCounts[loc].total += amt;
      });

      const topTypes = Object.entries(typeCounts).sort((a, b) => b[1].count - a[1].count).slice(0, 10);
      const topLocations = Object.entries(locationCounts).sort((a, b) => b[1].count - a[1].count).slice(0, 10);

      setHotspots({ topTypes, topLocations, totalRows: rows.length });
    } catch (e: any) {
      if (e?.message === 'DB_TIMEOUT') setErrorMsg('Query timed out. Narrow the date range or add DB indexes on violationDate/officerId/location.');
      else setErrorMsg(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleRun = () => {
    if (mode === 'monthly-financial') runMonthlyFinancial();
    else runTopViolations();
  };

  return (
    <div className="card overflow-hidden p-4 sm:p-6 lg:p-7">
      <div className="flex flex-col gap-5 mb-7">
        <div>
          <h3 className="text-lg font-bold">Reports</h3>
          <p className="text-sm text-muted-foreground mt-1">Review collections, violation patterns, and locations.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-end">
          <div className="btn-group">
            <button onClick={() => setMode('monthly-financial')} className={`btn flex-1 ${mode === 'monthly-financial' ? 'btn-primary' : 'btn-ghost'}`}>Monthly Financial</button>
            <button onClick={() => setMode('top-violations')} className={`btn flex-1 ${mode === 'top-violations' ? 'btn-primary' : 'btn-ghost'}`}>Top Violations & Hotspots</button>
          </div>

          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Year</span>
            <select value={year} onChange={e => setYear(Number(e.target.value))} className="input-field w-full">
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Officer</span>
            <select value={officerId || ''} onChange={e => setOfficerId(e.target.value || null)} className="input-field w-full">
            <option value="">All Officers</option>
            {officers.map(o => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
            </select>
          </label>

          <button onClick={handleRun} className="btn btn-primary w-full">Run Report</button>
        </div>
      </div>

      {loading && (
        <div className="p-4 text-center"><Loader2 className="animate-spin mx-auto" /></div>
      )}

      {errorMsg && (
        <div className="p-3 mt-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
          {errorMsg}
        </div>
      )}

      {mode === 'monthly-financial' && summary && (
        <div>
          <h4 className="font-semibold mt-4">Monthly Financial Summary — {year}</h4>
          <p className="text-sm text-muted-foreground mt-1">Records: {summary.rowsCount}</p>
          <div className="overflow-x-auto mt-5 border border-border rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-5 py-4 font-semibold">Month</th>
                  <th className="px-5 py-4 font-semibold text-right">Pending</th>
                  <th className="px-5 py-4 font-semibold text-right">Collected</th>
                  <th className="px-5 py-4 font-semibold text-right">Records</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
            {Object.keys(summary.perMonth).map(k => {
              const m = summary.perMonth[Number(k)];
              return (
                <tr key={k} className="hover:bg-muted/20">
                  <td className="px-5 py-4 font-medium">Month {k}</td>
                  <td className="px-5 py-4 text-right">₱{m.pending.toLocaleString()}</td>
                  <td className="px-5 py-4 text-right">₱{m.collected.toLocaleString()}</td>
                  <td className="px-5 py-4 text-right">{m.count}</td>
                </tr>
              );
            })}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Collected</p>
              <p className="text-lg font-semibold mt-1">₱{Number(summary.totalCollected || 0).toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Pending</p>
              <p className="text-lg font-semibold mt-1">₱{Number(summary.totalPending || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {mode === 'top-violations' && hotspots && (
        <div>
          <h4 className="font-semibold mt-4">Top Violations & Hotspots — {year}</h4>
          <p className="text-sm text-muted-foreground mt-1">Records scanned: {hotspots.totalRows}</p>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mt-6">
            <div className="overflow-x-auto border border-border rounded-lg">
              <h5 className="font-medium px-5 py-4 border-b border-border">Top Violation Types</h5>
              <table className="w-full min-w-[520px] text-sm text-left">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-5 py-3 font-semibold">Violation</th><th className="px-5 py-3 font-semibold text-right">Count</th><th className="px-5 py-3 font-semibold text-right">Total</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {hotspots.topTypes.map((t: any) => (
                    <tr key={t[0]} className="hover:bg-muted/20"><td className="px-5 py-4 font-medium">{t[0]}</td><td className="px-5 py-4 text-right">{t[1].count}</td><td className="px-5 py-4 text-right">₱{Number(t[1].total || 0).toLocaleString()}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto border border-border rounded-lg">
              <h5 className="font-medium px-5 py-4 border-b border-border">Top Locations</h5>
              <table className="w-full min-w-[520px] text-sm text-left">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-5 py-3 font-semibold">Location</th><th className="px-5 py-3 font-semibold text-right">Count</th><th className="px-5 py-3 font-semibold text-right">Total</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {hotspots.topLocations.map((l: any) => (
                    <tr key={l[0]} className="hover:bg-muted/20"><td className="px-5 py-4 font-medium">{l[0]}</td><td className="px-5 py-4 text-right">{l[1].count}</td><td className="px-5 py-4 text-right">₱{Number(l[1].total || 0).toLocaleString()}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
