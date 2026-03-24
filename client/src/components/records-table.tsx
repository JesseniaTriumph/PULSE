import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Trash2, Eye, Mail, MessageSquare, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Send, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import type { AttendanceRecord, LmsConfig } from "@shared/schema";
import { excuseCategories, assessmentActions } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn, getPercentageWidthClass } from "@/lib/utils";

const categoryBadgeColors: Record<string, string> = {
  Medical: "bg-rose-500/20 text-rose-700 border-rose-500/40 dark:text-rose-300 dark:border-rose-500/30",
  Family: "bg-amber-500/20 text-amber-800 border-amber-500/40 dark:text-amber-300 dark:border-amber-500/30",
  Administrative: "bg-sky-500/20 text-sky-700 border-sky-500/40 dark:text-sky-300 dark:border-sky-500/30",
  Technical: "bg-violet-500/20 text-violet-700 border-violet-500/40 dark:text-violet-300 dark:border-violet-500/30",
  Networking: "bg-teal-500/20 text-teal-700 border-teal-500/40 dark:text-teal-300 dark:border-teal-500/30",
  Other: "bg-emerald-500/20 text-emerald-700 border-emerald-500/40 dark:text-emerald-300 dark:border-emerald-500/30",
  Unexcused: "bg-slate-500/20 text-slate-700 border-slate-500/40 dark:text-slate-300 dark:border-slate-500/30",
};

const typeBadgeColors: Record<string, string> = {
  Absent: "bg-rose-500/20 text-rose-700 border-rose-500/40 dark:text-rose-300 dark:border-rose-500/30",
  "Late/Tardy": "bg-orange-500/20 text-orange-700 border-orange-500/40 dark:text-orange-300 dark:border-orange-500/30",
  Unexcused: "bg-slate-500/20 text-slate-700 border-slate-500/40 dark:text-slate-300 dark:border-slate-500/30",
};

interface RecordsTableProps {
  records: AttendanceRecord[];
  timePeriod?: string;
}

const actionLabels: Record<string, string> = {
  none: "No action",
  excuse: "Excuse absence",
  zero_out: "Zero out grade",
  makeup_allowed: "Allow makeup",
};

const CATEGORY_PRIORITY: Record<string, number> = {
  Unexcused: 0,
  Medical: 1,
  Family: 2,
  Administrative: 3,
  Technical: 4,
  Networking: 5,
  Other: 6,
};

function sortRecords(records: AttendanceRecord[]): AttendanceRecord[] {
  return [...records].sort((a, b) => {
    // 1. Needs review first
    if (a.requiresManualReview && !b.requiresManualReview) return -1;
    if (!a.requiresManualReview && b.requiresManualReview) return 1;
    // 2. By category priority
    const aPriority = CATEGORY_PRIORITY[a.excuseCategory] ?? 7;
    const bPriority = CATEGORY_PRIORITY[b.excuseCategory] ?? 7;
    if (aPriority !== bPriority) return aPriority - bPriority;
    // 3. Newest first within same category
    return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
  });
}

export function RecordsTable({ records, timePeriod }: RecordsTableProps) {
  const [viewRecord, setViewRecord] = useState<AttendanceRecord | null>(null);
  const [syncAction, setSyncAction] = useState<string>("excuse");
  const [syncing, setSyncing] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const { data: lmsConfigs = [] } = useQuery<LmsConfig[]>({
    queryKey: ["/api/lms-configs"],
  });

  const hasLms = lmsConfigs.some(c => c.enabled);

  const handleLmsSync = async (record: AttendanceRecord) => {
    if (!hasLms) {
      toast({ title: "No LMS configured", description: "Add an LMS connection in Settings first.", variant: "destructive" });
      return;
    }
    setSyncing(true);
    try {
      await apiRequest("POST", `/api/records/${record.id}/lms-sync`, { action: syncAction });
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      toast({ title: "Synced to LMS", description: `Action: ${actionLabels[syncAction]}` });
      // refresh viewRecord data
      setViewRecord(prev => prev ? { ...prev, lmsSynced: true, lmsSyncStatus: "success", assessmentAction: syncAction } : prev);
    } catch {
      toast({ title: "LMS sync failed", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handleDraftReply = async (record: AttendanceRecord) => {
    setDraftLoading(true);
    try {
      const res = await apiRequest("POST", "/api/ai/draft-reply", { recordId: record.id });
      const data = await res.json();
      if (data.draft) setReplyBody(data.draft);
    } catch {
      // silent — instructor can type manually
    } finally {
      setDraftLoading(false);
    }
  };

  const handleSendReply = async (record: AttendanceRecord) => {
    if (!replyBody.trim()) return;
    setSending(true);
    try {
      if (record.source === "slack") {
        await apiRequest("POST", "/api/slack/send", {
          channelId: record.slackChannelId,
          threadTs: record.slackMessageTs || undefined,
          body: replyBody,
        });
      } else {
        await apiRequest("POST", "/api/gmail/send", {
          to: record.senderEmail,
          subject: `Re: ${record.emailSubject || record.messageSnippet?.substring(0, 60) || "Your message"}`,
          body: replyBody,
          inReplyTo: record.gmailMessageId || undefined,
          threadId: record.gmailThreadId || undefined,
        });
      }
      toast({ title: record.source === "slack" ? "Slack reply sent" : "Reply sent" });
      setReplyOpen(false);
      setReplyBody("");
    } catch {
      toast({
        title: record.source === "slack"
          ? "Failed to send Slack reply — connect Slack in Settings or check the Slack setup"
          : "Failed to send reply — ensure Google account is connected",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

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
      <div className="print-header hidden">
        <h1>PULSE - Attendance Report</h1>
        <p>
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
            {sortRecords(records).map((record) => (
              <TableRow key={record.id} data-testid={`row-record-${record.id}`} className={`border-violet-500/10 hover:bg-violet-500/5 ${record.requiresManualReview ? "bg-yellow-500/5" : ""}`}>
                <TableCell data-testid={`badge-source-${record.id}`}>
                  {(record.source || "gmail") === "gmail" ? (
                    <div className="flex flex-col items-center gap-0.5" title={record.emailSubject ? `Subject: ${record.emailSubject}` : "Gmail"}>
                      <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-[10px] text-blue-600/70 dark:text-blue-400/70">Gmail</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-0.5" title={record.slackIsDm ? "Slack DM" : `Slack: ${record.slackChannelName || "channel"}`}>
                      <MessageSquare className="w-4 h-4 text-green-600 dark:text-green-400" />
                      <span className="text-[10px] text-green-600/70 dark:text-green-400/70">
                        {record.slackIsDm ? "DM" : (record.slackChannelName || "Slack")}
                      </span>
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-medium" data-testid={`text-name-${record.id}`}>
                  <div>
                    <span className="flex items-center gap-1.5">
                      {record.requiresManualReview && (
                        <span title="Low AI confidence — review recommended" data-testid={`icon-review-${record.id}`}>
                          <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                        </span>
                      )}
                      {!record.requiresManualReview && record.urgency === "high" && (
                        <span title="High urgency" className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0 inline-block" />
                      )}
                      {!record.requiresManualReview && record.urgency === "medium" && record.needsResponse && (
                        <span title="Needs reply" className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0 inline-block" />
                      )}
                      {record.senderName}
                    </span>
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
                  <Badge className={`text-xs border ${typeBadgeColors[record.attendanceType] || "bg-slate-500/20 text-slate-700 dark:text-slate-300 border-slate-500/40 dark:border-slate-500/30"}`} data-testid={`badge-type-${record.id}`}>
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
                    {/* Classification method indicator */}
                    {record.aiConfidenceTier ? (
                      <span className={`mt-1 inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                        record.aiConfidenceTier === "high"
                          ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400"
                          : record.aiConfidenceTier === "medium"
                          ? "bg-yellow-500/10 text-yellow-700 border-yellow-500/30 dark:text-yellow-400"
                          : "bg-rose-500/10 text-rose-700 border-rose-500/30 dark:text-rose-400"
                      }`}>
                        AI · {record.aiConfidenceTier}
                      </span>
                    ) : (
                      <span className="mt-1 inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-400">
                        Keyword
                      </span>
                    )}
                  </div>
                  <span className="hidden print-category">{record.excuseCategory}</span>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground max-w-[300px] truncate">
                  {record.messageSnippet}
                </TableCell>
                <TableCell className="no-print">
                  <div className="flex items-center justify-end gap-1">
                    {record.lmsSynced && (
                      <span title="Synced to LMS" data-testid={`icon-lms-synced-${record.id}`}>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      </span>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => { setViewRecord(record); setSyncAction(record.assessmentAction && record.assessmentAction !== "none" ? record.assessmentAction : "excuse"); }}
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
                      className="hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
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

      <Dialog open={!!viewRecord} onOpenChange={() => { setViewRecord(null); setReplyOpen(false); setReplyBody(""); }}>
        <DialogContent className="max-w-lg border-violet-500/20 bg-card/95 backdrop-blur-md max-h-[90vh] overflow-y-auto">
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
                        <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm text-blue-600 dark:text-blue-400">Gmail</span>
                      </>
                    ) : (
                      <>
                        <MessageSquare className="w-4 h-4 text-green-600 dark:text-green-400" />
                        <span className="text-sm text-green-600 dark:text-green-400">
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
                  <Badge className={`border ${typeBadgeColors[viewRecord.attendanceType] || "bg-slate-500/20 text-slate-700 dark:text-slate-300 border-slate-500/40 dark:border-slate-500/30"}`}>
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
                {viewRecord.urgency && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      Urgency
                    </p>
                    <Badge className={`border text-xs ${
                      viewRecord.urgency === "high"
                        ? "bg-rose-500/20 text-rose-700 border-rose-500/40 dark:text-rose-300"
                        : viewRecord.urgency === "medium"
                        ? "bg-orange-500/20 text-orange-700 border-orange-500/40 dark:text-orange-300"
                        : "bg-slate-500/20 text-slate-600 border-slate-500/30 dark:text-slate-400"
                    }`}>
                      {viewRecord.urgency}
                    </Badge>
                    {viewRecord.needsResponse && (
                      <span className="ml-2 text-xs text-orange-600 dark:text-orange-400 font-medium">· Reply needed</span>
                    )}
                  </div>
                )}
                {viewRecord.aiConfidence == null && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      Classification
                    </p>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-500/10 border border-slate-500/20 px-2 py-0.5 rounded-full">
                      Keyword match
                    </span>
                  </div>
                )}
                {viewRecord.aiConfidence != null && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      AI Confidence
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[80px]">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            getPercentageWidthClass(Math.round((viewRecord.aiConfidence ?? 0) * 100)),
                            viewRecord.aiConfidenceTier === "high" ? "bg-emerald-500" :
                            viewRecord.aiConfidenceTier === "medium" ? "bg-yellow-500" : "bg-rose-500"
                          )}
                          aria-hidden="true"
                        />
                      </div>
                      <span className={`text-xs font-medium ${
                        viewRecord.aiConfidenceTier === "high" ? "text-emerald-600 dark:text-emerald-400" :
                        viewRecord.aiConfidenceTier === "medium" ? "text-yellow-600 dark:text-yellow-400" : "text-rose-600 dark:text-rose-400"
                      }`}>
                        {Math.round((viewRecord.aiConfidence ?? 0) * 100)}% {viewRecord.aiConfidenceTier}
                      </span>
                    </div>
                  </div>
                )}
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
                  <p className={`text-xs font-medium uppercase tracking-wide mb-1 ${viewRecord.mentionsStudent ? "text-cyan-600 dark:text-cyan-400" : "text-emerald-600 dark:text-emerald-400"}`}>
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

              <div className="rounded-md border border-indigo-500/20 bg-indigo-500/5 p-3 space-y-3">
                <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">LMS Sync</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {viewRecord.lmsSynced ? (
                    <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      Synced — {viewRecord.lmsSyncStatus || "success"}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <XCircle className="w-4 h-4" />
                      Not yet synced
                    </span>
                  )}
                  {viewRecord.assessmentAction && viewRecord.assessmentAction !== "none" && (
                    <Badge variant="outline" className="text-xs border-indigo-500/30 text-indigo-700 dark:text-indigo-300">
                      {actionLabels[viewRecord.assessmentAction] ?? viewRecord.assessmentAction}
                    </Badge>
                  )}
                </div>
                {hasLms && (
                  <div className="flex items-center gap-2">
                    <Select value={syncAction} onValueChange={setSyncAction}>
                      <SelectTrigger className="h-8 w-[160px] border-indigo-500/20 text-xs" data-testid="select-lms-sync-action">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {assessmentActions.filter(a => a !== "none").map(a => (
                          <SelectItem key={a} value={a} className="text-xs">{actionLabels[a]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="h-8 bg-gradient-to-r from-indigo-600 to-violet-600 text-xs"
                      onClick={() => handleLmsSync(viewRecord)}
                      disabled={syncing}
                      data-testid="button-lms-sync"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
                      {syncing ? "Syncing…" : "Sync to LMS"}
                    </Button>
                  </div>
                )}
                {!hasLms && (
                  <p className="text-xs text-muted-foreground">No LMS connected — add one in Settings.</p>
                )}
              </div>

              {/* Reply panel */}
              <div className="rounded-md border border-violet-500/20 bg-violet-500/5 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-violet-700 dark:text-violet-300 uppercase tracking-wide">
                    {viewRecord.source === "slack" ? "Reply in Slack" : "Send Reply"}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-violet-600 dark:text-violet-400 hover:bg-violet-500/10"
                    onClick={() => { setReplyOpen(o => !o); if (!replyOpen && !replyBody) handleDraftReply(viewRecord); }}
                  >
                    {replyOpen ? <ChevronUp className="w-3.5 h-3.5 mr-1" /> : <ChevronDown className="w-3.5 h-3.5 mr-1" />}
                    {replyOpen ? "Collapse" : "Compose"}
                  </Button>
                </div>
                {replyOpen && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        To: {viewRecord.source === "slack"
                          ? `#${viewRecord.slackChannelName || viewRecord.slackChannelId}`
                          : viewRecord.senderEmail}
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs text-violet-600 dark:text-violet-400 hover:bg-violet-500/10"
                        onClick={() => handleDraftReply(viewRecord)}
                        disabled={draftLoading}
                      >
                        <Sparkles className={`w-3 h-3 mr-1 ${draftLoading ? "animate-pulse" : ""}`} />
                        {draftLoading ? "Drafting…" : "Re-draft"}
                      </Button>
                    </div>
                    <Textarea
                      value={replyBody}
                      onChange={e => setReplyBody(e.target.value)}
                      placeholder={draftLoading ? "AI is drafting a reply…" : "Type a reply or click Re-draft to generate one…"}
                      className="text-sm min-h-[100px] border-violet-500/20 bg-background/60 resize-none"
                      disabled={draftLoading}
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        className="h-8 bg-gradient-to-r from-violet-600 to-indigo-600 text-xs"
                        onClick={() => handleSendReply(viewRecord)}
                        disabled={!replyBody.trim() || sending || draftLoading}
                      >
                        <Send className="w-3.5 h-3.5 mr-1.5" />
                        {sending ? "Sending…" : viewRecord.source === "slack" ? "Send to Slack" : "Send Email"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
