import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon, Plus, Trash2, Clock, ScanLine, Mail, Shield } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { ScanConfig } from "@shared/schema";

const defaultTimes = ["10:00", "18:25", "21:55"];
const timeLabels: Record<string, string> = {
  "10:00": "10:00 AM — Morning check",
  "18:25": "6:25 PM — Evening scan",
  "21:55": "9:55 PM — Night scan",
};

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [newTime, setNewTime] = useState("");

  const { data: scanConfigs = [], isLoading } = useQuery<ScanConfig[]>({
    queryKey: ["/api/scan-configs"],
  });

  const handleToggle = async (id: number, currentEnabled: boolean) => {
    try {
      await apiRequest("PATCH", `/api/scan-configs/${id}`, { enabled: !currentEnabled });
      queryClient.invalidateQueries({ queryKey: ["/api/scan-configs"] });
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  const handleAdd = async (time?: string) => {
    const t = time || newTime;
    if (!t) {
      toast({ title: "Please enter a time", variant: "destructive" });
      return;
    }
    const exists = scanConfigs.some(sc => sc.scanTime === t);
    if (exists) {
      toast({ title: "This scan time already exists", variant: "destructive" });
      return;
    }
    try {
      await apiRequest("POST", "/api/scan-configs", { scanTime: t, enabled: true });
      queryClient.invalidateQueries({ queryKey: ["/api/scan-configs"] });
      setNewTime("");
      toast({ title: `Scan time ${formatTime(t)} added` });
    } catch {
      toast({ title: "Failed to add scan time", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiRequest("DELETE", `/api/scan-configs/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/scan-configs"] });
      toast({ title: "Scan time removed" });
    } catch {
      toast({ title: "Failed to remove", variant: "destructive" });
    }
  };

  const missingDefaults = defaultTimes.filter(t => !scanConfigs.some(sc => sc.scanTime === t));

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold" data-testid="text-page-title">Settings</h2>
        <p className="text-sm text-muted-foreground">Configure automated email scanning and preferences</p>
      </div>

      <Card className="border-violet-500/10 bg-card/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-violet-400" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Username</span>
            <span className="text-sm font-medium" data-testid="text-username">{user?.username}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium" data-testid="text-email">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Role</span>
            <Badge variant="outline" className="border-violet-500/30" data-testid="text-role">{user?.role}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Google Connected</span>
            <Badge
              className={user?.googleId ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-slate-500/20 text-slate-300 border-slate-500/30"}
              data-testid="text-google-status"
            >
              {user?.googleId ? "Connected" : "Not Connected"}
            </Badge>
          </div>
          {!user?.googleId && (
            <div className="pt-2">
              <Button
                size="sm"
                variant="outline"
                className="border-violet-500/30"
                onClick={() => window.location.href = "/api/auth/google"}
                data-testid="button-connect-google"
              >
                <Mail className="w-4 h-4 mr-1.5" /> Connect Google Account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-violet-500/10 bg-card/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-violet-400" />
            Automated Email Scan Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Configure when PULSE automatically scans your Gmail for attendance emails.
            {!user?.googleId && " Connect your Google account first to enable scanning."}
          </p>

          {scanConfigs.length === 0 ? (
            <div className="py-6 text-center">
              <Clock className="w-10 h-10 text-violet-400 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-3">No scan times configured</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {defaultTimes.map(t => (
                  <Button key={t} size="sm" variant="outline" onClick={() => handleAdd(t)} className="border-violet-500/30 hover:bg-violet-500/10" data-testid={`button-add-default-${t.replace(":", "")}`}>
                    <Plus className="w-3 h-3 mr-1" /> {formatTime(t)}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {scanConfigs.map(config => (
                <div key={config.id} className="flex items-center gap-3 bg-violet-500/5 rounded-lg p-3 group" data-testid={`scan-config-${config.id}`}>
                  <Clock className="w-4 h-4 text-violet-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{formatTime(config.scanTime)}</p>
                    <p className="text-xs text-muted-foreground">{timeLabels[config.scanTime] || "Custom scan time"}</p>
                  </div>
                  <Switch
                    checked={config.enabled}
                    onCheckedChange={() => handleToggle(config.id, config.enabled)}
                    data-testid={`switch-scan-${config.id}`}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(config.id)}
                    className="opacity-0 group-hover:opacity-100 h-7 w-7 hover:bg-rose-500/10 hover:text-rose-400"
                    data-testid={`button-delete-scan-${config.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {scanConfigs.length > 0 && missingDefaults.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="text-xs text-muted-foreground self-center mr-1">Add default:</span>
              {missingDefaults.map(t => (
                <Button key={t} size="sm" variant="outline" onClick={() => handleAdd(t)} className="border-violet-500/20 hover:bg-violet-500/10 text-xs h-7" data-testid={`button-add-default-${t.replace(":", "")}`}>
                  <Plus className="w-3 h-3 mr-1" /> {formatTime(t)}
                </Button>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-violet-500/10">
            <Input
              type="time"
              value={newTime}
              onChange={e => setNewTime(e.target.value)}
              className="border-violet-500/20 w-[140px]"
              data-testid="input-custom-time"
            />
            <Button size="sm" onClick={() => handleAdd()} disabled={!newTime} className="bg-gradient-to-r from-violet-600 to-indigo-600" data-testid="button-add-custom-time">
              <Plus className="w-4 h-4 mr-1" /> Add Custom Time
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
