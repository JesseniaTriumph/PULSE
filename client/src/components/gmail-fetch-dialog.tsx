import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Check, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";

interface GmailEmail {
  gmailId: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  receivedAt: string;
  emailBody: string;
}

interface GmailFetchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GmailFetchDialog({ open, onOpenChange }: GmailFetchDialogProps) {
  const [query, setQuery] = useState("");
  const [maxResults, setMaxResults] = useState(20);
  const [emails, setEmails] = useState<GmailEmail[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState<"search" | "select">("search");
  const { toast } = useToast();
  const { user } = useAuth();

  const handleFetch = async () => {
    setFetching(true);
    try {
      const res = await apiRequest("POST", "/api/gmail/fetch", {
        query: query || undefined,
        maxResults,
      });
      const data = await res.json();

      if (data.emails.length === 0) {
        toast({ title: "No emails found", description: "Try a different search query." });
        return;
      }

      setEmails(data.emails);
      setSelectedIds(new Set(data.emails.map((e: GmailEmail) => e.gmailId)));
      setStep("select");
    } catch (error: any) {
      if (error.message?.includes("401")) {
        toast({
          title: "Gmail not connected",
          description: "Please sign in with Google to access your Gmail.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to fetch emails",
          description: "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setFetching(false);
    }
  };

  const toggleEmail = (gmailId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(gmailId)) {
        next.delete(gmailId);
      } else {
        next.add(gmailId);
      }
      return next;
    });
  };

  const handleProcess = async () => {
    const selected = emails.filter((e) => selectedIds.has(e.gmailId));
    if (selected.length === 0) {
      toast({ title: "No emails selected", variant: "destructive" });
      return;
    }

    setProcessing(true);
    try {
      const emailInputs = selected.map((e) => ({
        senderName: e.senderName,
        senderEmail: e.senderEmail,
        receivedAt: e.receivedAt,
        emailBody: e.emailBody,
      }));

      const response = await fetch("/api/process-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ emails: emailInputs }),
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let processed = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "progress") processed++;
            if (event.type === "complete") {
              toast({
                title: `Processed ${event.processed} emails from Gmail`,
                description: "Records have been added to your dashboard.",
              });
            }
          } catch {}
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      onOpenChange(false);
      resetState();
    } catch (error) {
      toast({
        title: "Failed to process emails",
        description: "Something went wrong during processing.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const resetState = () => {
    setEmails([]);
    setSelectedIds(new Set());
    setStep("search");
    setQuery("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) resetState();
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col border-violet-500/20 bg-card/95 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            Fetch Emails from Gmail
          </DialogTitle>
          <DialogDescription>
            {step === "search"
              ? "Search your Gmail inbox for absence excuse emails to process."
              : `Found ${emails.length} emails. Select which ones to process with AI.`}
          </DialogDescription>
        </DialogHeader>

        {step === "search" ? (
          <div className="space-y-4">
            {!user?.googleId && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>You need to sign in with Google first to access Gmail.</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="gmail-query">Search Query (optional)</Label>
              <Input
                id="gmail-query"
                data-testid="input-gmail-query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., subject:absent OR subject:excuse (leave blank for default)"
                className="bg-background/50"
              />
              <p className="text-xs text-muted-foreground">
                Default: searches for emails with keywords like absent, excuse, sick, cannot attend
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gmail-max">Max Results</Label>
              <Input
                id="gmail-max"
                data-testid="input-gmail-max-results"
                type="number"
                min={1}
                max={50}
                value={maxResults}
                onChange={(e) => setMaxResults(parseInt(e.target.value) || 20)}
                className="bg-background/50 w-24"
              />
            </div>
            <Button
              onClick={handleFetch}
              disabled={fetching || !user?.googleId}
              data-testid="button-gmail-fetch"
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
            >
              {fetching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching Gmail...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Search Gmail
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} of {emails.length} selected
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedIds(new Set(emails.map((e) => e.gmailId)))}
                  className="border-violet-500/30"
                  data-testid="button-gmail-select-all"
                >
                  Select All
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedIds(new Set())}
                  className="border-violet-500/30"
                  data-testid="button-gmail-deselect-all"
                >
                  Deselect All
                </Button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 max-h-[40vh] space-y-2 pr-1">
              {emails.map((email) => (
                <div
                  key={email.gmailId}
                  onClick={() => toggleEmail(email.gmailId)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedIds.has(email.gmailId)
                      ? "border-violet-500/40 bg-violet-500/10"
                      : "border-violet-500/10 bg-card/60 hover:bg-violet-500/5"
                  }`}
                  data-testid={`gmail-email-${email.gmailId}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                      selectedIds.has(email.gmailId) ? "bg-violet-500 border-violet-500" : "border-muted-foreground/30"
                    }`}>
                      {selectedIds.has(email.gmailId) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm truncate">{email.senderName}</span>
                        <span className="text-xs text-muted-foreground truncate">&lt;{email.senderEmail}&gt;</span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{email.subject}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(email.receivedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2 border-t border-violet-500/10">
              <Button
                variant="outline"
                onClick={() => setStep("search")}
                className="border-violet-500/30"
                data-testid="button-gmail-back"
              >
                Back
              </Button>
              <Button
                onClick={handleProcess}
                disabled={processing || selectedIds.size === 0}
                className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                data-testid="button-gmail-process"
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>Process {selectedIds.size} Email{selectedIds.size !== 1 ? "s" : ""} with AI</>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
