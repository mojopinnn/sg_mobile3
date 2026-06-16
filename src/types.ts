export interface Note {
  id: number;
  subject: string;
  content: string;
  user: { name: string };
}

export interface Task {
  id: number;
  content: string;
  sg_status_list: string;
  sg_task?: string;
  start_date?: string;
  due_date?: string;
  project: { id: number; name: string };
  entity?: { id: number; name: string; type: string };
  step?: { name: string };
  task_assignees?: Array<{ id: number; name: string; type: string }>;
  notes: Note[];
}

export interface Version {
  id: number;
  code: string;
  sg_status_list: string;
  sg_version_number: number;
  project: { id: number; name: string };
  entity?: { id: number; name: string; type: string };
  description?: string;
}

export interface ParsedTask {
  id: number;
  content: string;
  step: string;
  sg_task?: string;
  assignee_name: string;
  due_date?: string;
  status: string;
}

export interface Shot {
  id: number;
  code: string;
  description?: string;
  image?: string | null;
  sg_org_thumbnail?: string | null;
  sg_status_list?: string;
  sg_work_order?: string | null;
  project: { id: number; name: string };
  parsed_tasks?: ParsedTask[];
}

export interface Project {
  id: number;
  name: string;
  code: string;
  sg_status: string;
  sg_sub_status?: string;
  
  // Computed values
  sg_sub_status_gray?: boolean;
  progress_1?: number;
  progress_2?: number;
  progress_3?: number;
  matte_progress?: number | null;
  comp_progress?: number | null;
}

export interface ShotgridConfig {
  base_url: string;
  script_name: string;
  script_key: string;
  use_mock: boolean;
  settings_password?: string;
}
