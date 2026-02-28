import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Mail, Building2 } from "lucide-react";
import type { Cohort } from "@shared/schema";

interface Instructor {
  id: number;
  username: string;
  email: string;
  displayName: string;
  role: string;
}

export default function InstructorsPage() {
  const { data: instructors = [] } = useQuery<Instructor[]>({
    queryKey: ["/api/instructors"],
  });

  const { data: cohorts = [] } = useQuery<Cohort[]>({
    queryKey: ["/api/cohorts"],
  });

  const getCohorts = (instructorId: number) => cohorts.filter(c => c.instructorId === instructorId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" data-testid="text-page-title">Instructors</h2>
        <p className="text-sm text-muted-foreground">{instructors.length} instructor{instructors.length !== 1 ? "s" : ""} registered</p>
      </div>

      {instructors.length === 0 ? (
        <Card className="border-violet-500/10 bg-card/60 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="w-12 h-12 text-violet-400 mb-4" />
            <h3 className="text-lg font-medium mb-1">No instructors yet</h3>
            <p className="text-sm text-muted-foreground">Instructors will appear here after they register.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {instructors.map(inst => {
            const assignedCohorts = getCohorts(inst.id);
            return (
              <Card key={inst.id} className="border-violet-500/10 bg-card/60 backdrop-blur-sm" data-testid={`card-instructor-${inst.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-11 w-11 rounded-full bg-gradient-to-br from-violet-500/30 to-indigo-500/30 flex items-center justify-center text-lg font-bold">
                      {inst.displayName.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{inst.displayName}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                        <Mail className="w-3 h-3 flex-shrink-0" /> {inst.email}
                      </p>
                    </div>
                    <Badge variant="outline" className="border-violet-500/30 text-xs flex-shrink-0">{inst.role}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Building2 className="w-3.5 h-3.5" />
                    {assignedCohorts.length === 0
                      ? "No classes assigned"
                      : `Classes: ${assignedCohorts.map(c => c.name).join(", ")}`
                    }
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
