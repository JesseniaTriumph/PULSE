import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2, Eye, Mail, MessageSquare, Hash } from "lucide-react";
import type { AttendanceRecord } from "@shared/schema";
import { excuseCategories } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const categoryBadgeColors: Record<string, string> = {
  "Sick/Medical": "bg-rose-500/20 text-rose-300 border-rose-500/30",
  Personal: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "Program Event": "bg-sky-500/20 text-sky-300 border-sky-500/30",
  "Technical Issue": "bg-violet-500/20 text-violet-300 border-violet-500/30",
  Other: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  None: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  Unexcused: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

const typeBadgeColors: Record<string, string> = {
  Absent: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  "Late/Tardy": "bg-orange-500/20 text-orange-300 border-orange-500/30",
  Unexcused: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

interface RecordsTableProps {
  records: AttendanceRecord[];
  timePeriod?: string;
}

export function RecordsTable({ records, timePeriod }: RecordsTableProps) {
  const [viewRecord, setViewRecord] = useState<AttendanceRecord | null>(null);
  const { toast } = useToast();

  const handleCategoryChange = async (id: number, category: string) => {
    try {
      await apiRequest("PATCH", `/api/records/${id}/category`, { category });
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Category updated" });
    } catch {
      toast({ title: "Failed to update category", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiRequest("DELETE", `/api/records/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Record deleted" });
    } catch {
      toast({ title: "Failed to delete record", variant: "destructive" });
    }
  };

  return (
    <>
      <div className="print-header" style={{ display: "none" }}>
        <h1 style={{ fontSize: "22px", fontWeight: "bold", marginBottom: "4px" }}>PULSE - Attendance Report</h1>
        <p style={{ fontSize: "13px", color: "#666" }}>
          Period: {timePeriod || "All Time"} | Total Records: {records.length} | Generated: {new Date().toLocaleDateString()}
        </p>
      </div>

      <div className="rounded-md border border-violet-500/10 bg-card/60 backdrop-blur-sm">
        <Table className="print-table">
          <TableHeader>
            <TableRow className="border-violet-500/10 hover:bg-transparent">
              <TableHead className="w-[50px]">Source</TableHead>
              <TableHead className="w-[140px]">Name</TableHead>
              <TableHead className="w-[180px] hidden md:table-cell">Email</TableHead>
              <TableHead className="w-[90px]">Date</TableHead>
              <TableHead className="w-[100px]">Type</TableHead>
              <TableHead className="w-[150px]">Reason</TableHead>
              <TableHead className="hidden lg:table-cell">Snippet</TableHead>
              <TableHead className="w-[90px] text-right no-print">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => (
              <TableRow key={record.id} data-testid={`row-record-${record.id}`} className="border-violet-500/10 hover:bg-violet-500/5">
                <TableCell data-testid={`badge-source-${record.id}`}>
                  {(record.source || "gmail") === "gmail" ? (
                    <div className="flex flex-col items-center gap-0.5" title={record.emailSubject ? `Subject: ${record.emailSubject}` : "Gmail"}>
                      <Mail className="w-4 h-4 text-blue-400" />
                      <span className="text-[10px] text-blue-400/70">Gmail</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-0.5" title={record.slackIsDm ? "Slack DM" : `Slack: ${record.slackChannelName || "channel"}`}>
                      <MessageSquare className="w-4 h-4 text-green-400" />
                      <span className="text-[10px] text-green-400/70">
                        {record.slackIsDm ? "DM" : (record.slackChannelName || "Slack")}
                      </span>
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-medium" data-testid={`text-name-${record.id}`}>
                  <div>
                    {record.senderName}
                    {(record.source || "gmail") === "gmail" && record.emailSubject && (
                      <p className="text-[11px] text-muted-foreground truncate max-w-[140px]" title={record.emailSubject}>
                        {record.emailSubject}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground text-sm" data-testid={`text-email-${record.id}`}>
                  {record.senderEmail}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(record.receivedAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Badge className={`text-xs border ${typeBadgeColors[record.attendanceType] || "bg-slate-500/20 text-slate-300 border-slate-500/30"}`} data-testid={`badge-type-${record.id}`}>
                    {record.attendanceType || "Absent"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="no-print">
                    <Select
                      value={record.excuseCategory}
                      onValueChange={(val) => handleCategoryChange(record.id, val)}
                    >
                      <SelectTrigger className="h-8 w-[150px] border-violet-500/20" data-testid={`select-category-${record.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {excuseCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            <Badge className={`text-xs border ${categoryBadgeColors[cat] || ""}`}>
                              {cat}
                            </Badge>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <span className="hidden print-category">{record.excuseCategory}</span>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground max-w-[300px] truncate">
                  {record.messageSnippet}
                </TableCell>
                <TableCell className="no-print">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setViewRecord(record)}
                      data-testid={`button-view-${record.id}`}
                      className="hover:bg-violet-500/10"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(record.id)}
                      data-testid={`button-delete-${record.id}`}
                      className="hover:bg-rose-500/10 hover:text-rose-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!viewRecord} onOpenChange={() => setViewRecord(null)}>
        <DialogContent className="max-w-lg border-violet-500/20 bg-card/95 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle>{viewRecord?.source === "slack" ? "Message Details" : "Email Details"}</DialogTitle>
          </DialogHeader>
          {viewRecord && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Name
                  </p>
                  <p className="text-sm font-medium" data-testid="text-detail-name">
                    {viewRecord.senderName}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Email
                  </p>
                  <p className="text-sm" data-testid="text-detail-email">
                    {viewRecord.senderEmail}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Date
                  </p>
                  <p className="text-sm">
                    {new Date(viewRecord.receivedAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Source
                  </p>
                  <div className="flex items-center gap-1.5" data-testid="text-detail-source">
                    {(viewRecord.source || "gmail") === "gmail" ? (
                      <>
                        <Mail className="w-4 h-4 text-blue-400" />
                        <span className="text-sm text-blue-400">Gmail</span>
                      </>
                    ) : (
                      <>
                        <MessageSquare className="w-4 h-4 text-green-400" />
                        <span className="text-sm text-green-400">
                          {viewRecord.slackIsDm ? "Slack DM" : `Slack — ${viewRecord.slackChannelName || "channel"}`}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Type
                  </p>
                  <Badge className={`border ${typeBadgeColors[viewRecord.attendanceType] || "bg-slate-500/20 text-slate-300 border-slate-500/30"}`}>
                    {viewRecord.attendanceType || "Absent"}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Reason
                  </p>
                  <Badge className={`border ${categoryBadgeColors[viewRecord.excuseCategory] || ""}`}>
                    {viewRecord.excuseCategory}
                  </Badge>
                </div>
              </div>
              {(viewRecord.source || "gmail") === "gmail" && viewRecord.emailSubject && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Email Subject
                  </p>
                  <p className="text-sm" data-testid="text-detail-subject">{viewRecord.emailSubject}</p>
                </div>
              )}
              {(viewRecord.mentionsStudent || viewRecord.mentionsSchool) && (
                <div className={`rounded-md border p-3 ${viewRecord.mentionsStudent ? "border-cyan-500/20 bg-cyan-500/5" : "border-emerald-500/20 bg-emerald-500/5"}`}>
                  <p className={`text-xs font-medium uppercase tracking-wide mb-1 ${viewRecord.mentionsStudent ? "text-cyan-400" : "text-emerald-400"}`}>
                    {viewRecord.mentionsStudent ? "⚠ Mentions Another Student" : "⚠ School/Program Report"}
                  </p>
                  <p className="text-sm" data-testid="text-detail-peer-school">
                    {viewRecord.peerOrSchoolDetail || "Details flagged by AI — review email body below"}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  {viewRecord.source === "slack" ? "Full Message" : "Full Email Body"}
                </p>
                <div className="rounded-md bg-background/60 border border-violet-500/10 p-3 text-sm whitespace-pre-wrap max-h-60 overflow-auto" data-testid="text-detail-body">
                  {viewRecord.emailBody}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
