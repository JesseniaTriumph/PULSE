import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2, Eye } from "lucide-react";
import type { AttendanceRecord } from "@shared/schema";
import { excuseCategories } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const categoryBadgeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  Medical: "destructive",
  Academic: "default",
  "Personal/Family": "secondary",
  "Technical/Other": "outline",
  Unexcused: "secondary",
};

interface RecordsTableProps {
  records: AttendanceRecord[];
}

export function RecordsTable({ records }: RecordsTableProps) {
  const [viewRecord, setViewRecord] = useState<AttendanceRecord | null>(null);
  const { toast } = useToast();

  const handleCategoryChange = async (id: number, category: string) => {
    try {
      await apiRequest("PATCH", `/api/records/${id}/category`, { category });
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Category updated" });
    } catch {
      toast({ title: "Failed to update category", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiRequest("DELETE", `/api/records/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Record deleted" });
    } catch {
      toast({ title: "Failed to delete record", variant: "destructive" });
    }
  };

  return (
    <>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Name</TableHead>
              <TableHead className="w-[200px] hidden md:table-cell">Email</TableHead>
              <TableHead className="w-[100px]">Date</TableHead>
              <TableHead className="w-[170px]">Category</TableHead>
              <TableHead className="hidden lg:table-cell">Snippet</TableHead>
              <TableHead className="w-[90px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => (
              <TableRow key={record.id} data-testid={`row-record-${record.id}`}>
                <TableCell className="font-medium" data-testid={`text-name-${record.id}`}>
                  {record.senderName}
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground text-sm" data-testid={`text-email-${record.id}`}>
                  {record.senderEmail}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(record.receivedAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Select
                    value={record.excuseCategory}
                    onValueChange={(val) => handleCategoryChange(record.id, val)}
                  >
                    <SelectTrigger className="h-8 w-[150px]" data-testid={`select-category-${record.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {excuseCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          <Badge variant={categoryBadgeVariant[cat] || "outline"} className="text-xs">
                            {cat}
                          </Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground max-w-[300px] truncate">
                  {record.messageSnippet}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setViewRecord(record)}
                      data-testid={`button-view-${record.id}`}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(record.id)}
                      data-testid={`button-delete-${record.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!viewRecord} onOpenChange={() => setViewRecord(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Email Details</DialogTitle>
          </DialogHeader>
          {viewRecord && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Name
                  </p>
                  <p className="text-sm font-medium" data-testid="text-detail-name">
                    {viewRecord.senderName}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Email
                  </p>
                  <p className="text-sm" data-testid="text-detail-email">
                    {viewRecord.senderEmail}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Date
                  </p>
                  <p className="text-sm">
                    {new Date(viewRecord.receivedAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Category
                  </p>
                  <Badge variant={categoryBadgeVariant[viewRecord.excuseCategory] || "outline"}>
                    {viewRecord.excuseCategory}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Full Email Body
                </p>
                <div className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap max-h-60 overflow-auto" data-testid="text-detail-body">
                  {viewRecord.emailBody}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
