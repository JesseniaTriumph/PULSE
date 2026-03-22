import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users,
  Stethoscope,
  User,
  CalendarCheck,
  Wifi,
  HelpCircle,
  XCircle,
  FileDown,
  FileText,
  Plus,
  Trash2,
  RefreshCw,
  Printer,
  Mail,
  Braces,
  Clock,
  MessageSquare,
  TrendingUp,
} from "lucide-react";
import type { AttendanceRecord, Cohort } from "@shared/schema";
import { RecordsTable } from "@/components/records-table";
import { AddEmailDialog } from "@/components/add-email-dialog";
import { BatchUploadDialog } from "@/components/batch-upload-dialog";
import { GmailFetchDialog } from "@/components/gmail-fetch-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter,
  startOfYear, endOfYear,
  format,
} from "date-fns";

type TimePeriod = "all" | "day" | "week" | "month" | "quarter" | "year";

const timePeriodLabels: Record<TimePeriod, string> = {
  all: "All Time",
  day: "Today",
  week: "This Week",
  month: "This Month",
  quarter: "This Quarter",
  year: "This Year",
};

function getTimePeriodRange(period: TimePeriod): { start: Date; end: Date } | null {
  if (period === "all") return null;
  const now = new Date();
  switch (period) {
    case "day": return { start: startOfDay(now), end: endOfDay(now) };
    case "week": return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case "month": return { start: startOfMonth(now), end: endOfMonth(now) };
    case "quarter": return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case "year": return { start: startOfYear(now), end: endOfYear(now) };
  }
}

function getTimePeriodDescription(period: TimePeriod): string {
  if (period === "all") return "All Records";
  const range = getTimePeriodRange(period);
  if (!range) return "";
  const fmt = "MMM d, yyyy";
  return `${format(range.start, fmt)} - ${format(range.end, fmt)}`;
}

const categoryConfig: Record<
  string,
  { icon: typeof Users; color: string; bgClass: string; glowClass: string }
> = {
  "Sick/Medical": {
    icon: Stethoscope,
    color: "text-rose-600 dark:text-rose-400",
    bgClass: "bg-rose-500/15 border-rose-500/30 dark:bg-rose-500/10 dark:border-rose-500/20",
    glowClass: "shadow-rose-500/10",
  },
  Personal: {
    icon: User,
    color: "text-amber-700 dark:text-amber-400",
    bgClass: "bg-amber-500/15 border-amber-500/30 dark:bg-amber-500/10 dark:border-amber-500/20",
    glowClass: "shadow-amber-500/10",
  },
  "Program Event": {
    icon: CalendarCheck,
    color: "text-sky-600 dark:text-sky-400",
    bgClass: "bg-sky-500/15 border-sky-500/30 dark:bg-sky-500/10 dark:border-sky-500/20",
    glowClass: "shadow-sky-500/10",
  },
  "Technical Issue": {
    icon: Wifi,
    color: "text-violet-600 dark:text-violet-400",
    bgClass: "bg-violet-500/15 border-violet-500/30 dark:bg-violet-500/10 dark:border-violet-500/20",
    glowClass: "shadow-violet-500/10",
  },
  Other: {
    icon: HelpCircle,
    color: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-500/15 border-emerald-500/30 dark:bg-emerald-500/10 dark:border-emerald-500/20",
    glowClass: "shadow-emerald-500/10",
  },
  None: {
    icon: XCircle,
    color: "text-slate-600 dark:text-slate-400",
    bgClass: "bg-slate-500/15 border-slate-500/30 dark:bg-slate-500/10 dark:border-slate-500/20",
    glowClass: "shadow-slate-500/10",
  },
};

export default function Dashboard() {
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [gmailDialogOpen, setGmailDialogOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("all");
  const [filterCohort, setFilterCohort] = useState<string>("all");
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();

  const { data: cohorts = [] } = useQuery<Cohort[]>({
    queryKey: ["/api/cohorts"],
  });

  const { data: records = [], isLoading: recordsLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/records", { cohortId: filterCohort !== "all" ? filterCohort : undefined }],
    queryFn: async () => {
      const url = filterCohort !== "all" ? `/api/records?cohortId=${filterCohort}` : "/api/records";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch records");
      return res.json();
    },
  });

  const { data: stats, isLoading: statsLoading } = useQuery<{
    total: number;
    byCategory: Record<string, number>;
  }>({
    queryKey: ["/api/stats", { cohortId: filterCohort !== "all" ? filterCohort : undefined }],
    queryFn: async () => {
      const url = filterCohort !== "all" ? `/api/stats?cohortId=${filterCohort}` : "/api/stats";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const timeFilteredRecords = useMemo(() => {
    const range = getTimePeriodRange(timePeriod);
    if (!range) return records;
    return records.filter((r) => {
      const date = new Date(r.receivedAt);
      return date >= range.start && date <= range.end;
    });
  }, [records, timePeriod]);

  const [filterType, setFilterType] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");

  const typeFilteredRecords = filterType === "all"
    ? timeFilteredRecords
    : timeFilteredRecords.filter((r) => r.attendanceType === filterType);

  const sourceFilteredRecords = filterSource === "all"
    ? typeFilteredRecords
    : typeFilteredRecords.filter((r) => (r.source || "gmail") === filterSource);

  const filteredRecords = filterCategory
    ? sourceFilteredRecords.filter((r) => r.excuseCategory === filterCategory)
    : sourceFilteredRecords;

  const periodStats = useMemo(() => {
    const byCategory: Record<string, number> = {};
    for (const cat of Object.keys(categoryConfig)) {
      byCategory[cat] = 0;
    }
    for (const r of timeFilteredRecords) {
      byCategory[r.excuseCategory] = (byCategory[r.excuseCategory] || 0) + 1;
    }
    return { total: timeFilteredRecords.length, byCategory };
  }, [timeFilteredRecords]);

  const trendData = useMemo(() => {
    if (timeFilteredRecords.length === 0) return [];
    const buckets = new Map<string, { date: string; Absent: number; "Late/Tardy": number; Unexcused: number }>();
    for (const r of timeFilteredRecords) {
      const date = new Date(r.receivedAt);
      const key = (timePeriod === "day" || timePeriod === "week" || timePeriod === "month")
        ? format(date, "MMM d")
        : format(date, "MMM yyyy");
      if (!buckets.has(key)) buckets.set(key, { date: key, Absent: 0, "Late/Tardy": 0, Unexcused: 0 });
      const b = buckets.get(key)!;
      if (r.attendanceType === "Absent") b.Absent++;
      else if (r.attendanceType === "Late/Tardy") b["Late/Tardy"]++;
      else if (r.attendanceType === "Unexcused") b.Unexcused++;
    }
    return Array.from(buckets.values());
  }, [timeFilteredRecords, timePeriod]);

  const topStudents = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of timeFilteredRecords) {
      if (!r.senderName) continue;
      counts.set(r.senderName, (counts.get(r.senderName) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [timeFilteredRecords]);

  const handleExportCSV = () => {
    window.open("/api/export/csv", "_blank");
  };

  const handleExportDoc = () => {
    window.open("/api/export/doc", "_blank");
  };

  const handleExportJSON = () => {
    window.open("/api/export/json", "_blank");
  };

  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to clear all records? This cannot be undone.")) return;
    try {
      await apiRequest("DELETE", "/api/records");
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "All records cleared" });
    } catch {
      toast({ title: "Failed to clear records", variant: "destructive" });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-page-title">Dashboard</h2>
          <p className="text-sm text-muted-foreground">Welcome back, {user?.displayName || "User"}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && cohorts.length > 0 && (
            <Select value={filterCohort} onValueChange={setFilterCohort}>
              <SelectTrigger className="w-[130px] border-violet-500/20 h-8 text-xs" data-testid="select-filter-cohort">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {cohorts.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAddDialogOpen(true)}
            data-testid="button-add-email"
            className="border-violet-500/30 hover:bg-violet-500/10"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Email
          </Button>
          <Button
            size="sm"
            onClick={() => setBatchDialogOpen(true)}
            data-testid="button-batch-upload"
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
          >
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Batch Process
          </Button>
          {user?.googleId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setGmailDialogOpen(true)}
              data-testid="button-gmail-fetch"
              className="border-violet-500/30 hover:bg-violet-500/10"
            >
              <Mail className="w-4 h-4 mr-1.5" />
              Gmail
            </Button>
          )}
          <Button
            size="sm"
            variant={showAnalytics ? "default" : "outline"}
            onClick={() => setShowAnalytics(v => !v)}
            className={showAnalytics ? "bg-gradient-to-r from-violet-600 to-indigo-600" : "border-violet-500/30 hover:bg-violet-500/10"}
          >
            <TrendingUp className="w-4 h-4 mr-1.5" />
            Analytics
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 no-print" data-testid="time-period-filter">
        {(Object.keys(timePeriodLabels) as TimePeriod[]).map((period) => (
          <Button
            key={period}
            size="sm"
            variant={timePeriod === period ? "default" : "outline"}
            onClick={() => setTimePeriod(period)}
            data-testid={`button-period-${period}`}
            className={
              timePeriod === period
                ? "bg-gradient-to-r from-violet-600 to-indigo-600"
                : "border-violet-500/30 hover:bg-violet-500/10"
            }
          >
            {timePeriodLabels[period]}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 no-print">

        <Card
          className={`cursor-pointer transition-all border ${
            filterCategory === null
              ? "ring-2 ring-violet-500 border-violet-500/40 bg-violet-500/10"
              : "border-violet-500/10 bg-card/60 backdrop-blur-sm hover:bg-violet-500/5"
          }`}
          onClick={() => setFilterCategory(null)}
          data-testid="card-stat-total"
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Total
              </span>
            </div>
            {statsLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <p className="text-2xl font-bold" data-testid="text-stat-total">
                {periodStats.total}
              </p>
            )}
          </CardContent>
        </Card>

        {Object.entries(categoryConfig).map(([category, config]) => {
          const Icon = config.icon;
          const count = periodStats.byCategory[category] || 0;
          return (
            <Card
              key={category}
              className={`cursor-pointer transition-all border ${
                filterCategory === category
                  ? `ring-2 ring-violet-500 ${config.bgClass}`
                  : `border-violet-500/10 bg-card/60 backdrop-blur-sm hover:${config.bgClass}`
              }`}
              onClick={() => setFilterCategory(filterCategory === category ? null : category)}
              data-testid={`card-stat-${category.toLowerCase().replace(/[\/ ]/g, "-")}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-4 h-4 ${config.color}`} />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
                    {category}
                  </span>
                </div>
                {statsLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <p className="text-2xl font-bold">{count}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {showAnalytics && timeFilteredRecords.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 no-print">
          <Card className="lg:col-span-2 border-violet-500/10 bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Attendance Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    cursor={{ fill: "hsl(var(--muted)/0.3)" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Absent" fill="#f43f5e" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Late/Tardy" fill="#f97316" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Unexcused" fill="#64748b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-violet-500/10 bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Most Absences</CardTitle>
            </CardHeader>
            <CardContent>
              {topStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No data</p>
              ) : (
                <div className="space-y-2">
                  {topStudents.map((s, i) => (
                    <div key={s.name} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-medium truncate">{s.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">{s.count}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full"
                            style={{ width: `${(s.count / topStudents[0].count) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-semibold">
            Records
            {filterCategory && (
              <Badge variant="secondary" className="ml-2 bg-violet-500/20 text-violet-300 border-violet-500/30">
                {filterCategory}
              </Badge>
            )}
          </h2>
          <div className="flex items-center gap-1 no-print">
            <Button
              size="sm"
              variant={filterType === "all" ? "default" : "outline"}
              onClick={() => setFilterType("all")}
              data-testid="button-type-all"
              className={filterType === "all" ? "bg-gradient-to-r from-violet-600 to-indigo-600 h-7 text-xs" : "border-violet-500/40 dark:border-violet-500/30 hover:bg-violet-500/10 text-violet-700 dark:text-violet-300 h-7 text-xs"}
            >
              All ({timeFilteredRecords.length})
            </Button>
            <Button
              size="sm"
              variant={filterType === "Absent" ? "default" : "outline"}
              onClick={() => setFilterType(filterType === "Absent" ? "all" : "Absent")}
              data-testid="button-type-absent"
              className={filterType === "Absent" ? "bg-gradient-to-r from-rose-600 to-rose-500 h-7 text-xs" : "border-rose-500/40 dark:border-rose-500/30 hover:bg-rose-500/10 text-rose-700 dark:text-rose-400 h-7 text-xs"}
            >
              Absent ({timeFilteredRecords.filter(r => r.attendanceType === "Absent").length})
            </Button>
            <Button
              size="sm"
              variant={filterType === "Late/Tardy" ? "default" : "outline"}
              onClick={() => setFilterType(filterType === "Late/Tardy" ? "all" : "Late/Tardy")}
              data-testid="button-type-late"
              className={filterType === "Late/Tardy" ? "bg-gradient-to-r from-orange-600 to-orange-500 h-7 text-xs" : "border-orange-500/40 dark:border-orange-500/30 hover:bg-orange-500/10 text-orange-700 dark:text-orange-400 h-7 text-xs"}
            >
              Late/Tardy ({timeFilteredRecords.filter(r => r.attendanceType === "Late/Tardy").length})
            </Button>
            <Button
              size="sm"
              variant={filterType === "Unexcused" ? "default" : "outline"}
              onClick={() => setFilterType(filterType === "Unexcused" ? "all" : "Unexcused")}
              data-testid="button-type-unexcused"
              className={filterType === "Unexcused" ? "bg-gradient-to-r from-slate-700 to-slate-600 dark:from-slate-600 dark:to-slate-500 h-7 text-xs" : "border-slate-500/40 dark:border-slate-500/30 hover:bg-slate-500/10 text-slate-700 dark:text-slate-400 h-7 text-xs"}
            >
              Unexcused ({timeFilteredRecords.filter(r => r.attendanceType === "Unexcused").length})
            </Button>
            <div className="w-px h-5 bg-violet-500/20 mx-1" />
            <Button
              size="sm"
              variant={filterSource === "gmail" ? "default" : "outline"}
              onClick={() => setFilterSource(filterSource === "gmail" ? "all" : "gmail")}
              data-testid="button-source-gmail"
              className={filterSource === "gmail" ? "bg-gradient-to-r from-blue-600 to-blue-500 h-7 text-xs" : "border-blue-500/40 dark:border-blue-500/30 hover:bg-blue-500/10 text-blue-700 dark:text-blue-400 h-7 text-xs"}
            >
              <Mail className="w-3 h-3 mr-1" />
              Gmail ({timeFilteredRecords.filter(r => (r.source || "gmail") === "gmail").length})
            </Button>
            <Button
              size="sm"
              variant={filterSource === "slack" ? "default" : "outline"}
              onClick={() => setFilterSource(filterSource === "slack" ? "all" : "slack")}
              data-testid="button-source-slack"
              className={filterSource === "slack" ? "bg-gradient-to-r from-green-600 to-green-500 h-7 text-xs" : "border-green-500/40 dark:border-green-500/30 hover:bg-green-500/10 text-green-700 dark:text-green-400 h-7 text-xs"}
            >
              <MessageSquare className="w-3 h-3 mr-1" />
              Slack ({timeFilteredRecords.filter(r => r.source === "slack").length})
            </Button>
          </div>
          <Badge variant="outline" className="border-violet-500/30">{filteredRecords.length}</Badge>
          {timePeriod !== "all" && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {getTimePeriodDescription(timePeriod)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap no-print">
          {filteredRecords.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrint}
              data-testid="button-print"
              className="border-violet-500/30 hover:bg-violet-500/10"
            >
              <Printer className="w-4 h-4 mr-1.5" />
              Print
            </Button>
          )}
          {records.length > 0 && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportCSV}
                data-testid="button-export-csv"
                className="border-violet-500/30 hover:bg-violet-500/10"
              >
                <FileDown className="w-4 h-4 mr-1.5" />
                CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportDoc}
                data-testid="button-export-doc"
                className="border-violet-500/30 hover:bg-violet-500/10"
              >
                <FileText className="w-4 h-4 mr-1.5" />
                DOC
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportJSON}
                data-testid="button-export-json"
                className="border-violet-500/30 hover:bg-violet-500/10"
              >
                <Braces className="w-4 h-4 mr-1.5" />
                JSON
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleClearAll}
                className="text-destructive border-rose-500/30 hover:bg-rose-500/10"
                data-testid="button-clear-all"
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Clear
              </Button>
            </>
          )}
        </div>
      </div>

      {recordsLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filteredRecords.length === 0 ? (
        <Card className="border-violet-500/10 bg-card/60 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-violet-500/10 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-violet-600 dark:text-violet-400" />
            </div>
            <h3 className="text-lg font-medium mb-1" data-testid="text-empty-title">
              {timePeriod !== "all"
                ? `No records for ${timePeriodLabels[timePeriod].toLowerCase()}`
                : "No attendance records yet"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              {timePeriod !== "all"
                ? "Try selecting a different time period or add new records."
                : "Add individual emails or use batch processing to categorize builder absence excuses with AI."}
            </p>
            {timePeriod === "all" && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setAddDialogOpen(true)}
                  data-testid="button-empty-add"
                  className="border-violet-500/30 hover:bg-violet-500/10"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Email
                </Button>
                <Button
                  onClick={() => setBatchDialogOpen(true)}
                  data-testid="button-empty-batch"
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                >
                  <RefreshCw className="w-4 h-4 mr-1.5" />
                  Batch Process
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <RecordsTable records={filteredRecords} timePeriod={timePeriodLabels[timePeriod]} />
      )}

      <AddEmailDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      <BatchUploadDialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen} />
      <GmailFetchDialog open={gmailDialogOpen} onOpenChange={setGmailDialogOpen} />
    </div>
  );
}
