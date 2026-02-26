import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Stethoscope,
  GraduationCap,
  Home,
  Wifi,
  XCircle,
  FileDown,
  FileText,
  Plus,
  Trash2,
  RefreshCw,
} from "lucide-react";
import type { AttendanceRecord } from "@shared/schema";
import { RecordsTable } from "@/components/records-table";
import { AddEmailDialog } from "@/components/add-email-dialog";
import { BatchUploadDialog } from "@/components/batch-upload-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const categoryConfig: Record<
  string,
  { icon: typeof Users; color: string; bgClass: string }
> = {
  Medical: {
    icon: Stethoscope,
    color: "text-red-600 dark:text-red-400",
    bgClass: "bg-red-50 dark:bg-red-950/30",
  },
  Academic: {
    icon: GraduationCap,
    color: "text-blue-600 dark:text-blue-400",
    bgClass: "bg-blue-50 dark:bg-blue-950/30",
  },
  "Personal/Family": {
    icon: Home,
    color: "text-amber-600 dark:text-amber-400",
    bgClass: "bg-amber-50 dark:bg-amber-950/30",
  },
  "Technical/Other": {
    icon: Wifi,
    color: "text-purple-600 dark:text-purple-400",
    bgClass: "bg-purple-50 dark:bg-purple-950/30",
  },
  Unexcused: {
    icon: XCircle,
    color: "text-gray-600 dark:text-gray-400",
    bgClass: "bg-gray-50 dark:bg-gray-950/30",
  },
};

export default function Dashboard() {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: records = [], isLoading: recordsLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/records"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<{
    total: number;
    byCategory: Record<string, number>;
  }>({
    queryKey: ["/api/stats"],
  });

  const filteredRecords = filterCategory
    ? records.filter((r) => r.excuseCategory === filterCategory)
    : records;

  const handleExportCSV = () => {
    window.open("/api/export/csv", "_blank");
  };

  const handleExportDoc = () => {
    window.open("/api/export/doc", "_blank");
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

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">
                Attendance Automator
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Process and categorize student absence excuses
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddDialogOpen(true)}
                data-testid="button-add-email"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add Email
              </Button>
              <Button
                size="sm"
                onClick={() => setBatchDialogOpen(true)}
                data-testid="button-batch-upload"
              >
                <RefreshCw className="w-4 h-4 mr-1.5" />
                Batch Process
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card
              className={`cursor-pointer transition-all ${filterCategory === null ? "ring-2 ring-primary" : ""}`}
              onClick={() => setFilterCategory(null)}
              data-testid="card-stat-total"
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Total
                  </span>
                </div>
                {statsLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <p className="text-2xl font-bold" data-testid="text-stat-total">
                    {stats?.total || 0}
                  </p>
                )}
              </CardContent>
            </Card>

            {Object.entries(categoryConfig).map(([category, config]) => {
              const Icon = config.icon;
              const count = stats?.byCategory[category] || 0;
              return (
                <Card
                  key={category}
                  className={`cursor-pointer transition-all ${config.bgClass} ${filterCategory === category ? "ring-2 ring-primary" : ""}`}
                  onClick={() => setFilterCategory(filterCategory === category ? null : category)}
                  data-testid={`card-stat-${category.toLowerCase().replace(/\//g, "-")}`}
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
                  <Badge variant="secondary" className="ml-2">
                    {filterCategory}
                  </Badge>
                )}
              </h2>
              <Badge variant="outline">{filteredRecords.length}</Badge>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {records.length > 0 && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportCSV}
                    data-testid="button-export-csv"
                  >
                    <FileDown className="w-4 h-4 mr-1.5" />
                    CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportDoc}
                    data-testid="button-export-doc"
                  >
                    <FileText className="w-4 h-4 mr-1.5" />
                    DOC
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleClearAll}
                    className="text-destructive"
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
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-1" data-testid="text-empty-title">
                  No attendance records yet
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm mb-6">
                  Add individual emails or use batch processing to categorize
                  student absence excuses with AI.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setAddDialogOpen(true)}
                    data-testid="button-empty-add"
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    Add Email
                  </Button>
                  <Button
                    onClick={() => setBatchDialogOpen(true)}
                    data-testid="button-empty-batch"
                  >
                    <RefreshCw className="w-4 h-4 mr-1.5" />
                    Batch Process
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <RecordsTable records={filteredRecords} />
          )}
        </div>
      </div>

      <AddEmailDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      <BatchUploadDialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen} />
    </div>
  );
}
