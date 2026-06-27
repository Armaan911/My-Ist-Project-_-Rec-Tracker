export type Role = "admin" | "manager" | "recruiter" | "hr" | "ai_team";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  division_id: string | null;
  monthly_submission_target: number | null;
  monthly_closure_target: number | null;
  is_active: boolean;
};

export type SubmissionStatus = {
  id: string;
  code: string;
  label: string;
  sort_order: number;
  counts_as_closure: boolean;
  is_rejection: boolean;
  is_terminal: boolean;
  is_active: boolean;
};

// A requirement option shown in the daily-update requirement dropdown.
export type AllocatedReq = {
  id: string;
  title: string;
  job_code: string | null;
  status: string;
  division_id: string;
  division_name?: string | null;
  client_name?: string | null;
};

// Admin-configurable daily metric definition.
export type DailyMetric = {
  id: string;
  key: string;
  label: string;
  hint: string | null;
  color: string;
  icon: string;
  input_style: "slider" | "stepper" | "chips" | "tally" | "dial";
  soft_max: number;
  sort_order: number;
  is_active: boolean;
};

// One per-requirement daily effort row. `values` maps metric_id -> count.
export type DailyItem = {
  requirement_id: string;
  values: Record<string, number>;
  is_locked?: boolean;
};

// Payload the editor sends back when saving a day's work.
export type DailyItemInput = {
  requirement_id: string;
  values: Record<string, number>;
};
