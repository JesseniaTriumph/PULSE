import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  Loader2,
  Upload,
  CheckCircle2,
  XCircle,
  FileUp,
  FileText,
  FileImage,
  FileJson,
  Sparkles,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface BatchUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ProcessingStatus {
  total: number;
  processed: number;
  currentName: string;
  errors: number;
  complete: boolean;
}

const ACCEPTED_TYPES =
  ".json,.csv,.txt,.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.gif";

const FILE_TYPE_LABELS: Record<string, { icon: React.ReactNode; label: string }> = {
  "application/pdf": { icon: <FileText className="w-4 h-4 text-red-400" />, label: "PDF" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    icon: <FileText className="w-4 h-4 text-blue-400" />,
    label: "Word",
  },
  "application/msword": { icon: <FileText className="w-4 h-4 text-blue-400" />, label: "Word" },
  "text/plain": { icon: <FileText className="w-4 h-4 text-muted-foreground" />, label: "Text" },
  "text/csv": { icon: <FileJson className="w-4 h-4 text-green-400" />, label: "CSV" },
  "application/json": { icon: <FileJson className="w-4 h-4 text-yellow-400" />, label: "JSON" },
  "image/png": { icon: <FileImage className="w-4 h-4 text-purple-400" />, label: "Image" },
  "image/jpeg": { icon: <FileImage className="w-4 h-4 text-purple-400" />, label: "Image" },
  "image/jpg": { icon: <FileImage className="w-4 h-4 text-purple-400" />, label: "Image" },
  "image/webp": { icon: <FileImage className="w-4 h-4 text-purple-400" />, label: "Image" },
  "image/gif": { icon: <FileImage className="w-4 h-4 text-purple-400" />, label: "Image" },
};

function getFileTypeInfo(file: File) {
  const entry = FILE_TYPE_LABELS[file.type];
  if (entry) return entry;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return FILE_TYPE_LABELS["application/pdf"];
  if (ext === "docx" || ext === "doc") return FILE_TYPE_LABELS["application/msword"];
  if (ext === "csv") return FILE_TYPE_LABELS["text/csv"];
  if (ext === "json") return FILE_TYPE_LABELS["application/json"];
  if (ext === "txt") return FILE_TYPE_LABELS["text/plain"];
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext || ""))
    return FILE_TYPE_LABELS["image/png"];
  return { icon: <FileUp className="w-4 h-4" />, label: ext?.toUpperCase() || "File" };
}

// Types that need AI extraction (binary / unstructured)
const AI_PARSED_EXTS = new Set(["pdf", "doc", "docx", "txt", "png", "jpg", "jpeg", "webp", "gif"]);

export function BatchUploadDialog({ open, onOpenChange }: BatchUploadDialogProps) {
  const [jsonInput, setJsonInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const exampleJson = `[
  {
    "senderName": "Jane Smith",
    "senderEmail": "jane@example.com",
    "receivedAt": "2026-02-25T09:00:00",
    "emailBody": "Hi, I have a doctor's appointment today and won't be able to attend class."
  },
  {
    "senderName": "Mike Johnson",
    "senderEmail": "mike@example.com",
    "receivedAt": "2026-02-25T08:30:00",
    "emailBody": "I have a midterm exam conflict with the scheduled session time."
  }
]`;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const ext = file.name.split(".").pop()?.toLowerCase() || "";

    // JSON: parse directly in browser
    if (ext === "json" || file.type === "application/json") {
      const text = await file.text();
      setJsonInput(text);
      toast({ title: `Loaded JSON file (${file.name})` });
      return;
    }

    // CSV: parse in browser
    if (ext === "csv" || file.type === "text/csv") {
      const text = await file.text();
      try {
        const lines = text.split("\n").filter((l) => l.trim());
        const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, "").toLowerCase());
        const findIdx = (...names: string[]) => {
          for (const n of names) {
            const i = headers.indexOf(n);
            if (i !== -1) return i;
          }
          return -1;
        };
        const nameIdx = findIdx("name", "sendername", "student name");
        const emailIdx = findIdx("email", "senderemail");
        const dateIdx = findIdx("date", "receivedat", "timestamp");
        const bodyIdx = findIdx("body", "emailbody", "message", "reason", "text");

        const emails = lines.slice(1).map((line) => {
          const values = line
            .match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)
            ?.map((v) => v.replace(/^"|"$/g, "").trim()) || [];
          return {
            senderName: nameIdx !== -1 ? values[nameIdx] || "" : values[0] || "",
            senderEmail: emailIdx !== -1 ? values[emailIdx] || "" : values[1] || "",
            receivedAt:
              dateIdx !== -1 && values[dateIdx]
                ? new Date(values[dateIdx]).toISOString()
                : new Date().toISOString(),
            emailBody: bodyIdx !== -1 ? values[bodyIdx] || "" : values[3] || "",
          };
        });
        setJsonInput(JSON.stringify(emails, null, 2));
        toast({ title: `Parsed ${emails.length} rows from CSV` });
      } catch {
        toast({ title: "Failed to parse CSV", variant: "destructive" });
      }
      return;
    }

    // Binary / unstructured: send to server for AI extraction
    if (AI_PARSED_EXTS.has(ext)) {
      setExtracting(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/ingest-file", {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Extraction failed" }));
          throw new Error(err.error || "Extraction failed");
        }
        const { records, count } = await res.json();
        setJsonInput(JSON.stringify(records, null, 2));
        toast({
          title: `AI extracted ${count} record${count !== 1 ? "s" : ""} from ${file.name}`,
        });
      } catch (err: any) {
        toast({ title: err.message || "Failed to extract file", variant: "destructive" });
      } finally {
        setExtracting(false);
      }
    }
  };

  const handleProcess = async () => {
    let emails;
    try {
      emails = JSON.parse(jsonInput);
      if (!Array.isArray(emails) || emails.length === 0) {
        toast({ title: "Please provide an array of records", variant: "destructive" });
        return;
      }
    } catch {
      toast({ title: "Invalid JSON format", variant: "destructive" });
      return;
    }

    setProcessing(true);
    setStatus({ total: emails.length, processed: 0, currentName: "", errors: 0, complete: false });

    try {
      const response = await fetch("/api/process-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ emails }),
      });

      if (!response.ok) throw new Error("Request failed");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "processing") {
              setStatus((prev) => (prev ? { ...prev, currentName: event.name } : null));
            } else if (event.type === "progress") {
              setStatus((prev) => (prev ? { ...prev, processed: prev.processed + 1 } : null));
            } else if (event.type === "error") {
              setStatus((prev) =>
                prev ? { ...prev, errors: prev.errors + 1, processed: prev.processed + 1 } : null,
              );
            } else if (event.type === "complete") {
              setStatus((prev) => (prev ? { ...prev, complete: true } : null));
            }
          } catch {}
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Batch processing complete" });
    } catch {
      toast({ title: "Failed to process batch", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    if (!processing && !extracting) {
      setStatus(null);
      setJsonInput("");
      setSelectedFile(null);
      onOpenChange(false);
    }
  };

  const fileTypeInfo = selectedFile ? getFileTypeInfo(selectedFile) : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Batch Ingest Records</DialogTitle>
          <DialogDescription>
            Upload any file — PDF, Word, image, CSV, JSON, or plain text. AI extracts names,
            emails, and messages automatically.
          </DialogDescription>
        </DialogHeader>

        {status ? (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {status.complete ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                ) : (
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                )}
                <span className="font-medium">
                  {status.complete ? "Processing Complete" : `Processing: ${status.currentName}`}
                </span>
              </div>
              <Badge variant="outline">
                {status.processed} / {status.total}
              </Badge>
            </div>
            <Progress value={(status.processed / status.total) * 100} className="h-2" />
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                {status.processed - status.errors} processed
              </div>
              {status.errors > 0 && (
                <div className="flex items-center gap-1">
                  <XCircle className="w-4 h-4 text-destructive" />
                  {status.errors} failed
                </div>
              )}
            </div>
            {status.complete && (
              <div className="flex justify-end">
                <Button onClick={handleClose} data-testid="button-batch-done">
                  Done
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Tabs defaultValue="upload">
              <TabsList className="w-full">
                <TabsTrigger value="upload" className="flex-1" data-testid="tab-upload">
                  Upload File
                </TabsTrigger>
                <TabsTrigger value="paste" className="flex-1" data-testid="tab-paste">
                  Paste JSON
                </TabsTrigger>
              </TabsList>

              {/* ── Upload tab ─────────────────────────────────────────── */}
              <TabsContent value="upload" className="space-y-3">
                <Label
                  htmlFor="batch-upload-input"
                  className="block border-2 border-dashed rounded-md p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  data-testid="dropzone-upload"
                >
                  {extracting ? (
                    <div className="flex flex-col items-center gap-2">
                      <Sparkles className="w-8 h-8 mx-auto text-primary animate-pulse" />
                      <p className="text-sm font-medium">AI is extracting records…</p>
                      <p className="text-xs text-muted-foreground">
                        Reading {selectedFile?.name}
                      </p>
                    </div>
                  ) : selectedFile && jsonInput ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        {fileTypeInfo?.icon}
                        <span className="text-sm font-medium">{selectedFile.name}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {fileTypeInfo?.label} · ready to process
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        Click to replace file
                      </p>
                    </div>
                  ) : (
                    <>
                      <FileUp className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-sm font-medium mb-1">Click to upload any file</p>
                      <div className="flex flex-wrap gap-1 justify-center mt-2">
                        {["PDF", "Word", "Image", "CSV", "JSON", "TXT"].map((t) => (
                          <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0.5">
                            {t}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        AI extracts names, emails &amp; messages automatically
                      </p>
                    </>
                  )}
                </Label>
                <input
                  id="batch-upload-input"
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  className="hidden"
                  onChange={handleFileSelect}
                  aria-label="Upload file for batch ingestion"
                />

                {jsonInput && !extracting && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-primary" />
                      Extracted Records Preview
                    </Label>
                    <Textarea
                      value={jsonInput}
                      onChange={(e) => setJsonInput(e.target.value)}
                      className="min-h-[140px] font-mono text-xs"
                      data-testid="input-parsed-preview"
                    />
                  </div>
                )}
              </TabsContent>

              {/* ── Paste tab ──────────────────────────────────────────── */}
              <TabsContent value="paste" className="space-y-3">
                <div className="space-y-2">
                  <Label>Email Data (JSON Array)</Label>
                  <Textarea
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    placeholder={exampleJson}
                    className="min-h-[200px] font-mono text-xs"
                    data-testid="input-batch-json"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setJsonInput(exampleJson)}
                  data-testid="button-load-example"
                >
                  Load Example
                </Button>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={extracting}
                data-testid="button-cancel-batch"
              >
                Cancel
              </Button>
              <Button
                onClick={handleProcess}
                disabled={!jsonInput.trim() || extracting}
                data-testid="button-start-batch"
              >
                {extracting ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-1.5" />
                )}
                {extracting ? "Extracting…" : "Process Records"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
