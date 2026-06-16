import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { Project, Task, Version, Shot, Note, ShotgridConfig } from "./src/types";

const app = express();
const PORT = 3000;

app.use(express.json());

const CONFIG_FILE = path.join(process.cwd(), "config.json");
const MOCK_DB_FILE = path.join(process.cwd(), "mock_db.json");

// Helper: load config
function loadConfig(): ShotgridConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Error reading config:", e);
  }
  return {
    base_url: "",
    script_name: "",
    script_key: "",
    use_mock: true,
    settings_password: "1234",
  };
}

// Helper: save config
function saveConfig(config: ShotgridConfig) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
    return true;
  } catch (e) {
    console.error("Error saving config:", e);
    return false;
  }
}

// Helper: load mock db
function loadMockDB() {
  try {
    if (fs.existsSync(MOCK_DB_FILE)) {
      const data = fs.readFileSync(MOCK_DB_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Error reading mock DB:", e);
  }
  return { projects: [], tasks: [], versions: [], shots: [] };
}

// Helper: save mock db
function saveMockDB(db: any) {
  try {
    fs.writeFileSync(MOCK_DB_FILE, JSON.stringify(db, null, 2), "utf-8");
    return true;
  } catch (e) {
    console.error("Error saving mock DB:", e);
    return false;
  }
}

// Helper: sort parsed tasks in professional VFX pipeline sequence
function sortParsedTasks(parsed_tasks: any[]) {
  const orderWeights: Record<string, number> = {
    "mm": 0, "matchmove": 0,
    "ani": 1, "anim": 1, "animation": 1,
    "lgt": 2, "light": 2, "lighting": 2,
    "fx": 3, "vfx": 3,
    "matte": 4, "matte painting": 4, "matte_painting": 4,
    "comp": 5, "composite": 5, "compositing": 5,
    "roto": 6, "paint": 6,
    "remove": 7, "prep": 7
  };

  const getWeight = (task: any) => {
    const step = (task.step || task.content || "").toLowerCase();
    for (const [k, w] of Object.entries(orderWeights)) {
      if (step.includes(k)) {
        return w;
      }
    }
    return step.includes("comp") ? 100 : 10;
  };

  return [...parsed_tasks].sort((a, b) => getWeight(a) - getWeight(b));
}

// Helper: clean assignee name
function cleanAssigneeName(name: string): string {
  if (!name) return "";
  const trimmed = name.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1].toLowerCase();
    const suffixes = new Set([
      "comp", "fx", "mm", "matte", "roto", "remove", "lgt", "anim", "layout", "vfx", "paint", "matchmove"
    ]);
    if (suffixes.has(lastPart)) {
      return parts.slice(0, parts.length - 1).join(" ");
    }
  }
  return trimmed;
}

// --- SHOTGRID REST API INTEGRATION UTILS ---

async function getAccessToken(config: ShotgridConfig): Promise<string> {
  const baseUrl = config.base_url.replace(/\/+$/, "");
  const url = `${baseUrl}/api/v1/auth/access_token`;
  
  const body = new URLSearchParams();
  body.append("client_id", config.script_name);
  body.append("client_secret", config.script_key);
  body.append("grant_type", "client_credentials");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json"
    },
    body: body.toString()
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`인증 에러 (HTTP ${response.status}): ${text}`);
  }

  const json: any = await response.json();
  return json.access_token;
}

async function fetchShotgridSearch(
  config: ShotgridConfig,
  token: string,
  entityType: string,
  filters: any[],
  fields: string[]
): Promise<any[]> {
  const baseUrl = config.base_url.replace(/\/+$/, "");
  const url = `${baseUrl}/api/v1/entity/${entityType}/_search`;

  let requestFilters: any;
  if (Array.isArray(filters)) {
    requestFilters = {
      logical_operator: "and",
      conditions: filters
    };
  } else {
    requestFilters = filters;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/vnd+shotgun.api3_hash+json",
      "Accept": "application/json"
    },
    body: JSON.stringify({ filters: requestFilters, fields })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`조회 오류 (${entityType} HTTP ${response.status}): ${text}`);
  }

  const json: any = await response.json();

  // Index included documents to resolve names and other fields for relationships
  const includedMap = new Map<string, any>();
  if (json.included && Array.isArray(json.included)) {
    for (const inc of json.included) {
      if (inc && inc.type && inc.id) {
        includedMap.set(`${inc.type}:${inc.id}`, inc.attributes || {});
      }
    }
  }

  return (json.data || []).map((item: any) => {
    const rels: Record<string, any> = {};
    if (item.relationships) {
      for (const [key, rel] of Object.entries(item.relationships)) {
        if (rel && (rel as any).data !== undefined) {
          const relData = (rel as any).data;
          if (Array.isArray(relData)) {
            rels[key] = relData.map((d: any) => {
              const incAttr = includedMap.get(`${d.type}:${d.id}`) || {};
              return {
                id: typeof d.id === "string" ? parseInt(d.id, 10) : d.id,
                type: d.type,
                name: incAttr.name || incAttr.code || incAttr.content || d.name || ""
              };
            });
          } else if (relData !== null) {
            const incAttr = includedMap.get(`${relData.type}:${relData.id}`) || {};
            rels[key] = {
              id: typeof relData.id === "string" ? parseInt(relData.id, 10) : relData.id,
              type: relData.type,
              name: incAttr.name || incAttr.code || incAttr.content || relData.name || ""
            };
          } else {
            rels[key] = null;
          }
        }
      }
    }

    return {
      id: typeof item.id === "string" ? parseInt(item.id, 10) : item.id,
      type: item.type,
      ...item.attributes,
      ...rels
    };
  });
}

async function updateShotgridEntity(
  config: ShotgridConfig,
  token: string,
  entityType: string,
  id: number,
  attributes: Record<string, any>
): Promise<any> {
  const baseUrl = config.base_url.replace(/\/+$/, "");
  const url = `${baseUrl}/api/v1/entity/${entityType}/${id}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/vnd+shotgun.api3_hash+json",
      "Accept": "application/json"
    },
    body: JSON.stringify(attributes)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`수정 요건 오류 (${entityType} HTTP ${response.status}): ${text}`);
  }

  const json: any = await response.json();
  return {
    id: json.data?.id,
    type: json.data?.type,
    ...json.data?.attributes
  };
}

async function createShotgridEntity(
  config: ShotgridConfig,
  token: string,
  entityType: string,
  attributes: Record<string, any>
): Promise<any> {
  const baseUrl = config.base_url.replace(/\/+$/, "");
  const url = `${baseUrl}/api/v1/entity/${entityType}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/vnd+shotgun.api3_hash+json",
      "Accept": "application/json"
    },
    body: JSON.stringify(attributes)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`생성 오류 (${entityType} HTTP ${response.status}): ${text}`);
  }

  const json: any = await response.json();
  return {
    id: json.data?.id,
    type: json.data?.type,
    ...json.data?.attributes
  };
}

async function getProjectsFromShotgrid(config: ShotgridConfig, token: string): Promise<any[]> {
  try {
    let fields = ["id", "name", "code", "sg_status", "sg_sub_status"];
    try {
      return await fetchShotgridSearch(config, token, "Project", [["sg_status", "is", "Active"]], fields);
    } catch (err: any) {
      console.warn("sg_sub_status field missing, falling back...", err.message);
      fields = ["id", "name", "code", "sg_status"];
      return await fetchShotgridSearch(config, token, "Project", [["sg_status", "is", "Active"]], fields);
    }
  } catch (err: any) {
    console.error("Shotgrid project fetch failed:", err);
    throw err;
  }
}

async function fetchTaskNotes(config: ShotgridConfig, token: string, taskId: number): Promise<any[]> {
  try {
    return await fetchShotgridSearch(
      config,
      token,
      "Note",
      [["tasks", "is", { type: "Task", id: taskId }]],
      ["id", "subject", "content", "user"]
    );
  } catch (err) {
    try {
      return await fetchShotgridSearch(
        config,
        token,
        "Note",
        [["note_links", "is", { type: "Task", id: taskId }]],
        ["id", "subject", "content", "user"]
      );
    } catch (err2) {
      console.error("Failed to query Shotgrid notes:", err2);
      return [];
    }
  }
}

// REST API MIDDLEWARE - Log requests
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

// --- API ENDPOINTS ---

// End Point: Check status/config
app.get("/api/config-status", (req, res) => {
  const config = loadConfig();
  res.json({
    use_mock: config.use_mock,
    has_credentials: !!(config.base_url && config.script_name && config.script_key),
  });
});

// GET /api/projects - Projects with progress bars
app.get("/api/projects", async (req, res) => {
  const config = loadConfig();
  let rawProjects: any[] = [];
  let tasks: any[] = [];

  try {
    if (config.use_mock || !config.base_url) {
      const db = loadMockDB();
      rawProjects = db.projects || [];
      tasks = db.tasks || [];
    } else {
      const token = await getAccessToken(config);
      rawProjects = await getProjectsFromShotgrid(config, token);
      tasks = await fetchShotgridSearch(
        config,
        token,
        "Task",
        [],
        ["id", "content", "sg_status_list", "start_date", "due_date", "project", "entity", "step", "task_assignees"]
      );
    }

    const projectsWithProgress = rawProjects
      .filter((p: any) => {
        const subStatus = (p.sg_sub_status || "").toLowerCase().trim();
        return subStatus !== "fin"; // Filter out completed projects
      })
      .map((p: any) => {
        const projTasks = tasks.filter((t: any) => t.project?.id === p.id);
        const totalTasks = projTasks.length;

        const subStatus = (p.sg_sub_status || "").toLowerCase().trim();
        const sg_sub_status_gray = subStatus === "onset" || subStatus === "turn over";

        // 1. Calculate entities that have compound component completed
        const completedCompEntities = new Set<number>();
        for (const t of projTasks) {
          let status = (t.sg_status_list || "").toLowerCase().trim();
          if (["double check", "doublecheck", "dok"].includes(status)) status = "dok";
          else if (["distribute", "di-sen", "dis", "disen"].includes(status)) status = "di-sen";
          else if (["approved", "apr", "final", "fin", "complete"].includes(status)) status = "fin";

          const stepName = t.step?.name || "";
          const content = t.content || "";
          const targetStr = `${stepName} ${content}`.toLowerCase();
          const isComp = targetStr.includes("comp");

          if (isComp && ["dok", "di-sen", "qc", "fin"].includes(status)) {
            if (t.entity?.id) {
              completedCompEntities.add(t.entity.id);
            }
          }
        }

        // 2. Perform stats calculation
        const groupAStatuses = ["dok", "di-sen", "qc"];
        const groupBStatuses = ["fin", "cto", "drt"];
        const groupCStatuses = ["cc", "sc", "ct", "ctp", "ctr"];

        let completedATasks = 0;
        let weight2Total = 0.0;
        let weight3Total = 0.0;
        
        let matteTasks = 0;
        let completedMatte = 0;
        let compTasks = 0;
        let completedComp = 0;

        for (const t of projTasks) {
          let status = (t.sg_status_list || "").toLowerCase().trim();
          if (["double check", "doublecheck", "dok"].includes(status)) status = "dok";
          else if (["distribute", "di-sen", "dis", "disen"].includes(status)) status = "di-sen";
          else if (["approved", "apr", "final", "fin", "complete"].includes(status)) status = "fin";

          const hasCompCompleteForEntity = t.entity?.id ? completedCompEntities.has(t.entity.id) : false;
          const isCompletedA = groupAStatuses.includes(status) || status === "fin" || hasCompCompleteForEntity;

          if (isCompletedA) {
            completedATasks++;
            weight2Total += 1.0;
            weight3Total += 1.0;
          } else {
            if (groupBStatuses.includes(status)) {
              weight2Total += 0.85;
              weight3Total += 0.85;
            } else if (groupCStatuses.includes(status)) {
              weight3Total += 0.75;
            }
          }

          const stepName = t.step?.name || "";
          const content = t.content || "";
          const targetStr = `${stepName} ${content}`.toLowerCase();

          const isMatte = targetStr.includes("matte") || targetStr.includes("matter");
          const isComp = targetStr.includes("comp");

          if (isMatte) {
            matteTasks++;
            if (isCompletedA) completedMatte++;
          }
          if (isComp) {
            compTasks++;
            if (isCompletedA) completedComp++;
          }
        }

        const progress_1 = totalTasks > 0 ? Math.round((completedATasks / totalTasks) * 100) : 0;
        const progress_2 = totalTasks > 0 ? Math.round((weight2Total / totalTasks) * 100) : 0;
        const progress_3 = totalTasks > 0 ? Math.round((weight3Total / totalTasks) * 100) : 0;

        const matte_progress = matteTasks > 0 ? Math.round((completedMatte / matteTasks) * 100) : null;
        const comp_progress = compTasks > 0 ? Math.round((completedComp / compTasks) * 100) : null;

        return {
          ...p,
          sg_sub_status_gray,
          progress_1,
          progress_2,
          progress_3,
          matte_progress,
          comp_progress,
        };
      });

    res.json(projectsWithProgress);
  } catch (err: any) {
    console.error("Failed to load projects:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/project/:id/detail
app.get("/api/project/:id/detail", async (req, res) => {
  const config = loadConfig();
  const projectId = parseInt(req.params.id, 10);

  if (isNaN(projectId)) {
    return res.status(400).json({ error: "유효하지 않은 프로젝트 ID 형식입니다." });
  }

  if (config.use_mock || !config.base_url) {
    const db = loadMockDB();
    const project = db.projects.find((p: any) => p.id === projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    return res.json(project);
  }

  try {
    const token = await getAccessToken(config);
    const projects = await fetchShotgridSearch(
      config,
      token,
      "Project",
      [["id", "is", projectId]],
      ["id", "name", "code", "sg_status", "sg_sub_status"]
    );
    if (projects.length === 0) {
      return res.status(404).json({ error: "Project not found in Shotgrid" });
    }
    res.json(projects[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/project/:id/shots
app.get("/api/project/:id/shots", async (req, res) => {
  const config = loadConfig();
  const projectId = parseInt(req.params.id, 10);

  if (isNaN(projectId)) {
    return res.status(400).json({ error: "유효하지 않은 프로젝트 ID 형식입니다." });
  }

  if (config.use_mock || !config.base_url) {
    const db = loadMockDB();
    const shots = (db.shots || []).filter((s: any) => s.project?.id === projectId);
    
    // Sort alphabetically ascending by Code
    const sortedShots = shots.sort((a: any, b: any) => (a.code || "").localeCompare(b.code || ""));

    // Sort components pipeline-sequenced for shots
    const processedShots = sortedShots.map((s: any) => {
      return {
        ...s,
        parsed_tasks: s.parsed_tasks ? sortParsedTasks(s.parsed_tasks) : []
      };
    });

    return res.json(processedShots);
  }

  try {
    const token = await getAccessToken(config);
    const shots = await fetchShotgridSearch(
      config,
      token,
      "Shot",
      [["project", "is", { type: "Project", id: projectId }]],
      ["id", "code", "description", "image", "sg_org_thumbnail", "sg_status_list", "sg_work_order", "project"]
    );

    const tasks = await fetchShotgridSearch(
      config,
      token,
      "Task",
      [["project", "is", { type: "Project", id: projectId }]],
      ["id", "content", "sg_status_list", "start_date", "due_date", "project", "entity", "step", "task_assignees"]
    );

    const mappedShots = shots.map((s: any) => {
      const shotTasks = tasks.filter((t: any) => t.entity && t.entity.id === s.id && t.entity.type === "Shot");
      const parsed_tasks = shotTasks.map((t: any) => {
        let stepName = t.step?.name || (t.step ? String(t.step) : "Comp");
        if (typeof t.step === "object" && t.step !== null) {
          stepName = t.step.name || "Comp";
        }
        const assignee_name = t.task_assignees ? t.task_assignees.map((a: any) => a.name).join(", ") : "";
        return {
          id: t.id,
          content: t.content || "",
          step: stepName,
          assignee_name: cleanAssigneeName(assignee_name),
          due_date: t.due_date,
          status: t.sg_status_list || "wtg"
        };
      });

      return {
        ...s,
        parsed_tasks: sortParsedTasks(parsed_tasks)
      };
    });

    const sortedShots = mappedShots.sort((a: any, b: any) => (a.code || "").localeCompare(b.code || ""));
    res.json(sortedShots);
  } catch (err: any) {
    console.error("Shotgrid shots view failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/project/:id/versions
app.get("/api/project/:id/versions", async (req, res) => {
  const config = loadConfig();
  const projectId = parseInt(req.params.id, 10);

  if (isNaN(projectId)) {
    return res.status(400).json({ error: "유효하지 않은 프로젝트 ID 형식입니다." });
  }

  if (config.use_mock || !config.base_url) {
    const db = loadMockDB();
    const versions = (db.versions || []).filter((v: any) => v.project?.id === projectId);
    
    // Sort alphabetically ascending by Version Code
    const sortedVersions = versions.sort((a: any, b: any) => (a.code || "").localeCompare(b.code || ""));

    return res.json(sortedVersions);
  }

  try {
    const token = await getAccessToken(config);
    const versions = await fetchShotgridSearch(
      config,
      token,
      "Version",
      [["project", "is", { type: "Project", id: projectId }]],
      ["id", "code", "sg_status_list", "sg_version_number", "project", "entity", "description"]
    );

    const sortedVersions = versions.sort((a: any, b: any) => (a.code || "").localeCompare(b.code || ""));
    res.json(sortedVersions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks - list tasks with filter
app.get("/api/tasks", async (req, res) => {
  const config = loadConfig();
  let filtered: any[] = [];

  const projectId = req.query.project_id ? parseInt(req.query.project_id as string) : null;
  const status = req.query.status ? (req.query.status as string).toLowerCase().trim() : null;
  const userId = req.query.user_id ? parseInt(req.query.user_id as string) : null;

  if (config.use_mock || !config.base_url) {
    const db = loadMockDB();
    filtered = db.tasks || [];

    if (projectId) {
      filtered = filtered.filter((t: any) => t.project?.id === projectId);
    }
    if (status) {
      filtered = filtered.filter((t: any) => (t.sg_status_list || "").toLowerCase() === status);
    }
    if (userId) {
      filtered = filtered.filter((t: any) => 
        t.task_assignees && t.task_assignees.some((u: any) => u.id === userId)
      );
    }

    return res.json(filtered);
  }

  try {
    const token = await getAccessToken(config);
    const filters: any[] = [];
    if (projectId) {
      filters.push(["project", "is", { type: "Project", id: projectId }]);
    }
    if (status) {
      filters.push(["sg_status_list", "is", status]);
    }

    const tasks = await fetchShotgridSearch(
      config,
      token,
      "Task",
      filters,
      ["id", "content", "sg_status_list", "start_date", "due_date", "project", "entity", "step", "task_assignees"]
    );

    filtered = tasks;
    if (userId) {
      filtered = filtered.filter((t: any) => 
        t.task_assignees && t.task_assignees.some((u: any) => u.id === userId)
      );
    }

    res.json(filtered);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/task/:id
app.get("/api/task/:id", async (req, res) => {
  const config = loadConfig();
  const taskId = parseInt(req.params.id);

  if (config.use_mock || !config.base_url) {
    const db = loadMockDB();
    const task = db.tasks.find((t: any) => t.id === taskId);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    return res.json(task);
  }

  try {
    const token = await getAccessToken(config);
    const tasks = await fetchShotgridSearch(
      config,
      token,
      "Task",
      [["id", "is", taskId]],
      ["id", "content", "sg_status_list", "start_date", "due_date", "project", "entity", "step", "task_assignees"]
    );

    if (tasks.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    const task = tasks[0];
    const notes = await fetchTaskNotes(config, token, taskId);
    task.notes = notes || [];
    res.json(task);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/task/:id/update_status
app.post("/api/task/:id/update_status", async (req, res) => {
  const config = loadConfig();
  const taskId = parseInt(req.params.id);
  const status = req.body.status;

  if (config.use_mock || !config.base_url) {
    const db = loadMockDB();
    const taskIndex = db.tasks.findIndex((t: any) => t.id === taskId);
    if (taskIndex === -1) {
      return res.status(404).json({ error: "Task not found" });
    }

    db.tasks[taskIndex].sg_status_list = status;

    // Sync to shots if relevant task exists in shots' parsed_tasks
    if (db.shots) {
      db.shots.forEach((shot: any) => {
        if (shot.parsed_tasks) {
          shot.parsed_tasks.forEach((pt: any) => {
            if (pt.id === taskId) {
              pt.status = status;
            }
          });
        }
      });
    }

    saveMockDB(db);
    return res.json({ success: true, task: db.tasks[taskIndex] });
  }

  try {
    const token = await getAccessToken(config);
    const updated = await updateShotgridEntity(config, token, "Task", taskId, {
      sg_status_list: status
    });
    res.json({ success: true, task: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/task/:id/add_note
app.post("/api/task/:id/add_note", async (req, res) => {
  const config = loadConfig();
  const taskId = parseInt(req.params.id);
  const { subject, content } = req.body;

  if (config.use_mock || !config.base_url) {
    const db = loadMockDB();
    const taskIndex = db.tasks.findIndex((t: any) => t.id === taskId);
    if (taskIndex === -1) {
      return res.status(404).json({ error: "Task not found" });
    }

    if (!db.tasks[taskIndex].notes) {
      db.tasks[taskIndex].notes = [];
    }

    const newNote: Note = {
      id: Date.now(),
      subject: subject || "모바일 웹 피드백",
      content: content || "",
      user: { name: "모바일 수퍼바이저" }
    };

    db.tasks[taskIndex].notes.unshift(newNote);
    saveMockDB(db);
    return res.json({ success: true, task: db.tasks[taskIndex] });
  }

  try {
    const token = await getAccessToken(config);
    // Fetch task details to get project ID
    const tasks = await fetchShotgridSearch(config, token, "Task", [["id", "is", taskId]], ["id", "project", "entity"]);
    if (tasks.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    const task = tasks[0];
    const projectVal = task.project ? { type: "Project", id: task.project.id } : null;

    const noteAttrs: Record<string, any> = {
      subject: subject || "모바일 웹 피드백",
      content: content || "",
      note_links: [{ type: "Task", id: taskId }]
    };
    if (projectVal) {
      noteAttrs.project = projectVal;
    }

    const createdNote = await createShotgridEntity(config, token, "Note", noteAttrs);
    res.json({ success: true, note: createdNote });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/versions
app.get("/api/versions", async (req, res) => {
  const config = loadConfig();
  const projectId = req.query.project_id ? parseInt(req.query.project_id as string) : null;

  if (config.use_mock || !config.base_url) {
    const db = loadMockDB();
    let filtered = db.versions || [];
    if (projectId) {
      filtered = filtered.filter((v: any) => v.project?.id === projectId);
    }
    return res.json(filtered);
  }

  try {
    const token = await getAccessToken(config);
    const filters: any[] = [];
    if (projectId) {
      filters.push(["project", "is", { type: "Project", id: projectId }]);
    }

    const versions = await fetchShotgridSearch(
      config,
      token,
      "Version",
      filters,
      ["id", "code", "sg_status_list", "sg_version_number", "project", "entity", "description"]
    );
    res.json(versions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/version/:id
app.get("/api/version/:id", async (req, res) => {
  const config = loadConfig();
  const versionId = parseInt(req.params.id);

  if (config.use_mock || !config.base_url) {
    const db = loadMockDB();
    const version = db.versions.find((v: any) => v.id === versionId);
    if (!version) {
      return res.status(404).json({ error: "Version not found" });
    }
    return res.json(version);
  }

  try {
    const token = await getAccessToken(config);
    const versions = await fetchShotgridSearch(
      config,
      token,
      "Version",
      [["id", "is", versionId]],
      ["id", "code", "sg_status_list", "sg_version_number", "project", "entity", "description"]
    );
    if (versions.length === 0) {
      return res.status(404).json({ error: "Version not found" });
    }
    res.json(versions[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/version/:id/review
app.post("/api/version/:id/review", async (req, res) => {
  const config = loadConfig();
  const versionId = parseInt(req.params.id);
  const { status, note_content } = req.body; // 'apr' or 'rev'

  if (config.use_mock || !config.base_url) {
    const db = loadMockDB();
    const versionIndex = db.versions.findIndex((v: any) => v.id === versionId);
    if (versionIndex === -1) {
      return res.status(404).json({ error: "Version not found" });
    }

    const version = db.versions[versionIndex];
    version.sg_status_list = status;

    // Find linked tasks for this entity and sync status
    if (version.entity?.id) {
      db.tasks.forEach((t: any) => {
        if (t.entity && t.entity.id === version.entity.id) {
          // Sync states: apr -> fin, rev -> rev
          const syncedStatusByReview = status === "apr" ? "fin" : "rev";
          t.sg_status_list = syncedStatusByReview;

          if (note_content) {
            if (!t.notes) t.notes = [];
            t.notes.unshift({
              id: Date.now() + Math.floor(Math.random() * 1000),
              subject: `버전 검토 피드백: ${version.code}`,
              content: note_content,
              user: { name: "모바일 수퍼바이저" }
            });
          }
        }
      });

      // Also update shots parsed_tasks
      if (db.shots) {
        db.shots.forEach((shot: any) => {
          if (shot.parsed_tasks) {
            shot.parsed_tasks.forEach((pt: any) => {
              if (shot.id === version.entity.id) {
                const syncedStatusByReview = status === "apr" ? "fin" : "rev";
                pt.status = syncedStatusByReview;
              }
            });
          }
        });
      }
    }

    saveMockDB(db);
    return res.json({ success: true, version });
  }

  try {
    const token = await getAccessToken(config);
    const versions = await fetchShotgridSearch(
      config,
      token,
      "Version",
      [["id", "is", versionId]],
      ["id", "code", "entity", "project"]
    );
    if (versions.length === 0) {
      return res.status(404).json({ error: "Version not found" });
    }
    const versionObj = versions[0];

    // 1. Update Version status
    await updateShotgridEntity(config, token, "Version", versionId, {
      sg_status_list: status
    });

    // 2. Sync associated Shot Tasks status
    if (versionObj.entity?.id) {
      const entityType = versionObj.entity.type || "Shot";
      const entityId = versionObj.entity.id;
      const syncedStatusByReview = status === "apr" ? "fin" : "rev";

      const entityTasks = await fetchShotgridSearch(
        config,
        token,
        "Task",
        [["entity", "is", { type: entityType, id: entityId }]],
        ["id"]
      );

      for (const t of entityTasks) {
        await updateShotgridEntity(config, token, "Task", t.id, {
          sg_status_list: syncedStatusByReview
        });

        if (note_content) {
          const projectVal = versionObj.project ? { type: "Project", id: versionObj.project.id } : null;
          const noteAttrs: Record<string, any> = {
            subject: `버전 검토 피드백: ${versionObj.code}`,
            content: note_content,
            note_links: [{ type: "Task", id: t.id }]
          };
          if (projectVal) {
            noteAttrs.project = projectVal;
          }
          await createShotgridEntity(config, token, "Note", noteAttrs);
        }
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Settings operations
app.get("/api/settings", (req, res) => {
  const config = loadConfig();
  // Don't expose security password to the client!
  res.json({
    base_url: config.base_url,
    script_name: config.script_name,
    use_mock: config.use_mock,
  });
});

app.post("/api/settings/save", async (req, res) => {
  const { base_url, script_name, script_key, use_mock } = req.body;
  const config = loadConfig();

  config.base_url = base_url !== undefined ? base_url : config.base_url;
  config.script_name = script_name !== undefined ? script_name : config.script_name;
  config.script_key = script_key !== undefined ? script_key : config.script_key;
  config.use_mock = use_mock !== undefined ? use_mock : config.use_mock;

  // Validate only if live integration is selected
  if (config.use_mock === false) {
    if (!config.base_url || !config.script_name || !config.script_key) {
      return res.json({ success: false, error: "실제 연동 모드를 사용하려면 모든 자격 증명을 입력해야 합니다." });
    }
    try {
      await getAccessToken(config);
    } catch (err: any) {
      return res.json({ 
        success: false, 
        error: `실제 Shotgrid 서버 연결 실패 ( 자격증명이 올바르지 않거나 도메인 접속 불가 ): ${err.message}` 
      });
    }
  }

  const success = saveConfig(config);
  res.json({ success });
});

app.post("/api/settings/toggle_mock", async (req, res) => {
  const config = loadConfig();
  const nextMock = !config.use_mock;

  if (nextMock === false) {
    if (!config.base_url || !config.script_name || !config.script_key) {
      return res.json({ success: false, error: "실제 연동 모드를 활성화하려면 자격 증명을 먼저 저장해야 합니다." });
    }
    try {
      await getAccessToken(config);
    } catch (err: any) {
      return res.json({
        success: false,
        error: `실제 Shotgrid 서버 연동 불가: ${err.message}`
      });
    }
  }

  config.use_mock = nextMock;
  const success = saveConfig(config);
  res.json({ success, use_mock: config.use_mock });
});

app.post("/api/settings/login", (req, res) => {
  const { password } = req.body;
  const config = loadConfig();
  const matched = password === config.settings_password;
  res.json({ success: matched });
});

app.post("/api/settings/change_password", (req, res) => {
  const { new_password, current_password } = req.body;
  const config = loadConfig();
  
  if (current_password !== config.settings_password) {
    return res.status(403).json({ error: "Current password does not match" });
  }

  config.settings_password = new_password;
  const success = saveConfig(config);
  res.json({ success });
});

// --- DASHBOARD AGGREGATES ---
app.get("/api/dashboard-stats", async (req, res) => {
  const config = loadConfig();
  let projects: any[] = [];
  let tasks: any[] = [];
  let versions: any[] = [];

  try {
    if (config.use_mock || !config.base_url) {
      const db = loadMockDB();
      projects = db.projects || [];
      tasks = db.tasks || [];
      versions = db.versions || [];
    } else {
      const token = await getAccessToken(config);
      projects = await getProjectsFromShotgrid(config, token);
      tasks = await fetchShotgridSearch(
        config,
        token,
        "Task",
        [],
        ["id", "content", "sg_status_list", "start_date", "due_date", "project", "entity", "step", "task_assignees"]
      );
      versions = await fetchShotgridSearch(
        config,
        token,
        "Version",
        [],
        ["id", "code", "sg_status_list", "sg_version_number", "project", "entity", "description"]
      );
    }

    const totalTasks = tasks.length;
    const wtgCount = tasks.filter((t: any) => t.sg_status_list === "wtg").length;
    const ipCount = tasks.filter((t: any) => t.sg_status_list === "ip").length;
    const revCount = tasks.filter((t: any) => t.sg_status_list === "rev").length;
    const finCount = tasks.filter((t: any) => ["fin", "apr"].includes(t.sg_status_list)).length;

    const progress = totalTasks > 0 ? Math.round((finCount / totalTasks) * 100) : 0;
    const pendingVersions = versions.filter((v: any) => v.sg_status_list === "rev").slice(0, 3);
    
    // Quick filters 'My Tasks' (mock current artist: 최동현 with ID 4)
    const myTasks = tasks.filter((t: any) => 
      t.task_assignees && t.task_assignees.some((u: any) => u.id === 4)
    ).slice(0, 4);

    res.json({
      projects,
      total_tasks: totalTasks,
      wtg_count: wtgCount,
      ip_count: ipCount,
      rev_count: revCount,
      fin_count: finCount,
      progress,
      pending_versions: pendingVersions,
      my_tasks: myTasks
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- VITE MIDDLEWARE SETUP ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
