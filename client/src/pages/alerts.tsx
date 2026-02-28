import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Bell, CheckCheck, AlertTriangle, AlertCircle, Info, Clock, Users, School, Reply, Send, Mail } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Alert } from "@shared/schema";

interface AlertRecord {
  senderName: string;
  senderEmail: string;
  emailBody: string;
  messageSnippet: string;
  gmailMessageId: string | null;
  gmailThreadId: string | null;
}

interface EnrichedAlert extends Alert {
  record: AlertRecord | null;
}

const urgencyConfig = {
  high: { icon: AlertTriangle, color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20", label: "Urgent" },
  medium: { icon: AlertCircle, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", label: "Medium" },
  low: { icon: Info, color: "text-sky-400", bg: "bg-sky-500/10 border-sky-500/20", label: "Low" },
};

export default function AlertsPage() {
  const { toast } = useToast();
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const [replyAlert, setReplyAlert] = useState<EnrichedAlert | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [detailAlert, setDetailAlert] = useState<EnrichedAlert | null>(null);

  const { data: alertsList = [], isLoading } = useQuery<EnrichedAlert[]>({
    queryKey: ["/api/alerts"],
  });

  const { data: googleStatus } = useQuery<{ connected: boolean; hasGmailAccess: boolean }>({
    queryKey: ["/api/auth/google/status"],
  });

  const handleMarkRead = async (id: number) => {
    try {
      await apiRequest("PATCH", `/api/alerts/${id}/read`);
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/unread-count"] });
      toast({ title: "Alert marked as read" });
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  const handleMarkUnread = async (id: number) => {
    try {
      await apiRequest("PATCH", `/api/alerts/${id}/unread`);
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/unread-count"] });
      toast({ title: "Alert marked as unread" });
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiRequest("POST", "/api/alerts/mark-all-read");
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/unread-count"] });
      toast({ title: "All alerts marked as read" });
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  const openReplyDialog = (alert: EnrichedAlert) => {
    setReplyAlert(alert);
    setReplyBody("");
    setReplyDialogOpen(true);
  };

  const handleSendReply = async () => {
    if (!replyAlert?.record || !replyBody.trim()) return;
    setSending(true);
    try {
      const subject = `Re: ${replyAlert.message.substring(0, 80)}`;
      await apiRequest("POST", "/api/gmail/send", {
        to: replyAlert.record.senderEmail,
        subject,
        body: replyBody,
        inReplyTo: replyAlert.record.gmailMessageId || undefined,
        threadId: replyAlert.record.gmailThreadId || undefined,
        alertId: replyAlert.id,
      });
      setReplyDialogOpen(false);
      setReplyAlert(null);
      setReplyBody("");
      if (!replyAlert.isRead) {
        await apiRequest("PATCH", `/api/alerts/${replyAlert.id}/read`);
        queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/alerts/unread-count"] });
      }
      toast({ title: "Reply sent successfully" });
    } catch {
      toast({ title: "Failed to send reply. Make sure your Google account is connected with send permissions.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const unread = alertsList.filter(a => !a.isRead);
  const read = alertsList.filter(a => a.isRead);
  const canSendEmail = googleStatus?.hasGmailAccess;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-page-title">Alerts</h2>
          <p className="text-sm text-muted-foreground">{unread.length} unread alert{unread.length !== 1 ? "s" : ""}</p>
        </div>
        {unread.length > 0 && (
          <Button size="sm" variant="outline" onClick={handleMarkAllRead} data-testid="button-mark-all-read" className="border-violet-500/30 hover:bg-violet-500/10">
            <CheckCheck className="w-4 h-4 mr-1.5" /> Mark All Read
          </Button>
        )}
      </div>

      {!canSendEmail && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-3 flex items-center gap-3 text-sm">
            <Mail className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="text-amber-300">Connect your Google account to reply directly to student emails from this portal.</span>
          </CardContent>
        </Card>
      )}

      {alertsList.length === 0 ? (
        <Card className="border-violet-500/10 bg-card/60 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Bell className="w-12 h-12 text-violet-400 mb-4" />
            <h3 className="text-lg font-medium mb-1">No alerts</h3>
            <p className="text-sm text-muted-foreground">When students send emails that need a response, alerts will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {[...unread, ...read].map(alert => {
            const config = urgencyConfig[alert.urgency as keyof typeof urgencyConfig] || urgencyConfig.low;
            const Icon = config.icon;
            const hasRecord = !!alert.record;
            return (
              <Card
                key={alert.id}
                className={`transition-all cursor-pointer hover:bg-violet-500/5 ${alert.isRead ? "opacity-60 border-violet-500/5 bg-card/30" : `border ${config.bg}`}`}
                data-testid={`card-alert-${alert.id}`}
                onClick={() => setDetailAlert(alert)}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <div className={`mt-0.5 ${config.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge className={`text-xs border ${config.bg} ${config.color}`}>{config.label}</Badge>
                      <Badge variant="outline" className={`text-xs border-violet-500/20 ${alert.alertType === "peer_mention" ? "border-cyan-500/30 text-cyan-300" : alert.alertType === "school_report" ? "border-emerald-500/30 text-emerald-300" : ""}`}>
                        {alert.alertType === "urgent" ? "Urgent Response Needed" : alert.alertType === "peer_mention" ? "Peer Mention" : alert.alertType === "school_report" ? "School/Program Report" : "Action Needed"}
                      </Badge>
                      {alert.alertType === "peer_mention" && <Users className="w-3.5 h-3.5 text-cyan-400" />}
                      {alert.alertType === "school_report" && <School className="w-3.5 h-3.5 text-emerald-400" />}
                      {!alert.isRead && <div className="w-2 h-2 bg-violet-500 rounded-full" />}
                    </div>
                    <p className="text-sm font-medium mb-1">{alert.message}</p>
                    {alert.record && (
                      <p className="text-xs text-muted-foreground mb-1">
                        From: {alert.record.senderName} ({alert.record.senderEmail})
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(alert.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {hasRecord && canSendEmail && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); openReplyDialog(alert); }}
                        data-testid={`button-reply-alert-${alert.id}`}
                        className="hover:bg-violet-500/10 text-xs"
                      >
                        <Reply className="w-3.5 h-3.5 mr-1" /> Reply
                      </Button>
                    )}
                    {alert.isRead && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); handleMarkUnread(alert.id); }}
                        data-testid={`button-unread-alert-${alert.id}`}
                        className="hover:bg-violet-500/10 text-xs"
                      >
                        Mark Unread
                      </Button>
                    )}
                    {!alert.isRead && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); handleMarkRead(alert.id); }}
                        data-testid={`button-read-alert-${alert.id}`}
                        className="hover:bg-violet-500/10 text-xs"
                      >
                        Mark Read
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!detailAlert} onOpenChange={() => setDetailAlert(null)}>
        <DialogContent className="border-violet-500/20 bg-card/95 backdrop-blur-md max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Alert Details
              {detailAlert && (
                <Badge className={`text-xs border ${(urgencyConfig[detailAlert.urgency as keyof typeof urgencyConfig] || urgencyConfig.low).bg} ${(urgencyConfig[detailAlert.urgency as keyof typeof urgencyConfig] || urgencyConfig.low).color}`}>
                  {(urgencyConfig[detailAlert.urgency as keyof typeof urgencyConfig] || urgencyConfig.low).label}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {detailAlert && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">{detailAlert.message}</p>
                <p className="text-xs text-muted-foreground mt-1">{new Date(detailAlert.createdAt).toLocaleString()}</p>
              </div>
              {detailAlert.record && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-medium">{detailAlert.record.senderName}</span>
                    <span className="text-muted-foreground">{detailAlert.record.senderEmail}</span>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 text-sm max-h-[200px] overflow-y-auto whitespace-pre-wrap border border-violet-500/10">
                    {detailAlert.record.emailBody}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {detailAlert?.record && canSendEmail && (
              <Button onClick={() => { setDetailAlert(null); openReplyDialog(detailAlert); }} className="bg-gradient-to-r from-violet-600 to-indigo-600" data-testid="button-reply-from-detail">
                <Reply className="w-4 h-4 mr-1.5" /> Reply to {detailAlert.record.senderName}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
        <DialogContent className="border-violet-500/20 bg-card/95 backdrop-blur-md max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Reply className="w-5 h-5" />
              Reply to {replyAlert?.record?.senderName}
            </DialogTitle>
          </DialogHeader>
          {replyAlert?.record && (
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground space-y-1">
                <p>To: {replyAlert.record.senderEmail}</p>
                <p>Re: {replyAlert.message.substring(0, 80)}</p>
              </div>
              <div className="bg-muted/20 rounded-lg p-3 text-xs max-h-[120px] overflow-y-auto border border-violet-500/10 text-muted-foreground">
                <p className="font-medium mb-1">Original message:</p>
                <p className="whitespace-pre-wrap">{replyAlert.record.messageSnippet}</p>
              </div>
              <div>
                <Label>Your Reply</Label>
                <Textarea
                  value={replyBody}
                  onChange={e => setReplyBody(e.target.value)}
                  placeholder="Type your response..."
                  className="border-violet-500/20 min-h-[120px] mt-1"
                  data-testid="textarea-reply-body"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyDialogOpen(false)} className="border-violet-500/20">Cancel</Button>
            <Button
              onClick={handleSendReply}
              disabled={!replyBody.trim() || sending}
              data-testid="button-send-reply"
              className="bg-gradient-to-r from-violet-600 to-indigo-600"
            >
              {sending ? (
                <>Sending...</>
              ) : (
                <><Send className="w-4 h-4 mr-1.5" /> Send Reply</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
