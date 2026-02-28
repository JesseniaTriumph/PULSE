import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GraduationCap, Plus, Search, ArrowLeft, Trash2, Mail, Calendar } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Student, Cohort, AttendanceRecord } from "@shared/schema";

const categoryBadgeColors: Record<string, string> = {
  "Sick/Medical": "bg-rose-500/20 text-rose-300 border-rose-500/30",
  Personal: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "Program Event": "bg-sky-500/20 text-sky-300 border-sky-500/30",
  "Technical Issue": "bg-violet-500/20 text-violet-300 border-violet-500/30",
  Other: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  None: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

const typeBadgeColors: Record<string, string> = {
  Absent: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  "Late/Tardy": "bg-orange-500/20 text-orange-300 border-orange-500/30",
  Unexcused: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

export default function StudentsPage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterCohort, setFilterCohort] = useState<string>("all");
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: "", email: "", cohortId: "" });

  const { data: students = [], isLoading: studentsLoading } = useQuery<Student[]>({
    queryKey: ["/api/students"],
  });

  const { data: cohorts = [] } = useQuery<Cohort[]>({
    queryKey: ["/api/cohorts"],
  });

  const { data: studentProfile } = useQuery<{ student: Student; records: AttendanceRecord[] }>({
    queryKey: ["/api/students", selectedStudent],
    enabled: !!selectedStudent,
  });

  const filteredStudents = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase());
    const matchCohort = filterCohort === "all" || s.cohortId === parseInt(filterCohort);
    return matchSearch && matchCohort;
  });

  const getCohortName = (cohortId: number) => cohorts.find(c => c.id === cohortId)?.name || "Unknown";

  const handleAddStudent = async () => {
    if (!newStudent.name || !newStudent.email || !newStudent.cohortId) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }
    try {
      await apiRequest("POST", "/api/students", {
        name: newStudent.name,
        email: newStudent.email,
        cohortId: parseInt(newStudent.cohortId),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      setAddDialogOpen(false);
      setNewStudent({ name: "", email: "", cohortId: "" });
      toast({ title: "Student added" });
    } catch {
      toast({ title: "Failed to add student", variant: "destructive" });
    }
  };

  const handleDeleteStudent = async (id: number) => {
    if (!confirm("Delete this student?")) return;
    try {
      await apiRequest("DELETE", `/api/students/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      toast({ title: "Student deleted" });
    } catch {
      toast({ title: "Failed to delete student", variant: "destructive" });
    }
  };

  if (selectedStudent && studentProfile) {
    const { student, records } = studentProfile;
    const absences = records.filter(r => r.attendanceType === "Absent").length;
    const tardies = records.filter(r => r.attendanceType === "Late/Tardy").length;
    const unexcused = records.filter(r => r.attendanceType === "Unexcused").length;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedStudent(null)} data-testid="button-back-roster" className="hover:bg-violet-500/10">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Roster
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold">
            {student.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-2xl font-bold" data-testid="text-student-name">{student.name}</h2>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {student.email}</span>
              <Badge variant="outline" className="border-violet-500/30">{getCohortName(student.cohortId)}</Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-violet-500/10 bg-card/60 backdrop-blur-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Records</p>
              <p className="text-2xl font-bold mt-1" data-testid="text-student-total">{records.length}</p>
            </CardContent>
          </Card>
          <Card className="border-rose-500/20 bg-rose-500/5">
            <CardContent className="p-4">
              <p className="text-xs text-rose-400 uppercase tracking-wide">Absences</p>
              <p className="text-2xl font-bold mt-1 text-rose-400" data-testid="text-student-absences">{absences}</p>
            </CardContent>
          </Card>
          <Card className="border-orange-500/20 bg-orange-500/5">
            <CardContent className="p-4">
              <p className="text-xs text-orange-400 uppercase tracking-wide">Late/Tardy</p>
              <p className="text-2xl font-bold mt-1 text-orange-400" data-testid="text-student-tardies">{tardies}</p>
            </CardContent>
          </Card>
          <Card className="border-slate-500/20 bg-slate-500/5">
            <CardContent className="p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Unexcused</p>
              <p className="text-2xl font-bold mt-1 text-slate-400" data-testid="text-student-unexcused">{unexcused}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-violet-500/10 bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base">Attendance History</CardTitle>
          </CardHeader>
          <CardContent>
            {records.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No attendance records yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-violet-500/10">
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="hidden md:table-cell">Snippet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map(r => (
                    <TableRow key={r.id} className="border-violet-500/10">
                      <TableCell className="text-sm">{new Date(r.receivedAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs border ${typeBadgeColors[r.attendanceType] || ""}`}>{r.attendanceType}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs border ${categoryBadgeColors[r.excuseCategory] || ""}`}>{r.excuseCategory}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[300px] truncate">
                        {r.messageSnippet}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-page-title">Student Roster</h2>
          <p className="text-sm text-muted-foreground">{students.length} students across {cohorts.length} cohorts</p>
        </div>
        <Button size="sm" onClick={() => setAddDialogOpen(true)} data-testid="button-add-student" className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
          <Plus className="w-4 h-4 mr-1.5" /> Add Student
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 border-violet-500/20"
            data-testid="input-search-students"
          />
        </div>
        <Select value={filterCohort} onValueChange={setFilterCohort}>
          <SelectTrigger className="w-[140px] border-violet-500/20" data-testid="select-filter-cohort">
            <SelectValue placeholder="All Cohorts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cohorts</SelectItem>
            {cohorts.map(c => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {studentsLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : filteredStudents.length === 0 ? (
        <Card className="border-violet-500/10 bg-card/60 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <GraduationCap className="w-12 h-12 text-violet-400 mb-4" />
            <h3 className="text-lg font-medium mb-1">No students found</h3>
            <p className="text-sm text-muted-foreground">Add students to your cohorts to start tracking attendance.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStudents.map(student => (
            <Card
              key={student.id}
              className="border-violet-500/10 bg-card/60 backdrop-blur-sm hover:bg-violet-500/5 cursor-pointer transition-all group"
              onClick={() => setSelectedStudent(student.id)}
              data-testid={`card-student-${student.id}`}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500/30 to-indigo-500/30 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {student.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{student.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-violet-500/30 text-xs">{getCohortName(student.cohortId)}</Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-400 h-7 w-7"
                    onClick={(e) => { e.stopPropagation(); handleDeleteStudent(student.id); }}
                    data-testid={`button-delete-student-${student.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="border-violet-500/20 bg-card/95 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle>Add Student</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={newStudent.name} onChange={e => setNewStudent(p => ({ ...p, name: e.target.value }))} placeholder="Student name" className="border-violet-500/20" data-testid="input-student-name" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={newStudent.email} onChange={e => setNewStudent(p => ({ ...p, email: e.target.value }))} placeholder="student@email.com" className="border-violet-500/20" data-testid="input-student-email" />
            </div>
            <div>
              <Label>Cohort</Label>
              <Select value={newStudent.cohortId} onValueChange={v => setNewStudent(p => ({ ...p, cohortId: v }))}>
                <SelectTrigger className="border-violet-500/20" data-testid="select-student-cohort">
                  <SelectValue placeholder="Select cohort" />
                </SelectTrigger>
                <SelectContent>
                  {cohorts.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddStudent} data-testid="button-submit-student" className="bg-gradient-to-r from-violet-600 to-indigo-600">
              Add Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
