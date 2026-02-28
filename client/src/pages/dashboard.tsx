import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  LogOut,
  Printer,
  Zap,
  Mail,
  Sun,
  Moon,
  Braces,
} from "lucide-react";
import type { AttendanceRecord } from "@shared/schema";
import { RecordsTable } from "@/components/records-table";
import { AddEmailDialog } from "@/components/add-email-dialog";
import { BatchUploadDialog } from "@/components/batch-upload-dialog";
import { GmailFetchDialog } from "@/components/gmail-fetch-dialog";
import { StarField } from "@/components/star-field";
import { useTheme } from "@/components/theme-provider";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
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
    color: "text-rose-400",
    bgClass: "bg-rose-500/10 border-rose-500/20",
    glowClass: "shadow-rose-500/10",
  },
  Personal: {
    icon: User,
    color: "text-amber-400",
    bgClass: "bg-amber-500/10 border-amber-500/20",
    glowClass: "shadow-amber-500/10",
  },
  "Program Event": {
    icon: CalendarCheck,
    color: "text-sky-400",
    bgClass: "bg-sky-500/10 border-sky-500/20",
    glowClass: "shadow-sky-500/10",
  },
  "Technical Issue": {
    icon: Wifi,
    color: "text-violet-400",
    bgClass: "bg-violet-500/10 border-violet-500/20",
    glowClass: "shadow-violet-500/10",
  },
  Other: {
    icon: HelpCircle,
    color: "text-emerald-400",
    bgClass: "bg-emerald-500/10 border-emerald-500/20",
    glowClass: "shadow-emerald-500/10",
  },
  Unexcused: {
    icon: XCircle,
    color: "text-slate-400",
    bgClass: "bg-slate-500/10 border-slate-500/20",
    glowClass: "shadow-slate-500/10",
  },
};

export default function Dashboard() {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [gmailDialogOpen, setGmailDialogOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("all");
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const { data: records = [], isLoading: recordsLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/records"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<{
    total: number;
    byCategory: Record<string, number>;
  }>({
    queryKey: ["/api/stats"],
  });

  const timeFilteredRecords = useMemo(() => {
    const range = getTimePeriodRange(timePeriod);
    if (!range) return records;
    return records.filter((r) => {
      const date = new Date(r.receivedAt);
      return date >= range.start && date <= range.end;
    });
  }, [records, timePeriod]);

  const filteredRecords = filterCategory
    ? timeFilteredRecords.filter((r) => r.excuseCategory === filterCategory)
    : timeFilteredRecords;

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
    <div className="flex flex-col h-full relative">
      <StarField />

      <div className="border-b border-violet-500/10 bg-background/60 backdrop-blur-sm sticky top-0 z-10 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-violet-500/20">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight pulse-glow" data-testid="text-page-title">
                  PULSE
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Welcome, {user?.displayName || "User"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
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
                variant="outline"
                onClick={toggleTheme}
                data-testid="button-theme-toggle"
                className="border-violet-500/30 hover:bg-violet-500/10"
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? <Sun className="w-4 h-4 mr-1.5" /> : <Moon className="w-4 h-4 mr-1.5" />}
                {theme === "dark" ? "Light" : "Dark"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => logout.mutate()}
                data-testid="button-logout"
                disabled={logout.isPending}
                className="hover:bg-violet-500/10"
              >
                <LogOut className="w-4 h-4 mr-1.5" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto relative z-[1]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

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
                  <Users className="w-4 h-4 text-violet-400" />
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

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">
                Records
                {filterCategory && (
                  <Badge variant="secondary" className="ml-2 bg-violet-500/20 text-violet-300 border-violet-500/30">
                    {filterCategory}
                  </Badge>
                )}
              </h2>
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
                  <Users className="w-8 h-8 text-violet-400" />
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
        </div>
      </div>

      <AddEmailDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      <BatchUploadDialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen} />
      <GmailFetchDialog open={gmailDialogOpen} onOpenChange={setGmailDialogOpen} />
    </div>
  );
}
