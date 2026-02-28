import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Plus, Trash2, Clock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Schedule, Cohort } from "@shared/schema";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dayNamesShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SchedulePage() {
  const { toast } = useToast();
  const [selectedCohort, setSelectedCohort] = useState<string>("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newEntry, setNewEntry] = useState({ dayOfWeek: "", startTime: "", endTime: "", label: "" });

  const { data: cohorts = [] } = useQuery<Cohort[]>({
    queryKey: ["/api/cohorts"],
  });

  const cohortId = selectedCohort || (cohorts[0]?.id ? String(cohorts[0].id) : "");

  const { data: schedule = [], isLoading } = useQuery<Schedule[]>({
    queryKey: ["/api/schedules", cohortId],
    enabled: !!cohortId,
  });

  const handleAdd = async () => {
    if (!newEntry.dayOfWeek || !newEntry.startTime || !newEntry.endTime || !newEntry.label || !cohortId) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }
    try {
      await apiRequest("POST", "/api/schedules", {
        cohortId: parseInt(cohortId),
        dayOfWeek: parseInt(newEntry.dayOfWeek),
        startTime: newEntry.startTime,
        endTime: newEntry.endTime,
        label: newEntry.label,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/schedules", cohortId] });
      setAddDialogOpen(false);
      setNewEntry({ dayOfWeek: "", startTime: "", endTime: "", label: "" });
      toast({ title: "Schedule entry added" });
    } catch {
      toast({ title: "Failed to add entry", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiRequest("DELETE", `/api/schedules/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/schedules", cohortId] });
      toast({ title: "Entry deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const scheduleByDay: Record<number, Schedule[]> = {};
  for (const entry of schedule) {
    if (!scheduleByDay[entry.dayOfWeek]) scheduleByDay[entry.dayOfWeek] = [];
    scheduleByDay[entry.dayOfWeek].push(entry);
  }

  const currentCohortName = cohorts.find(c => c.id === parseInt(cohortId))?.name || "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-page-title">Class Schedule</h2>
          <p className="text-sm text-muted-foreground">Manage weekly schedule for your classes</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={cohortId} onValueChange={v => setSelectedCohort(v)}>
            <SelectTrigger className="w-[140px] border-violet-500/20" data-testid="select-schedule-cohort">
              <SelectValue placeholder="Select class" />
            </SelectTrigger>
            <SelectContent>
              {cohorts.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setAddDialogOpen(true)} data-testid="button-add-schedule" className="bg-gradient-to-r from-violet-600 to-indigo-600">
            <Plus className="w-4 h-4 mr-1.5" /> Add Block
          </Button>
        </div>
      </div>

      {!cohortId ? (
        <Card className="border-violet-500/10 bg-card/60 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CalendarDays className="w-12 h-12 text-violet-600 dark:text-violet-400 mb-4" />
            <h3 className="text-lg font-medium mb-1">No classes available</h3>
            <p className="text-sm text-muted-foreground">Create a class first to manage schedules.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6, 0].map(day => {
            const entries = scheduleByDay[day] || [];
            const isToday = new Date().getDay() === day;
            return (
              <Card
                key={day}
                className={`border-violet-500/10 bg-card/60 backdrop-blur-sm ${isToday ? "ring-1 ring-violet-500/40" : ""}`}
                data-testid={`card-day-${day}`}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {dayNames[day]}
                    {isToday && <Badge className="bg-violet-500/20 text-violet-700 dark:text-violet-300 border-violet-500/30 text-[10px]">Today</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {entries.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No classes scheduled</p>
                  ) : (
                    entries.map(entry => (
                      <div key={entry.id} className="flex items-center gap-2 bg-violet-500/5 rounded-lg p-2 group" data-testid={`schedule-entry-${entry.id}`}>
                        <Clock className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{entry.label}</p>
                          <p className="text-xs text-muted-foreground">{entry.startTime} - {entry.endTime}</p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="opacity-0 group-hover:opacity-100 h-6 w-6 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
                          onClick={() => handleDelete(entry.id)}
                          data-testid={`button-delete-schedule-${entry.id}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="border-violet-500/20 bg-card/95 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle>Add Schedule Block — {currentCohortName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Day of Week</Label>
              <Select value={newEntry.dayOfWeek} onValueChange={v => setNewEntry(p => ({ ...p, dayOfWeek: v }))}>
                <SelectTrigger className="border-violet-500/20" data-testid="select-schedule-day">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 0].map(d => (
                    <SelectItem key={d} value={String(d)}>{dayNames[d]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Time</Label>
                <Input type="time" value={newEntry.startTime} onChange={e => setNewEntry(p => ({ ...p, startTime: e.target.value }))} className="border-violet-500/20" data-testid="input-schedule-start" />
              </div>
              <div>
                <Label>End Time</Label>
                <Input type="time" value={newEntry.endTime} onChange={e => setNewEntry(p => ({ ...p, endTime: e.target.value }))} className="border-violet-500/20" data-testid="input-schedule-end" />
              </div>
            </div>
            <div>
              <Label>Label</Label>
              <Input value={newEntry.label} onChange={e => setNewEntry(p => ({ ...p, label: e.target.value }))} placeholder="e.g., Morning Session" className="border-violet-500/20" data-testid="input-schedule-label" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAdd} data-testid="button-submit-schedule" className="bg-gradient-to-r from-violet-600 to-indigo-600">
              Add Block
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
