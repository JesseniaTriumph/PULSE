import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, Trash2, Users, GraduationCap } from "lucide-react";
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

  const getInstructorName = (id: number) => instructors.find(i => i.id === id)?.displayName || "Unknown";
  const getStudentCount = (cohortId: number) => allStudents.filter(s => s.cohortId === cohortId).length;

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
            <Building2 className="w-12 h-12 text-violet-400 mb-4" />
            <h3 className="text-lg font-medium mb-1">No classes yet</h3>
            <p className="text-sm text-muted-foreground">Create classes and assign instructors to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {cohorts.map(cohort => (
            <Card key={cohort.id} className="border-violet-500/10 bg-card/60 backdrop-blur-sm" data-testid={`card-cohort-${cohort.id}`}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">{cohort.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <GraduationCap className="w-3 h-3" />
                        {getStudentCount(cohort.id)} students
                      </div>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDeleteCohort(cohort.id)}
                    className="hover:bg-rose-500/10 hover:text-rose-400 h-8 w-8"
                    data-testid={`button-delete-cohort-${cohort.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
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
          ))}
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
    </div>
  );
}
