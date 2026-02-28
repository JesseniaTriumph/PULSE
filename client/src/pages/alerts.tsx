import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck, AlertTriangle, AlertCircle, Info, Clock, Users, School } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Alert } from "@shared/schema";

const urgencyConfig = {
  high: { icon: AlertTriangle, color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20", label: "Urgent" },
  medium: { icon: AlertCircle, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", label: "Medium" },
  low: { icon: Info, color: "text-sky-400", bg: "bg-sky-500/10 border-sky-500/20", label: "Low" },
};

export default function AlertsPage() {
  const { toast } = useToast();

  const { data: alertsList = [], isLoading } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
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

  const unread = alertsList.filter(a => !a.isRead);
  const read = alertsList.filter(a => a.isRead);

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
            return (
              <Card
                key={alert.id}
                className={`transition-all ${alert.isRead ? "opacity-60 border-violet-500/5 bg-card/30" : `border ${config.bg}`}`}
                data-testid={`card-alert-${alert.id}`}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <div className={`mt-0.5 ${config.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`text-xs border ${config.bg} ${config.color}`}>{config.label}</Badge>
                      <Badge variant="outline" className={`text-xs border-violet-500/20 ${alert.alertType === "peer_mention" ? "border-cyan-500/30 text-cyan-300" : alert.alertType === "school_report" ? "border-emerald-500/30 text-emerald-300" : ""}`}>
                        {alert.alertType === "urgent" ? "Urgent Response Needed" : alert.alertType === "peer_mention" ? "Peer Mention" : alert.alertType === "school_report" ? "School/Program Report" : "Action Needed"}
                      </Badge>
                      {alert.alertType === "peer_mention" && <Users className="w-3.5 h-3.5 text-cyan-400" />}
                      {alert.alertType === "school_report" && <School className="w-3.5 h-3.5 text-emerald-400" />}
                      {!alert.isRead && <div className="w-2 h-2 bg-violet-500 rounded-full" />}
                    </div>
                    <p className="text-sm font-medium mb-1">{alert.message}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(alert.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!alert.isRead && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleMarkRead(alert.id)}
                      data-testid={`button-read-alert-${alert.id}`}
                      className="hover:bg-violet-500/10 text-xs"
                    >
                      Mark Read
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
