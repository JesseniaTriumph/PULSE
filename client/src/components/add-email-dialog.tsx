import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Loader2, Send } from "lucide-react";

interface AddEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddEmailDialog({ open, onOpenChange }: AddEmailDialogProps) {
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [receivedAt, setReceivedAt] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [emailBody, setEmailBody] = useState("");
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!senderName.trim() || !senderEmail.trim() || !emailBody.trim()) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch("/api/process-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails: [
            {
              senderName: senderName.trim(),
              senderEmail: senderEmail.trim(),
              receivedAt: new Date(receivedAt).toISOString(),
              emailBody: emailBody.trim(),
            },
          ],
        }),
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
            if (event.type === "complete") {
              toast({ title: "Email processed and categorized" });
            }
          } catch {}
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setSenderName("");
      setSenderEmail("");
      setEmailBody("");
      setReceivedAt(new Date().toISOString().slice(0, 16));
      onOpenChange(false);
    } catch (error) {
      toast({ title: "Failed to process email", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Email for Processing</DialogTitle>
          <DialogDescription>
            Enter the email details to categorize the absence excuse using AI.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="senderName">Student Name</Label>
            <Input
              id="senderName"
              placeholder="John Doe"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              data-testid="input-sender-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="senderEmail">Student Email</Label>
            <Input
              id="senderEmail"
              type="email"
              placeholder="john@example.com"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              data-testid="input-sender-email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="receivedAt">Date Received</Label>
            <Input
              id="receivedAt"
              type="datetime-local"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
              data-testid="input-received-at"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emailBody">Email Body</Label>
            <Textarea
              id="emailBody"
              placeholder="Hi, I won't be able to attend class today because..."
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              className="min-h-[120px]"
              data-testid="input-email-body"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={processing}
              data-testid="button-cancel-add"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={processing}
              data-testid="button-submit-email"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-1.5" />
                  Process
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
