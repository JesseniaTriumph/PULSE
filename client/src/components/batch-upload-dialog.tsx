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
import { Loader2, Upload, CheckCircle2, XCircle, FileUp } from "lucide-react";
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

export function BatchUploadDialog({ open, onOpenChange }: BatchUploadDialogProps) {
  const [jsonInput, setJsonInput] = useState("");
  const [processing, setProcessing] = useState(false);
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (file.name.endsWith(".csv")) {
        try {
          const lines = text.split("\n").filter((l) => l.trim());
          const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
          const emails = lines.slice(1).map((line) => {
            const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map((v) =>
              v.replace(/^"|"$/g, "").trim()
            ) || [];
            return {
              senderName: values[headers.indexOf("Name") !== -1 ? headers.indexOf("Name") : 0] || "",
              senderEmail: values[headers.indexOf("Email") !== -1 ? headers.indexOf("Email") : 1] || "",
              receivedAt: values[headers.indexOf("Date") !== -1 ? headers.indexOf("Date") : 2] || new Date().toISOString(),
              emailBody: values[headers.indexOf("Body") !== -1 ? headers.indexOf("Body") : 3] || values[headers.indexOf("Message") !== -1 ? headers.indexOf("Message") : 3] || "",
            };
          });
          setJsonInput(JSON.stringify(emails, null, 2));
          toast({ title: `Parsed ${emails.length} emails from CSV` });
        } catch {
          toast({ title: "Failed to parse CSV file", variant: "destructive" });
        }
      } else {
        setJsonInput(text);
      }
    };
    reader.readAsText(file);
  };

  const handleProcess = async () => {
    let emails;
    try {
      emails = JSON.parse(jsonInput);
      if (!Array.isArray(emails) || emails.length === 0) {
        toast({ title: "Please provide an array of emails", variant: "destructive" });
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
              setStatus((prev) =>
                prev ? { ...prev, currentName: event.name } : null
              );
            } else if (event.type === "progress") {
              setStatus((prev) =>
                prev ? { ...prev, processed: prev.processed + 1 } : null
              );
            } else if (event.type === "error") {
              setStatus((prev) =>
                prev ? { ...prev, errors: prev.errors + 1, processed: prev.processed + 1 } : null
              );
            } else if (event.type === "complete") {
              setStatus((prev) =>
                prev ? { ...prev, complete: true } : null
              );
            }
          } catch {}
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Batch processing complete" });
    } catch (error) {
      toast({ title: "Failed to process batch", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    if (!processing) {
      setStatus(null);
      setJsonInput("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Batch Process Emails</DialogTitle>
          <DialogDescription>
            Upload multiple emails at once for AI-powered categorization.
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
            <Progress
              value={(status.processed / status.total) * 100}
              className="h-2"
            />
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
            <Tabs defaultValue="paste">
              <TabsList className="w-full">
                <TabsTrigger value="paste" className="flex-1" data-testid="tab-paste">
                  Paste JSON
                </TabsTrigger>
                <TabsTrigger value="upload" className="flex-1" data-testid="tab-upload">
                  Upload File
                </TabsTrigger>
              </TabsList>
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
              <TabsContent value="upload" className="space-y-3">
                <div
                  className="border-2 border-dashed rounded-md p-8 text-center cursor-pointer transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="dropzone-upload"
                >
                  <FileUp className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm font-medium mb-1">
                    Click to upload JSON or CSV file
                  </p>
                  <p className="text-xs text-muted-foreground">
                    CSV format: Name, Email, Date, Body columns
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                {jsonInput && (
                  <div className="space-y-2">
                    <Label>Parsed Data Preview</Label>
                    <Textarea
                      value={jsonInput}
                      onChange={(e) => setJsonInput(e.target.value)}
                      className="min-h-[120px] font-mono text-xs"
                      data-testid="input-parsed-preview"
                    />
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleClose}
                data-testid="button-cancel-batch"
              >
                Cancel
              </Button>
              <Button
                onClick={handleProcess}
                disabled={!jsonInput.trim()}
                data-testid="button-start-batch"
              >
                <Upload className="w-4 h-4 mr-1.5" />
                Process Emails
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
