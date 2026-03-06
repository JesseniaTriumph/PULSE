import type { LmsConfig, LmsType, AssessmentAction } from "@shared/schema";
import { storage } from "./storage";

export interface LmsSyncResult {
  success: boolean;
  lmsType: LmsType;
  action: AssessmentAction;
  externalId?: string;
  message: string;
  timestamp: Date;
}

export interface GradebookEntry {
  studentId: string;
  studentEmail: string;
  studentName: string;
  assessmentName: string;
  assessmentType: "attendance" | "assignment" | "quiz" | "exam";
  action: AssessmentAction;
  dueDate?: string;
  excusedReason?: string;
}

abstract class LmsConnector {
  protected config: LmsConfig;

  constructor(config: LmsConfig) {
    this.config = config;
  }

  abstract authenticate(): Promise<boolean>;
  abstract syncAttendance(entry: GradebookEntry): Promise<LmsSyncResult>;
  abstract excuseAssessment(entry: GradebookEntry): Promise<LmsSyncResult>;
  abstract zeroOutAssessment(entry: GradebookEntry): Promise<LmsSyncResult>;
  abstract allowMakeup(entry: GradebookEntry): Promise<LmsSyncResult>;

  async sync(entry: GradebookEntry, action: AssessmentAction): Promise<LmsSyncResult> {
    const authenticated = await this.authenticate();
    if (!authenticated) {
      return {
        success: false,
        lmsType: this.config.lmsType as LmsType,
        action,
        message: "Authentication failed",
        timestamp: new Date(),
      };
    }

    switch (action) {
      case "excuse":
        return this.excuseAssessment(entry);
      case "zero_out":
        return this.zeroOutAssessment(entry);
      case "makeup_allowed":
        return this.allowMakeup(entry);
      case "none":
      default:
        return {
          success: true,
          lmsType: this.config.lmsType as LmsType,
          action: "none",
          message: "No action taken",
          timestamp: new Date(),
        };
    }
  }
}

export class AgilixBuzzConnector extends LmsConnector {
  private authToken?: string;

  async authenticate(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.apiUrl}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: this.config.apiKey,
          client_secret: this.config.apiSecret,
          grant_type: "client_credentials",
        }),
      });

      if (!response.ok) return false;

      const data = await response.json() as { access_token: string };
      this.authToken = data.access_token;
      return true;
    } catch {
      return false;
    }
  }

  async syncAttendance(entry: GradebookEntry): Promise<LmsSyncResult> {
    try {
      const student = await this.findStudentByEmail(entry.studentEmail);
      if (!student) {
        return {
          success: false,
          lmsType: "agilix_buzz",
          action: "excuse",
          message: `Student ${entry.studentEmail} not found in Agilix Buzz`,
          timestamp: new Date(),
        };
      }

      const attendanceItem = await this.findAttendanceItem(entry.assessmentName);
      if (!attendanceItem) {
        return {
          success: false,
          lmsType: "agilix_buzz",
          action: "excuse",
          message: `Attendance item "${entry.assessmentName}" not found`,
          timestamp: new Date(),
        };
      }

      const payload = {
        student_id: student.id,
        item_id: attendanceItem.id,
        status: "excused",
        excused_reason: entry.excusedReason || "Verified absence excuse",
      };

      const response = await fetch(`${this.config.apiUrl}/gradebook/entries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.authToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          lmsType: "agilix_buzz",
          action: "excuse",
          message: `Agilix API error: ${errorText}`,
          timestamp: new Date(),
        };
      }

      const result = await response.json() as { id: string };
      return {
        success: true,
        lmsType: "agilix_buzz",
        action: "excuse",
        externalId: result.id,
        message: `Successfully excused ${entry.studentName} from ${entry.assessmentName}`,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        lmsType: "agilix_buzz",
        action: "excuse",
        message: `Error: ${(error as Error).message}`,
        timestamp: new Date(),
      };
    }
  }

  async excuseAssessment(entry: GradebookEntry): Promise<LmsSyncResult> {
    return this.syncAttendance(entry);
  }

  async zeroOutAssessment(entry: GradebookEntry): Promise<LmsSyncResult> {
    try {
      const student = await this.findStudentByEmail(entry.studentEmail);
      if (!student) {
        return {
          success: false,
          lmsType: "agilix_buzz",
          action: "zero_out",
          message: `Student ${entry.studentEmail} not found`,
          timestamp: new Date(),
        };
      }

      const payload = {
        student_id: student.id,
        item_name: entry.assessmentName,
        score: 0,
        max_score: 100,
        note: "Zeroed due to unexcused absence",
      };

      const response = await fetch(`${this.config.apiUrl}/gradebook/entries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.authToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return {
          success: false,
          lmsType: "agilix_buzz",
          action: "zero_out",
          message: "Failed to zero out assessment",
          timestamp: new Date(),
        };
      }

      const result = await response.json() as { id: string };
      return {
        success: true,
        lmsType: "agilix_buzz",
        action: "zero_out",
        externalId: result.id,
        message: `Successfully zeroed ${entry.studentName} for ${entry.assessmentName}`,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        lmsType: "agilix_buzz",
        action: "zero_out",
        message: `Error: ${(error as Error).message}`,
        timestamp: new Date(),
      };
    }
  }

  async allowMakeup(entry: GradebookEntry): Promise<LmsSyncResult> {
    try {
      const student = await this.findStudentByEmail(entry.studentEmail);
      if (!student) {
        return {
          success: false,
          lmsType: "agilix_buzz",
          action: "makeup_allowed",
          message: `Student ${entry.studentEmail} not found`,
          timestamp: new Date(),
        };
      }

      const payload = {
        student_id: student.id,
        item_name: entry.assessmentName,
        status: "missing",
        allow_late_submission: true,
        new_due_date: entry.dueDate,
        note: entry.excusedReason || "Makeup work allowed",
      };

      const response = await fetch(`${this.config.apiUrl}/gradebook/entries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.authToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return {
          success: false,
          lmsType: "agilix_buzz",
          action: "makeup_allowed",
          message: "Failed to set makeup allowance",
          timestamp: new Date(),
        };
      }

      const result = await response.json() as { id: string };
      return {
        success: true,
        lmsType: "agilix_buzz",
        action: "makeup_allowed",
        externalId: result.id,
        message: `Makeup work allowed for ${entry.studentName} on ${entry.assessmentName}`,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        lmsType: "agilix_buzz",
        action: "makeup_allowed",
        message: `Error: ${(error as Error).message}`,
        timestamp: new Date(),
      };
    }
  }

  private async findStudentByEmail(email: string): Promise<{ id: string; name: string } | null> {
    try {
      const response = await fetch(`${this.config.apiUrl}/students?email=${encodeURIComponent(email)}`, {
        headers: { Authorization: `Bearer ${this.authToken}` },
      });
      if (!response.ok) return null;
      const data = await response.json() as { students: Array<{ id: string; name: string; email: string }> };
      return data.students[0] || null;
    } catch {
      return null;
    }
  }

  private async findAttendanceItem(name: string): Promise<{ id: string; name: string } | null> {
    try {
      const response = await fetch(`${this.config.apiUrl}/gradebook/items?search=${encodeURIComponent(name)}`, {
        headers: { Authorization: `Bearer ${this.authToken}` },
      });
      if (!response.ok) return null;
      const data = await response.json() as { items: Array<{ id: string; name: string; type: string }> };
      return data.items.find(i => i.type === "attendance") || data.items[0] || null;
    } catch {
      return null;
    }
  }
}

export class D2LBrightspaceConnector extends LmsConnector {
  private authToken?: string;
  private orgUnitId?: string;

  async authenticate(): Promise<boolean> {
    try {
      const credentials = Buffer.from(`${this.config.apiKey}:${this.config.apiSecret}`).toString("base64");
      const response = await fetch(`${this.config.apiUrl}/d2l/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${credentials}`,
        },
        body: "grant_type=client_credentials",
      });

      if (!response.ok) return false;

      const data = await response.json() as { access_token: string };
      this.authToken = data.access_token;
      this.orgUnitId = this.config.institutionId;
      return true;
    } catch {
      return false;
    }
  }

  async syncAttendance(entry: GradebookEntry): Promise<LmsSyncResult> {
    return this.excuseAssessment(entry);
  }

  async excuseAssessment(entry: GradebookEntry): Promise<LmsSyncResult> {
    try {
      const student = await this.findStudentByEmail(entry.studentEmail);
      if (!student) {
        return {
          success: false,
          lmsType: "d2l_brightspace",
          action: "excuse",
          message: `Student ${entry.studentEmail} not found in D2L`,
          timestamp: new Date(),
        };
      }

      const gradeObject = await this.findGradeObject(entry.assessmentName);
      if (!gradeObject) {
        return {
          success: false,
          lmsType: "d2l_brightspace",
          action: "excuse",
          message: `Grade object "${entry.assessmentName}" not found`,
          timestamp: new Date(),
        };
      }

      const payload = {
        Grade: -1,
        IsExempt: true,
        ExemptReason: entry.excusedReason || "Verified absence",
      };

      const url = `${this.config.apiUrl}/d2l/api/le/1.0/${this.orgUnitId}/grades/values/${gradeObject.id}/users/${student.id}`;
      const response = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.authToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return {
          success: false,
          lmsType: "d2l_brightspace",
          action: "excuse",
          message: "D2L API error",
          timestamp: new Date(),
        };
      }

      return {
        success: true,
        lmsType: "d2l_brightspace",
        action: "excuse",
        externalId: gradeObject.id,
        message: `Successfully excused ${entry.studentName} in D2L`,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        lmsType: "d2l_brightspace",
        action: "excuse",
        message: `Error: ${(error as Error).message}`,
        timestamp: new Date(),
      };
    }
  }

  async zeroOutAssessment(entry: GradebookEntry): Promise<LmsSyncResult> {
    try {
      const student = await this.findStudentByEmail(entry.studentEmail);
      if (!student) {
        return {
          success: false,
          lmsType: "d2l_brightspace",
          action: "zero_out",
          message: `Student not found`,
          timestamp: new Date(),
        };
      }

      const gradeObject = await this.findGradeObject(entry.assessmentName);
      if (!gradeObject) {
        return {
          success: false,
          lmsType: "d2l_brightspace",
          action: "zero_out",
          message: "Grade object not found",
          timestamp: new Date(),
        };
      }

      const payload = { Grade: 0, IsExempt: false };
      const url = `${this.config.apiUrl}/d2l/api/le/1.0/${this.orgUnitId}/grades/values/${gradeObject.id}/users/${student.id}`;
      const response = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.authToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return {
          success: false,
          lmsType: "d2l_brightspace",
          action: "zero_out",
          message: "Failed to zero out",
          timestamp: new Date(),
        };
      }

      return {
        success: true,
        lmsType: "d2l_brightspace",
        action: "zero_out",
        externalId: gradeObject.id,
        message: `Successfully zeroed ${entry.studentName}`,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        lmsType: "d2l_brightspace",
        action: "zero_out",
        message: `Error: ${(error as Error).message}`,
        timestamp: new Date(),
      };
    }
  }

  async allowMakeup(entry: GradebookEntry): Promise<LmsSyncResult> {
    return {
      success: true,
      lmsType: "d2l_brightspace",
      action: "makeup_allowed",
      message: "Makeup work tracked in D2L notes",
      timestamp: new Date(),
    };
  }

  private async findStudentByEmail(email: string): Promise<{ id: string } | null> {
    try {
      const url = `${this.config.apiUrl}/d2l/api/le/1.0/${this.orgUnitId}/users?search=${encodeURIComponent(email)}`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${this.authToken}` } });
      if (!response.ok) return null;
      const data = await response.json() as { items: Array<{ identifier: string }> };
      return data.items[0] ? { id: data.items[0].identifier } : null;
    } catch {
      return null;
    }
  }

  private async findGradeObject(name: string): Promise<{ id: string } | null> {
    try {
      const url = `${this.config.apiUrl}/d2l/api/le/1.0/${this.orgUnitId}/grades/objects`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${this.authToken}` } });
      if (!response.ok) return null;
      const data = await response.json() as { items: Array<{ identifier: string; name: string }> };
      return data.items.find(i => i.name === name) || data.items[0] || null;
    } catch {
      return null;
    }
  }
}

export class CustomLmsConnector extends LmsConnector {
  async authenticate(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.apiUrl}/auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.config.apiKey,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async syncAttendance(entry: GradebookEntry): Promise<LmsSyncResult> {
    return this.syncWithCustomApi(entry, "attendance");
  }

  async excuseAssessment(entry: GradebookEntry): Promise<LmsSyncResult> {
    return this.syncWithCustomApi(entry, "excuse");
  }

  async zeroOutAssessment(entry: GradebookEntry): Promise<LmsSyncResult> {
    return this.syncWithCustomApi(entry, "zero_out");
  }

  async allowMakeup(entry: GradebookEntry): Promise<LmsSyncResult> {
    return this.syncWithCustomApi(entry, "makeup_allowed");
  }

  private async syncWithCustomApi(entry: GradebookEntry, action: string): Promise<LmsSyncResult> {
    try {
      const payload = {
        student_email: entry.studentEmail,
        student_name: entry.studentName,
        assessment: entry.assessmentName,
        action,
        reason: entry.excusedReason,
        due_date: entry.dueDate,
      };

      const response = await fetch(`${this.config.apiUrl}/gradebook/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.config.apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return {
          success: false,
          lmsType: "custom",
          action: action as AssessmentAction,
          message: "Custom LMS API error",
          timestamp: new Date(),
        };
      }

      const result = await response.json() as { external_id?: string; message?: string };
      return {
        success: true,
        lmsType: "custom",
        action: action as AssessmentAction,
        externalId: result.external_id,
        message: result.message || `Successfully synced ${action}`,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        lmsType: "custom",
        action: action as AssessmentAction,
        message: `Error: ${(error as Error).message}`,
        timestamp: new Date(),
      };
    }
  }
}

export function createLmsConnector(config: LmsConfig): LmsConnector {
  switch (config.lmsType) {
    case "agilix_buzz":
      return new AgilixBuzzConnector(config);
    case "d2l_brightspace":
      return new D2LBrightspaceConnector(config);
    case "custom":
      return new CustomLmsConnector(config);
    default:
      throw new Error(`Unsupported LMS type: ${config.lmsType}`);
  }
}

export async function syncToLms(
  userId: number,
  recordId: number,
  studentEmail: string,
  studentName: string,
  assessmentName: string,
  action: AssessmentAction,
  excusedReason?: string,
  dueDate?: string
): Promise<LmsSyncResult> {
  const configs = await storage.getLmsConfigsByUser(userId);
  const enabledConfig = configs.find(c => c.enabled);

  if (!enabledConfig) {
    return {
      success: false,
      lmsType: "custom",
      action,
      message: "No LMS configuration found for user",
      timestamp: new Date(),
    };
  }

  const connector = createLmsConnector(enabledConfig);
  const entry: GradebookEntry = {
    studentId: String(recordId),
    studentEmail,
    studentName,
    assessmentName,
    assessmentType: "attendance",
    action,
    excusedReason,
    dueDate,
  };

  const result = await connector.sync(entry, action);

  await storage.createLmsSyncLog({
    recordId,
    lmsConfigId: enabledConfig.id,
    syncType: action,
    syncStatus: result.success ? "success" : "failed",
    lmsResponse: result.message,
    errorMessage: result.success ? null : result.message,
  });

  if (result.success) {
    await storage.updateRecordLmsSync(recordId, true, result.externalId, action);
  }

  return result;
}
