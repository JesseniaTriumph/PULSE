import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, Trash2, Users, GraduationCap, ArrowUpRight } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Cohort, Student } from "@shared/schema";

interface Instructor {
  id: number;
  username: string;
  email: string;
  displayName: string;
  role: string;
}

export default function AdminCohortsPage() {
  const { toast } = useToast();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);
  const [promoteCohortId, setPromoteCohortId] = useState<number | null>(null);
  const [promoteTarget, setPromoteTarget] = useState("");
  const [newCohort, setNewCohort] = useState({ name: "", instructorId: "" });

  const { data: cohorts = [] } = useQuery<Cohort[]>({
    queryKey: ["/api/cohorts"],
  });

  const { data: instructors = [] } = useQuery<Instructor[]>({
    queryKey: ["/api/instructors"],
  });

  const { data: allStudents = [] } = useQuery<Student[]>({
    queryKey: ["/api/students"],
  });

  const handleCreateCohort = async () => {
    if (!newCohort.name || !newCohort.instructorId) {
      toast({ title: "Name and instructor are required", variant: "destructive" });
      return;
    }
    try {
      await apiRequest("POST", "/api/cohorts", {
        name: newCohort.name,
        instructorId: parseInt(newCohort.instructorId),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cohorts"] });
      setAddDialogOpen(false);
      setNewCohort({ name: "", instructorId: "" });
      toast({ title: "Class created" });
    } catch {
      toast({ title: "Failed to create class", variant: "destructive" });
    }
  };

  const handleDeleteCohort = async (id: number) => {
    if (!confirm("Delete this class? All students in it must be removed first.")) return;
    try {
      await apiRequest("DELETE", `/api/cohorts/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/cohorts"] });
      toast({ title: "Class deleted" });
    } catch {
      toast({ title: "Failed to delete class", variant: "destructive" });
    }
  };

  const handleReassignInstructor = async (cohortId: number, newInstructorId: string) => {
    try {
      await apiRequest("PATCH", `/api/cohorts/${cohortId}`, {
        instructorId: parseInt(newInstructorId),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cohorts"] });
      toast({ title: "Instructor reassigned" });
    } catch {
      toast({ title: "Failed to reassign", variant: "destructive" });
    }
  };

  const handlePromoteClass = async () => {
    if (!promoteCohortId || !promoteTarget) return;
    try {
      const result = await apiRequest("POST", `/api/cohorts/${promoteCohortId}/promote`, {
        targetCohortId: promoteTarget,
      });
      const data = await result.json();
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cohorts"] });
      setPromoteDialogOpen(false);
      setPromoteCohortId(null);
      setPromoteTarget("");
      toast({ title: `${data.promoted} students promoted to ${data.targetCohort}` });
    } catch {
      toast({ title: "Failed to promote class", variant: "destructive" });
    }
  };

  const openPromoteDialog = (cohortId: number) => {
    setPromoteCohortId(cohortId);
    setPromoteTarget("");
    setPromoteDialogOpen(true);
  };

  const getStudentCount = (cohortId: number) => allStudents.filter(s => s.cohortId === cohortId).length;
  const getActiveStudentCount = (cohortId: number) => allStudents.filter(s => s.cohortId === cohortId && s.status === "Active").length;
  const promoteCohortName = promoteCohortId ? cohorts.find(c => c.id === promoteCohortId)?.name : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-page-title">Class Management</h2>
          <p className="text-sm text-muted-foreground">{cohorts.length} classes, {instructors.length} instructors</p>
        </div>
        <Button size="sm" onClick={() => setAddDialogOpen(true)} data-testid="button-add-cohort" className="bg-gradient-to-r from-violet-600 to-indigo-600">
          <Plus className="w-4 h-4 mr-1.5" /> New Class
        </Button>
      </div>

      {cohorts.length === 0 ? (
        <Card className="border-violet-500/10 bg-card/60 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="w-12 h-12 text-violet-600 dark:text-violet-400 mb-4" />
            <h3 className="text-lg font-medium mb-1">No classes yet</h3>
            <p className="text-sm text-muted-foreground">Create classes and assign instructors to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {cohorts.map(cohort => {
            const total = getStudentCount(cohort.id);
            const active = getActiveStudentCount(cohort.id);
            return (
              <Card key={cohort.id} className="border-violet-500/10 bg-card/60 backdrop-blur-sm" data-testid={`card-cohort-${cohort.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">{cohort.name}</h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <GraduationCap className="w-3 h-3" />
                          {active} active{total !== active ? ` / ${total} total` : ""} students
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openPromoteDialog(cohort.id)}
                        className="hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 h-8 w-8"
                        title="Promote class"
                        data-testid={`button-promote-cohort-${cohort.id}`}
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteCohort(cohort.id)}
                        className="hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 h-8 w-8"
                        data-testid={`button-delete-cohort-${cohort.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Assigned Instructor</Label>
                    <Select
                      value={String(cohort.instructorId)}
                      onValueChange={v => handleReassignInstructor(cohort.id, v)}
                    >
                      <SelectTrigger className="mt-1 border-violet-500/20" data-testid={`select-instructor-${cohort.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {instructors.map(i => (
                          <SelectItem key={i.id} value={String(i.id)}>{i.displayName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="border-violet-500/20 bg-card/95 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle>Create Class</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Class Name</Label>
              <Input value={newCohort.name} onChange={e => setNewCohort(p => ({ ...p, name: e.target.value }))} placeholder="e.g., L1, L2, L3, L∞" className="border-violet-500/20" data-testid="input-cohort-name" />
            </div>
            <div>
              <Label>Instructor</Label>
              <Select value={newCohort.instructorId} onValueChange={v => setNewCohort(p => ({ ...p, instructorId: v }))}>
                <SelectTrigger className="border-violet-500/20" data-testid="select-cohort-instructor">
                  <SelectValue placeholder="Select instructor" />
                </SelectTrigger>
                <SelectContent>
                  {instructors.map(i => (
                    <SelectItem key={i.id} value={String(i.id)}>{i.displayName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateCohort} data-testid="button-submit-cohort" className="bg-gradient-to-r from-violet-600 to-indigo-600">
              Create Class
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={promoteDialogOpen} onOpenChange={setPromoteDialogOpen}>
        <DialogContent className="border-violet-500/20 bg-card/95 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle>Promote Class — {promoteCohortName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Move all <span className="font-medium text-foreground">active</span> students from {promoteCohortName} to the next class level. Students marked as Graduated or Hired will not be moved.
            </p>
            {promoteCohortId && (
              <p className="text-xs text-muted-foreground">
                {getActiveStudentCount(promoteCohortId)} active student{getActiveStudentCount(promoteCohortId) !== 1 ? "s" : ""} will be moved.
              </p>
            )}
            <div>
              <Label>Move to Class</Label>
              <Select value={promoteTarget} onValueChange={setPromoteTarget}>
                <SelectTrigger className="border-violet-500/20" data-testid="select-promote-target">
                  <SelectValue placeholder="Select target class" />
                </SelectTrigger>
                <SelectContent>
                  {cohorts.filter(c => c.id !== promoteCohortId).map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoteDialogOpen(false)} className="border-violet-500/20">Cancel</Button>
            <Button onClick={handlePromoteClass} disabled={!promoteTarget} data-testid="button-confirm-promote" className="bg-gradient-to-r from-emerald-600 to-teal-600">
              <ArrowUpRight className="w-4 h-4 mr-1.5" /> Promote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
