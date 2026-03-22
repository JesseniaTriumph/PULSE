import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileText, Users, AlertTriangle, CheckCircle2, X } from "lucide-react";
import type { Cohort, AttendanceRecord } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ParsedRow {
  name: string;
  email: string;
  cohortId?: string;
  slackUserId?: string;
  error?: string;
}

interface StudentImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Parse CSV / plain-text lines into rows
function parseCsvText(text: string): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  const rows: ParsedRow[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // "Name <email>" format
    const angleMatch = trimmed.match(/^(.+?)\s*<([^>]+)>$/);
    if (angleMatch) {
      rows.push({ name: angleMatch[1].trim(), email: angleMatch[2].trim() });
      continue;
    }

    // CSV columns: name, email[, cohort[, slackUserId]]
    // Handle quoted fields
    const cols = trimmed.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
    if (cols.length >= 2) {
      const [name, email, cohortId, slackUserId] = cols;
      // Skip header row
      if (name.toLowerCase() === "name" || email.toLowerCase() === "email") continue;
      rows.push({ name, email, cohortId: cohortId || undefined, slackUserId: slackUserId || undefined });
      continue;
    }

    rows.push({ name: trimmed, email: "", error: "Could not parse line" });
  }

  return rows;
}

function parseJsonText(text: string): ParsedRow[] {
  try {
    const parsed = JSON.parse(text);
    const arr = Array.isArray(parsed) ? parsed : parsed.students ?? [];
    return arr.map((r: any) => ({
      name: String(r.name || r.Name || "").trim(),
      email: String(r.email || r.Email || "").trim(),
      cohortId: r.cohortId ? String(r.cohortId) : undefined,
      slackUserId: r.slackUserId || r.slack_user_id || undefined,
    }));
  } catch {
    return [{ name: "", email: "", error: "Invalid JSON" }];
  }
}

type Tab = "csv" | "json" | "unmatched";

export function StudentImportDialog({ open, onOpenChange }: StudentImportDialogProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>("csv");
  const [csvText, setCsvText] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [defaultCohortId, setDefaultCohortId] = useState("");
  const [preview, setPreview] = useState<ParsedRow[] | null>(null);
  const [selectedUnmatched, setSelectedUnmatched] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);

  const { data: cohorts = [] } = useQuery<Cohort[]>({ queryKey: ["/api/cohorts"] });

  const { data: records = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/records"],
    enabled: tab === "unmatched",
  });

  const unmatchedSenders = tab === "unmatched"
    ? Array.from(
        records
          .filter(r => !r.studentId && r.senderEmail && !r.senderEmail.startsWith("slack:"))
          .reduce((map, r) => {
            const key = r.senderEmail.toLowerCase();
            if (!map.has(key)) map.set(key, { name: r.senderName, email: r.senderEmail, count: 0 });
            map.get(key)!.count++;
            return map;
          }, new Map<string, { name: string; email: string; count: number }>())
          .values()
      ).sort((a, b) => b.count - a.count)
    : [];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      if (tab === "json" || file.name.endsWith(".json")) {
        setJsonText(text);
      } else {
        setCsvText(text);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handlePreview = () => {
    setResult(null);
    if (tab === "csv") setPreview(parseCsvText(csvText));
    else if (tab === "json") setPreview(parseJsonText(jsonText));
    else {
      setPreview(
        Array.from(selectedUnmatched).map(email => {
          const s = unmatchedSenders.find(u => u.email.toLowerCase() === email);
          return { name: s?.name || "", email: s?.email || "" };
        })
      );
    }
  };

  const validRows = (preview || []).filter(r => r.name && r.email && !r.error);

  const handleImport = async () => {
    if (!defaultCohortId && validRows.some(r => !r.cohortId)) {
      toast({ title: "Select a default class for rows without one", variant: "destructive" });
      return;
    }
    setImporting(true);
    try {
      const res = await apiRequest("POST", "/api/students/import", {
        cohortId: defaultCohortId ? parseInt(defaultCohortId) : undefined,
        students: validRows.map(r => ({
          name: r.name,
          email: r.email,
          cohortId: r.cohortId ? parseInt(r.cohortId) : undefined,
          slackUserId: r.slackUserId,
        })),
      });
      const data = await res.json();
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      setPreview(null);
      setCsvText("");
      setJsonText("");
      setSelectedUnmatched(new Set());
    } catch {
      toast({ title: "Import failed", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setPreview(null);
    setResult(null);
    setCsvText("");
    setJsonText("");
    setSelectedUnmatched(new Set());
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "csv", label: "CSV / Text" },
    { id: "json", label: "JSON" },
    { id: "unmatched", label: "From Records" },
  ];

  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-2xl border-violet-500/20 bg-card/95 backdrop-blur-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-violet-500" /> Import Student Roster
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-2">
            <div className={`flex items-center gap-2 text-sm font-medium ${result.created > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
              <CheckCircle2 className="w-5 h-5" />
              {result.created} student{result.created !== 1 ? "s" : ""} added, {result.skipped} skipped (already exist)
            </div>
            {result.errors.length > 0 && (
              <div className="space-y-1">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" /> {e}
                  </p>
                ))}
              </div>
            )}
            <Button variant="outline" size="sm" onClick={reset} className="border-violet-500/20">Import More</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Tab switcher */}
            <div className="flex gap-1 border-b border-violet-500/10 pb-0">
              {tabs.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { setTab(t.id); setPreview(null); }}
                  className={`px-3 py-1.5 text-sm rounded-t-md transition-colors ${tab === t.id ? "bg-violet-500/10 text-violet-700 dark:text-violet-300 font-medium border border-b-0 border-violet-500/20" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Default cohort selector */}
            <div>
              <Label className="text-xs">Default Class (used when not specified per row)</Label>
              <Select value={defaultCohortId} onValueChange={setDefaultCohortId}>
                <SelectTrigger className="border-violet-500/20 mt-1" data-testid="select-import-cohort">
                  <SelectValue placeholder="Select class…" />
                </SelectTrigger>
                <SelectContent>
                  {cohorts.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Tab content */}
            {tab === "csv" && !preview && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Paste CSV or plain text — one student per line</Label>
                  <button type="button" onClick={() => fileRef.current?.click()} className="text-xs text-violet-600 dark:text-violet-400 underline underline-offset-2">
                    or upload file
                  </button>
                  <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Supported formats: <code className="bg-muted px-1 rounded">Name, Email</code> · <code className="bg-muted px-1 rounded">Name, Email, Class, SlackID</code> · <code className="bg-muted px-1 rounded">Name &lt;email&gt;</code>
                </p>
                <Textarea
                  value={csvText}
                  onChange={e => setCsvText(e.target.value)}
                  placeholder={"Alice Smith, alice@school.com\nBob Jones, bob@school.com, L2\nCarla Reyes <carla@school.com>"}
                  className="border-violet-500/20 font-mono text-xs min-h-[140px]"
                  data-testid="textarea-csv-import"
                />
              </div>
            )}

            {tab === "json" && !preview && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Paste JSON array</Label>
                  <button type="button" onClick={() => fileRef.current?.click()} className="text-xs text-violet-600 dark:text-violet-400 underline underline-offset-2">
                    or upload file
                  </button>
                  <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Fields: <code className="bg-muted px-1 rounded">name</code>, <code className="bg-muted px-1 rounded">email</code>, optional <code className="bg-muted px-1 rounded">cohortId</code>, <code className="bg-muted px-1 rounded">slackUserId</code>
                </p>
                <Textarea
                  value={jsonText}
                  onChange={e => setJsonText(e.target.value)}
                  placeholder={'[{"name":"Alice Smith","email":"alice@school.com"},{"name":"Bob Jones","email":"bob@school.com","cohortId":2}]'}
                  className="border-violet-500/20 font-mono text-xs min-h-[140px]"
                  data-testid="textarea-json-import"
                />
              </div>
            )}

            {tab === "unmatched" && !preview && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  These senders appear in attendance records but aren't matched to any student. Select the ones you want to add to the roster.
                </p>
                {unmatchedSenders.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No unmatched senders found — all records are linked to known students.</p>
                ) : (
                  <div className="border border-violet-500/10 rounded-md divide-y divide-violet-500/10 max-h-56 overflow-y-auto">
                    {unmatchedSenders.map(u => (
                      <label key={u.email} className="flex items-center gap-3 px-3 py-2 hover:bg-violet-500/5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedUnmatched.has(u.email.toLowerCase())}
                          onChange={e => {
                            const next = new Set(selectedUnmatched);
                            if (e.target.checked) next.add(u.email.toLowerCase());
                            else next.delete(u.email.toLowerCase());
                            setSelectedUnmatched(next);
                          }}
                          className="accent-violet-600"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{u.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                        <Badge variant="outline" className="text-xs border-violet-500/20 flex-shrink-0">{u.count} record{u.count !== 1 ? "s" : ""}</Badge>
                      </label>
                    ))}
                  </div>
                )}
                {unmatchedSenders.length > 0 && (
                  <button
                    type="button"
                    className="text-xs text-violet-600 dark:text-violet-400 underline underline-offset-2"
                    onClick={() => setSelectedUnmatched(new Set(unmatchedSenders.map(u => u.email.toLowerCase())))}
                  >
                    Select all
                  </button>
                )}
              </div>
            )}

            {/* Preview table */}
            {preview && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{validRows.length} valid · {preview.filter(r => r.error).length} errors</p>
                  <button type="button" onClick={() => setPreview(null)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <X className="w-3 h-3" /> Edit
                  </button>
                </div>
                <div className="border border-violet-500/10 rounded-md max-h-56 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-violet-500/10">
                        <TableHead className="text-xs">Name</TableHead>
                        <TableHead className="text-xs">Email</TableHead>
                        <TableHead className="text-xs">Class</TableHead>
                        <TableHead className="text-xs w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.map((r, i) => (
                        <TableRow key={i} className={`border-violet-500/10 ${r.error ? "bg-rose-500/5" : ""}`}>
                          <TableCell className="text-xs py-1.5">{r.name || <span className="text-muted-foreground italic">missing</span>}</TableCell>
                          <TableCell className="text-xs py-1.5">{r.email || <span className="text-muted-foreground italic">missing</span>}</TableCell>
                          <TableCell className="text-xs py-1.5">
                            {r.cohortId
                              ? cohorts.find(c => String(c.id) === r.cohortId)?.name ?? r.cohortId
                              : defaultCohortId
                                ? cohorts.find(c => String(c.id) === defaultCohortId)?.name ?? "default"
                                : <span className="text-rose-500">none</span>}
                          </TableCell>
                          <TableCell className="py-1.5">
                            {r.error
                              ? <AlertTriangle className="w-3.5 h-3.5 text-rose-500" title={r.error} />
                              : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}

        {!result && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="border-violet-500/20">Cancel</Button>
            {!preview ? (
              <Button
                onClick={handlePreview}
                disabled={tab === "csv" ? !csvText.trim() : tab === "json" ? !jsonText.trim() : selectedUnmatched.size === 0}
                variant="outline"
                className="border-violet-500/20"
                data-testid="button-preview-import"
              >
                <FileText className="w-4 h-4 mr-1.5" /> Preview
              </Button>
            ) : (
              <Button
                onClick={handleImport}
                disabled={importing || validRows.length === 0}
                className="bg-gradient-to-r from-violet-600 to-indigo-600"
                data-testid="button-confirm-import"
              >
                <Users className="w-4 h-4 mr-1.5" />
                {importing ? "Importing…" : `Import ${validRows.length} Student${validRows.length !== 1 ? "s" : ""}`}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
