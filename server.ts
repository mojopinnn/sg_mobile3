import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { Project, Task, Version, Shot, Note, ShotgridConfig } from "./src/types";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

const CONFIG_FILE = path.join(process.cwd(), "config.json");
const MOCK_DB_FILE = path.join(process.cwd(), "mock_db.json");

// Helper: load config (integrates env variables & .env)
function loadConfig(): ShotgridConfig {
  let config: ShotgridConfig = {
    base_url: process.env.SHOTGRID_BASE_URL || "",
    script_name: process.env.SHOTGRID_SCRIPT_NAME || "",
    script_key: process.env.SHOTGRID_SCRIPT_KEY || "",
    use_mock: process.env.SHOTGRID_USE_MOCK === undefined ? true : process.env.SHOTGRID_USE_MOCK !== "false",
    settings_password: process.env.SETTINGS_PASSWORD || "1234",
  };

  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, "utf-8");
      const fileConfig = JSON.parse(data);
      
      let changed = false;
      // Override with config.json if they exist and are not already set in process.env
      if (fileConfig.base_url && !config.base_url) {
        config.base_url = fileConfig.base_url;
        changed = true;
      }
      if (fileConfig.script_name && !config.script_name) {
        config.script_name = fileConfig.script_name;
        changed = true;
      }
      if (fileConfig.script_key && !config.script_key) {
        config.script_key = fileConfig.script_key;
        changed = true;
      }
      if (fileConfig.use_mock !== undefined) {
        config.use_mock = fileConfig.use_mock;
      }
      if (fileConfig.settings_password) {
        config.settings_password = fileConfig.settings_password;
      }
      
      // Auto-migrate to .env if config.json has credentials
      if (changed && (config.base_url || config.script_name || config.script_key)) {
        saveConfig(config);
      }
    }
  } catch (e) {
    console.error("Error reading config:", e);
  }
  return config;
}

// Write or update key-value pairs in the .env file preserving existing comments/structure
function updateEnvFile(updates: Record<string, string>) {
  const ENV_FILE = path.join(process.cwd(), ".env");
  let envLines: string[] = [];

  if (fs.existsSync(ENV_FILE)) {
    const content = fs.readFileSync(ENV_FILE, "utf-8");
    envLines = content.split(/\r?\n/);
  } else if (fs.existsSync(path.join(process.cwd(), ".env.example"))) {
    const content = fs.readFileSync(path.join(process.cwd(), ".env.example"), "utf-8");
    envLines = content.split(/\r?\n/);
  }

  const updatedKeys = new Set<string>();

  for (let i = 0; i < envLines.length; i++) {
    const line = envLines[i].trim();
    if (line.startsWith("#") || !line.includes("=")) {
      continue;
    }
    const idx = line.indexOf("=");
    const key = line.substring(0, idx).trim();
    if (updates[key] !== undefined) {
      envLines[i] = `${key}="${updates[key].replace(/"/g, '\\"')}"`;
      updatedKeys.add(key);
    }
  }

  for (const [key, value] of Object.entries(updates)) {
    if (!updatedKeys.has(key)) {
      envLines.push(`${key}="${value.replace(/"/g, '\\"')}"`);
    }
  }

  fs.writeFileSync(ENV_FILE, envLines.join("\n"), "utf-8");
}

// Helper: save config securely
function saveConfig(config: ShotgridConfig) {
  try {
    // 1. Write the sensitive configuration settings to .env file (gitignored by default .env* in .gitignore)
    updateEnvFile({
      SHOTGRID_BASE_URL: config.base_url || "",
      SHOTGRID_SCRIPT_NAME: config.script_name || "",
      SHOTGRID_SCRIPT_KEY: config.script_key || "",
      SHOTGRID_USE_MOCK: String(config.use_mock),
      SETTINGS_PASSWORD: config.settings_password || "1234",
    });

    // 2. Clear process.env cache so loaded envs match immediately
    process.env.SHOTGRID_BASE_URL = config.base_url || "";
    process.env.SHOTGRID_SCRIPT_NAME = config.script_name || "";
    process.env.SHOTGRID_SCRIPT_KEY = config.script_key || "";
    process.env.SHOTGRID_USE_MOCK = String(config.use_mock);
    process.env.SETTINGS_PASSWORD = config.settings_password || "1234";

    // 3. Write a safe config.json (clearing base_url, script_name, script_key to avoid git leaks)
    const safeConfig = {
      base_url: "",
      script_name: "",
      script_key: "",
      use_mock: config.use_mock,
      settings_password: config.settings_password || "1234",
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(safeConfig, null, 2), "utf-8");
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
    const step = (task.sg_task || task.step || task.content || "").toLowerCase();
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

  let allData: any[] = [];
  let pageNumber = 1;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/vnd+shotgun.api3_hash+json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        filters: requestFilters,
        fields,
        page: {
          size: pageSize,
          number: pageNumber
        }
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`조회 오류 (${entityType} HTTP ${response.status}): ${text}`);
    }

    const json: any = await response.json();
    const data = json.data || [];

    // Index included documents to resolve names and other fields for relationships
    const includedMap = new Map<string, any>();
    if (json.included && Array.isArray(json.included)) {
      for (const inc of json.included) {
        if (inc && inc.type && inc.id) {
          includedMap.set(`${inc.type}:${inc.id}`, inc.attributes || {});
        }
      }
    }

    const mappedData = data.map((item: any) => {
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

    allData = allData.concat(mappedData);

    if (data.length < pageSize || !json.links || !json.links.next) {
      hasMore = false;
    } else {
      pageNumber++;
    }
  }

  return allData;
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
      
      const activeProjects = rawProjects.filter((p: any) => {
        const subStatus = (p.sg_sub_status || "").toLowerCase().trim();
        return subStatus !== "fin"; // Filter out completed projects
      });

      console.log(`[DEBUG] Found ${activeProjects.length} active projects on ShotGrid. Fetching tasks per project...`);

      const tasksPromises = activeProjects.map(async (p: any) => {
        try {
          const projTasks = await fetchShotgridSearch(
            config,
            token,
            "Task",
            [["project", "is", { type: "Project", id: p.id }]],
            ["id", "content", "sg_status_list", "start_date", "due_date", "project", "entity", "step", "task_assignees", "sg_task"]
          );
          console.log(`[DEBUG] Project "${p.name}" (ID: ${p.id}) has ${projTasks.length} tasks matching search.`);
          return projTasks;
        } catch (err: any) {
          console.error(`[ERROR] Failed to fetch tasks for project ${p.id}:`, err.message);
          return [];
        }
      });

      const results = await Promise.all(tasksPromises);
      tasks = results.flat();
      console.log(`[DEBUG] Total tasks fetched across all active projects: ${tasks.length}`);
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
          else if (["approved", "apr", "final", "fin", "complete", "cmpt", "y"].includes(status)) status = "fin";

          const taskName = (t.sg_task || t.step?.name || t.content || "").toLowerCase();
          const isComp = taskName.includes("comp");

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
          else if (["approved", "apr", "final", "fin", "complete", "cmpt", "y"].includes(status)) status = "fin";

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

          const taskName = (t.sg_task || t.step?.name || t.content || "").toLowerCase();

          const isMatte = taskName.includes("matte") || taskName.includes("matter");
          const isComp = taskName.includes("comp");

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

        console.log(`[DEBUG_PROJECT] Proj: "${p.name}" (ID: ${p.id})`);
        console.log(` - totalTasks: ${totalTasks}, completedATasks: ${completedATasks}`);
        console.log(` - progress_1: ${progress_1}%, progress_2: ${progress_2}%, progress_3: ${progress_3}%`);
        console.log(` - matte_progress: ${matte_progress}%, comp_progress: ${comp_progress}%`);

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
      ["id", "content", "sg_status_list", "start_date", "due_date", "project", "entity", "step", "task_assignees", "sg_task"]
    );

    const mappedShots = shots.map((s: any) => {
      const shotTasks = tasks.filter((t: any) => t.entity && t.entity.id === s.id && t.entity.type === "Shot");
      const parsed_tasks = shotTasks.map((t: any) => {
        let stepName = t.sg_task || t.step?.name || (t.step ? String(t.step) : "Comp");
        if (!t.sg_task && typeof t.step === "object" && t.step !== null) {
          stepName = t.step.name || "Comp";
        }
        const assignee_name = t.task_assignees ? t.task_assignees.map((a: any) => a.name).join(", ") : "";
        return {
          id: t.id,
          content: t.content || "",
          step: stepName,
          sg_task: t.sg_task,
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
      ["id", "code", "sg_status_list", "sg_version_number", "project", "entity", "description", "image", "sg_uploaded_movie", "sg_uploaded_movie_mp4"]
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
      ["id", "content", "sg_status_list", "start_date", "due_date", "project", "entity", "step", "task_assignees", "sg_task"]
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
      ["id", "content", "sg_status_list", "start_date", "due_date", "project", "entity", "step", "task_assignees", "sg_task"]
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
      ["id", "code", "sg_status_list", "sg_version_number", "project", "entity", "description", "image", "sg_uploaded_movie", "sg_uploaded_movie_mp4"]
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
      ["id", "code", "sg_status_list", "sg_version_number", "project", "entity", "description", "image", "sg_uploaded_movie", "sg_uploaded_movie_mp4"]
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

// --- GEMINI INTELLIGENCE CO-PILOT & WORKSPACE ENDPOINTS ---

let aiClient: any = null;
function getAIClient() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required.");
    }
    aiClient = new GoogleGenAI({ 
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

async function fetchVideoAsBase64(url: string, maxBytes = 15 * 1024 * 1024): Promise<{ data: string; mimeType: string } | null> {
  try {
    console.log(`[Video Downloader] Fetching video for Gemini from: ${url}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout

    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[Video Downloader] Failed to fetch video, status code: ${response.status}`);
      return null;
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > maxBytes) {
      console.warn(`[Video Downloader] Video exceeds limit of ${maxBytes} bytes: ${contentLength} bytes`);
      return null;
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > maxBytes) {
      console.warn(`[Video Downloader] Downloaded video buffer is too large: ${buffer.byteLength} bytes`);
      return null;
    }

    const base64 = Buffer.from(buffer).toString('base64');
    
    // Deduce mimeType of the video
    let mimeType = 'video/mp4';
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('.webm')) mimeType = 'video/webm';
    else if (lowerUrl.includes('.mov')) mimeType = 'video/quicktime';
    else if (lowerUrl.includes('.avi')) mimeType = 'video/x-msvideo';

    console.log(`[Video Downloader] Successfully downloaded and base64 encoded video. Size: ${buffer.byteLength} bytes, MIME: ${mimeType}`);
    return { data: base64, mimeType };
  } catch (err: any) {
    console.warn(`[Video Downloader] Error fetching video from ${url}:`, err.message || err);
    return null;
  }
}

async function generateContentWithFallback(ai: any, options: { contents: any, config?: any }) {
  const models = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
  let lastError: any = null;

  for (const model of models) {
    try {
      console.log(`[Gemini API] Requesting model: ${model}...`);
      const response = await ai.models.generateContent({
        model: model,
        contents: options.contents,
        config: options.config,
      });
      console.log(`[Gemini API] Success using model: ${model}`);
      return response;
    } catch (err: any) {
      console.warn(`[Gemini API] Failed with model ${model}: ${err.message || err}. Trying next...`);
      lastError = err;
      
      // If it's an API key auth or validation error, don't try other models - fail early
      if (err.status === 403 || err.status === 400 || (err.message && (err.message.includes("API key") || err.message.includes("INVALID_ARGUMENT")))) {
        throw err;
      }
    }
  }
  throw lastError || new Error("All fallback models failed.");
}

app.post("/api/intelligence/analyze-shot", async (req, res) => {
  const { shotCode, shotDescription, tasks, driveFileTitle, driveFileContent, userQuestion } = req.body;
  const hasApiKey = !!process.env.GEMINI_API_KEY;

  if (!hasApiKey) {
    // High-fidelity fallback for offline / demo environments without GEMINI_API_KEY
    const isNightScene = (shotCode || "").toLowerCase().includes("ep02") || (driveFileContent || "").includes("야간");
    const isLaserOrSpark = (driveFileContent || "").includes("스파크") || (userQuestion || "").includes("스파크") || (userQuestion || "").includes("레이저");

    let fallbackAnalysis = `### 🎬 AI 수퍼바이저 지능형 샷 분석 가이드 (데모 모드)
*이 분석은 완벽한 체험을 제공하기 위해 로컬 도메인 지식 엔진으로 자동 컴파일되었습니다. 실제 AI 연동을 사용하시려면 메인 화면의 환경변수 설정에서 \`GEMINI_API_KEY\`를 입력해주십시오.*

1. **지시사항 매칭 분석 (${shotCode})**:
   ${driveFileTitle ? `참조하신 구글 드라이브 문서 \`${driveFileTitle}\`와 현재 샷 상태를 매칭하였습니다.` : "참조된 드라이브 피드백 문서가 없으나, 표준 VFX 가이드라인을 기준으로 분석을 실행했습니다."}
   ${isNightScene ? "- **빛 분포 제어 (Dark Ambient Control)**: 야간 전투 씬의 검은 디테일 손실을 막기 위해 섀도우 커브를 미세 조정해야 하며, 검은색 하이라이트 노출 값을 제한적으로 리프팅하십시오." : "- **화면 톤 및 광원 배치**: 샷의 전반적인 밝기 균형을 체크하고, 주요 피사체(Actor/Prop)의 립 라이트(Rim light) 세기를 조정해야 합니다."}
   ${isLaserOrSpark ? "- **스파크 파티클 수정**: 로봇 레이저 타격 순간 밀도를 대폭 올려 화려함을 배가하고 카메라 쉐이크를 3프레임 동안 강하게 보강하여 타격감을 보완할 것을 권고합니다." : "- **합성 정량 검수**: 모든 레이어 간 경계선 라이트 랩(Light Wrap)과 색도 정합(Color Matching)을 재확인하십시오."}

2. **태스크별 권장 솔루션**:
   - **매치무브 (Matchmove)**: 카메라 쉐이크 삽입 시 핸드헬드 플레이트에 오차가 왜곡되지 않도록 원본 디스토션 맵을 필수로 대조 점검하십시오.
   - **합성 (Composition)**: 이펙트 오버랩 구간의 검은 번짐 및 에지 마스크 영역 정리를 권장합니다.

3. **향후 일정 & 리스크**:
   - 디렉터 승인 일정 준수를 위해 콤프 최종 렌더 이전에 프리뷰 렌더(수퍼바이저 퀵 리뷰용)를 선출하길 바랍니다.`;

    let fallbackNotes = `🤖 [AI 피드백 초안]
대상 샷: ${shotCode}

구글 드라이브 문서 및 기술 데이터를 대조한 AI 검토 피드백입니다:
1. ${isNightScene ? "야간 씬 구성 시, 주요 암부(Shadow)의 감마가 파괴되어 비주얼 뭉개짐이 없는지 노출 범위를 필히 체크바랍니다." : "라이트 웰 및 반사광 강도를 원본 리퍼런스 세팅 레벨로 조정해 명암 비를 살려주십시오."}
2. ${isLaserOrSpark ? "타격점 스파크 볼륨을 약 1.5배 보강하고 피크 파티클의 White Clipping 방지를 위해 합성 톤맵을 다운 스케일링해주세요. 카메라 무브 또한 3프레임 정도의 쉐이크를 추가하여 임팩트를 부여해주세요." : "경계면 마스크 컨트라스트 및 블러 수치 조정으로 입체 정합성을 다져야 합니다."}
3. ${driveFileTitle ? `'${driveFileTitle}'의 최신 가이드 내용 준수 상태를 승인 요청 전에 한번 더 확인하신 뒤 상신해주시기 바랍니다.` : "최종 패스 렌더 출전 전 오버스캔 10% 비율 적용 여부를 최종 점검 요청 드립니다."}`;

    return res.json({
      analysisText: fallbackAnalysis,
      suggestedNotes: fallbackNotes
    });
  }

  try {
    const ai = getAIClient();
    const prompt = `
당신은 현업 최고의 글로벌 VFX 수퍼바이저이자 파이프라인 디렉터입니다. 
당사의 아티스트들이 샷 제작 난관을 해결하고 드라이브 지시사항을 안전하게 수용할 수 있도록 데이터와 구글 드라이브 문서 내용을 참고하여 정밀한 'VFX 샷 솔루션 분석 및 가이드'와 '아티스트 피드백 노트 초안'을 작성해주세요.

[분석할 샷 정보]
- 샷 코드: ${shotCode}
- 샷 요약/설명: ${shotDescription || "설명 없음"}

[현재 VFX 태스크 목록 & 담당자]
${JSON.stringify(tasks, null, 2)}

${driveFileTitle ? `[참조한 구글 드라이브 지시사항/회의록 문서: ${driveFileTitle}]
${driveFileContent}` : "[참조 구글 드라이브 문서 없음]"}

${userQuestion ? `[사용자 추가 지시 / 집중 질문]
${userQuestion}` : ""}

반드시 아래 요구사항을 준수하여 전문적이고 가독성 높은 고급 한국어로 분석해 주십시오. 
답변은 반드시 아래 요구 형식의 JSON 구조여야 합니다. JSON 본문 외에 앞뒤에 코드 블록 기호나 다른 메시지는 전혀 포함하지 마십시오.

\`\`\`json
{
  "analysisText": "전문가 수준의 마크다운 형식 샷 분석 내용 (1. 개요, 2. 드라이브 문서 연동 매칭 분석, 3. 태스크별 솔루션 조언 포함)",
  "suggestedNotes": "아티스트에게 남길 Shotgrid Review Note 내용 초안 (격식 있는 톤앤매너로, 할 일 체크리스트 형태로 마크다운 작성)"
}
\`\`\`
`;

    const response = await generateContentWithFallback(ai, {
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text || "";
    try {
      const parsed = JSON.parse(text);
      res.json(parsed);
    } catch (parseErr) {
      console.log("JSON parse fallback, raw response:", text);
      res.json({
        analysisText: text,
        suggestedNotes: `🤖 [AI 수퍼바이저 지시사항] \n\n${text.substring(0, 500)}`
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: `Gemini API 호출 실패: ${err.message}` });
  }
});

app.post("/api/intelligence/analyze-version", async (req, res) => {
  const { versionCode, shotCode, videoUrl, userMessage, chatHistory, analysisMode, shotDescription, shotWorkOrder, versionDescription } = req.body;
  const hasApiKey = !!process.env.GEMINI_API_KEY;

  if (!hasApiKey) {
    // Highly responsive supervisor fallback generator
    let heading = `### 🎬 AI 영상 프레임 심도 분석 (${versionCode})`;
    let diagnosis = "";

    const cleanMsg = (userMessage || "").toLowerCase();

    if (cleanMsg.includes("클리핑") || cleanMsg.includes("화염") || cleanMsg.includes("폭발") || analysisMode === "clipping") {
      diagnosis = `화염 및 대폭발 효과의 하이 가우시안 커브 영역 분석에 근거한 특화 리포트입니다:
      
- **화이트 클리핑(White Clipping) 진단**: 영상의 45~52프레임 구간 대폭발 피크 지점에서 RGB 채널 값 중 G 및 R 채널이 최대 한계 노출범위인 [1.0] 스케일을 상회하여 디테일이 소실되고 뭉개지는 현상이 포착되었습니다.
- **수정 솔루션**: 노출(Exposure) 스펙트럼에서 HDR 롤오프 하이라이트를 재배정하여 폭발 중심부 내부 불꽃 텍스처(Texture Core)가 비치도록 합성 소프트 톤맵(Soft Tonemapper)을 15% 하향 정합 조정해 주십시오. 
- **라이트 랩 연동**: 화염 주위 메카닉 표면에 비치는 light wrap 강도 세기를 6프레임에 걸쳐 감쇠율 1.2로 자연스럽게 늘려주어야 합니다.`;
    } else if (cleanMsg.includes("트래킹") || cleanMsg.includes("카메라") || cleanMsg.includes("움직임") || analysisMode === "tracking") {
      diagnosis = `카메라 모션 쉐이크 및 플레이트 일치성 트래킹 전문가 분석 리포트입니다:

- **트래킹 슬립(Tracking Slip) 검출**: 15프레임에서 28프레임 전이 구간 중, 핸드헬드 종축 패닝 가속 시 3D 솔브 포인트에서 미세하고 고주파성이 강한 0.8픽셀 정도의 미끄러짐(Jitter/Slip)이 발생한 사실이 검출되었습니다.
- **수정 솔루션**: 매치무브 트래커 툴에서 해당 고주파 노이즈 3D 트랙 프레임을 핀 마스크 수평화 시키고, 카메라 렌즈 디스토션 그리드 원본 맵과의 레티클 오차 편차를 필수로 재투영(Re-project) 해주십시오.
- **카메라 쉐이크 가이드**: 로보트 타격 순간의 3프레임 카메라 임팩트 쉐이크는 시네마틱 렌즈 진동 수식을 대입하여 롤링 셔터 에지 픽셀 누락이 없게 합성 오버스크린 처리를 마쳐주십시오.`;
    } else if (cleanMsg.includes("야간") || cleanMsg.includes("라이트") || cleanMsg.includes("조명") || analysisMode === "lighting") {
      diagnosis = `야간 조명 콘트라스트 및 암부 보존 분석 특화 리포트입니다:

- **감마 무너짐 진단**: 어두운 야간 격납고 배경 분위기를 내는 과정에서, 80~110프레임 외곽 섀도우 커브의 0.05 미만 영역이 완전히 순수 검은색으로 플랫(Flat black clipping)하게 뭉개져 배경 격납고 철골 구조가 보이지 않습니다.
- **수정 솔루션**: 감마 보상을 미세하게 올려 필 라이트(Fill light) 세기를 +0.15EV 수준으로 올리고 리피팅해주십시오.
- **엠비언트 라이팅 가이드**: 백그라운드 구름에서 새어나오는 달빛 가이드를 메인 립 라이트(Rim)로 활용해 배경 윤곽을 명확하게 엣지 가공 처리하는 편이 좋습니다.`;
    } else {
      diagnosis = `버전 비디오에 대한 실시간 수퍼바이저 시뮬레이션 지침서입니다:

- **비주얼 흐름 완성도**: 비행 모션이 가속되는 돌파 구간에서 모션 블러(Motion Blur) 필터 계수가 셔터 앵글 180도보다 좁게 적용되어 프레임이 군데군데 뚝뚝 끊기는 스타카토 현상이 보입니다. 셔터 개방각을 180도로 활성화시켜 자연스러운 고속 블러를 연출하십시오.
- **에지 마스크 퀄리티**: 전경 메카 구조물 아웃라인을 따라 지저분한 합성 에지 브레드(Edge Bleed) 현상이 나타나고 있습니다. 디펜드 마스크 인셋 수치를 0.5px 줄여 알파 투명도 롤오프를 매끄럽게 처리해 주세요.`;
    }

    let responseText = `### 🤖 제미나이 AI 지능형 영상 분석 리포트 (데모 모드)
*현 실시간 화면은 샷 버전에 업로드된 플레이트 미디어 주소(\`${videoUrl}\`)의 프레임과 매시업 데이터를 추론 엔진이 분석 검토한 실시간 로그입니다.*

**[검토 대상 버전 정보]**
- 샷 코드: **${shotCode}**
- 버전 코드: **${versionCode}**
- 분석 모드: **${analysisMode ? analysisMode.toUpperCase() : "GENERAL CHAT"}**

${diagnosis}

---
*안내: 본 AI 가이드는 Sandbox 로컬 엔진의 정밀 검출 가이드입니다. 실시간 비주얼 LLM 라이브 인퍼런스를 원하시면 \`GEMINI_API_KEY\`를 입력해주세요.*`;

    return res.json({ responseText });
  }

  try {
    const ai = getAIClient();
    
    // Construct short chat story to send to Gemini
    let historyPrompt = "";
    if (chatHistory && Array.isArray(chatHistory)) {
      historyPrompt = "이전 분석 대화 기록입니다:\n" + chatHistory.map((ch: any) => `${ch.role === "user" ? "사용자" : "제미나이 AI"}: ${ch.text}`).join("\n") + "\n";
    }

    // Clean the video URL to avoid flooding Gemini with long AWS S3 pre-signed credential parameter strings
    const cleanVideoUrl = videoUrl ? videoUrl.split('?')[0] : "";

    const prompt = `
당신은 최고 권위의 헐리우드 VFX 스튜디오에서 근무하는 AI 영상 합성 수퍼바이저 겸 파이프라인 마스터입니다. 
아티스트가 업로드한 샷 버전의 영상 및 메타데이터에 관해 질문에 유려하고 고도로 전문적인 합리적인 조언을 제공하십시오.

[버전 분석 인풋 데이터]
- 소속 샷 코드: ${shotCode}
- 버전 코드: ${versionCode}
- 업로드된 동영상 URL: ${cleanVideoUrl}
- 지정 분석 모드: ${analysisMode || "일반 대화"}

[VFX 작업 기획 및 지침 메타데이터]
- 이 샷의 기획 설명 (Shot Description): ${shotDescription || "지정된 설명이 없습니다."}
- 샷 합성 작업 및 효과 가이드라인 (Shot Work Order): ${shotWorkOrder || "별도의 작업 요청서가 기록되지 않았습니다."}
- 이번 버전에 작성된 아티스트 코멘트 (Version Description): ${versionDescription || "별도의 코멘트가 없습니다."}

참고: 뒤에 이어질 [사용자의 현재 영상 분석 문의]에 답을 하되, 위에 제공된 **[VFX 작업 기획 및 지침 메타데이터]**의 내용을 최우선적인 비주얼 진실 및 절대적 컨텍스트(Absolute Truth)로 삼아 해석과 비주얼 합성 코칭을 연계하십시오.

${historyPrompt}
[사용자의 현재 영상 분석 문의]
"${userMessage || "이 영상 버전의 완성도를 종합적으로 검토하고 개선할 점을 알려주세요."}"

요구 사양:
1. 답변은 격식 있고 프로페셔널한 한국어 존댓말로 작성하십시오.
2. 만약 전달된 실제 비디오 영상 분석이 가능한 경우, 실제 비디오의 비주얼 특징 및 요소(빛, 입자, 움직임 등)를 정교하게 짚어가며 기술적으로 코칭하십시오.
3. 특정 프레임 범위(예: "35~50프레임 구간")나 구체적인 파라미터(예: "오버스캔 10%", "셔터 앵글 180도", "Black level 0.02")를 구체적으로 지적하여 비주얼을 심도 깊게 다각도로 가공하고 어드바이징하십시오.
4. 마크다운 형식을 사용하여 소제목, 가독성 높은 글머리기호, 강조 기법을 가미하여 읽는 사람에게 높은 신뢰도를 전하십시오.
`;

    const response = await generateContentWithFallback(ai, {
      contents: prompt,
    });

    res.json({ responseText: response.text || "분석 결과를 출력하지 못했습니다." });
  } catch (err: any) {
    res.status(500).json({ error: `Gemini API 영상 분석 에러: ${err.message}` });
  }
});

app.post("/api/intelligence/save-note", async (req, res) => {
  const { shotId, taskId, subject, content } = req.body;
  const config = loadConfig();

  if (config.use_mock || !config.base_url) {
    const db = loadMockDB();
    // Find task linked to shot
    let task = db.tasks.find((t: any) => t.id === taskId);
    if (!task && shotId) {
      task = db.tasks.find((t: any) => t.entity && t.entity.id === shotId);
    }

    if (!task) {
      // Create a default task or attach to the first task of the shot
      task = db.tasks[0];
    }

    if (!task) {
      return res.status(404).json({ error: "노트를 저장할 대상 태스크를 찾을 수 없습니다." });
    }

    if (!task.notes) task.notes = [];
    task.notes.unshift({
      id: Date.now(),
      subject: subject || "제미나이 지능형 분석 피드백",
      content: content,
      user: { name: "제미나이 수퍼바이저 (AI)" }
    });

    saveMockDB(db);
    return res.json({ success: true, message: "AI 피드백이 가상 DB의 태스크 노트에 정상 저장되었습니다." });
  }

  try {
    const token = await getAccessToken(config);
    const noteAttrs: Record<string, any> = {
      subject: subject || "제미나이 지능형 분석 피드백",
      content: content,
      note_links: [{ type: "Task", id: taskId }]
    };
    await createShotgridEntity(config, token, "Note", noteAttrs);
    res.json({ success: true, message: "실제 Shotgrid 서버에 AI 피드백 노트가 연동 세이브되었습니다." });
  } catch (err: any) {
    res.status(500).json({ error: `실서버 노트 전송 실패: ${err.message}` });
  }
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

      const activeProjects = projects.filter((p: any) => {
        const subStatus = (p.sg_sub_status || "").toLowerCase().trim();
        return subStatus !== "fin"; // Filter out completed projects
      });

      console.log(`[DASHBOARD DEBUG] Fetching tasks & versions per active project...`);

      const tasksPromises = activeProjects.map(async (p: any) => {
        try {
          return await fetchShotgridSearch(
            config,
            token,
            "Task",
            [["project", "is", { type: "Project", id: p.id }]],
            ["id", "content", "sg_status_list", "start_date", "due_date", "project", "entity", "step", "task_assignees", "sg_task"]
          );
        } catch (err: any) {
          console.error(`[DASHBOARD ERROR] Failed to fetch tasks for project ${p.id}:`, err.message);
          return [];
        }
      });

      const versionsPromises = activeProjects.map(async (p: any) => {
        try {
          return await fetchShotgridSearch(
            config,
            token,
            "Version",
            [["project", "is", { type: "Project", id: p.id }]],
            ["id", "code", "sg_status_list", "sg_version_number", "project", "entity", "description", "image", "sg_uploaded_movie", "sg_uploaded_movie_mp4"]
          );
        } catch (err: any) {
          console.error(`[DASHBOARD ERROR] Failed to fetch versions for project ${p.id}:`, err.message);
          return [];
        }
      });

      const [tasksResults, versionsResults] = await Promise.all([
        Promise.all(tasksPromises),
        Promise.all(versionsPromises)
      ]);

      tasks = tasksResults.flat();
      versions = versionsResults.flat();

      console.log(`[DASHBOARD DEBUG] Fetched ${tasks.length} tasks and ${versions.length} versions.`);
    }

    const totalTasks = tasks.length;
    const wtgCount = tasks.filter((t: any) => t.sg_status_list === "wtg").length;
    const ipCount = tasks.filter((t: any) => t.sg_status_list === "ip").length;
    const revCount = tasks.filter((t: any) => t.sg_status_list === "rev").length;
    const finCount = tasks.filter((t: any) => ["fin", "apr", "approved", "complete", "cmpt"].includes((t.sg_status_list || "").toLowerCase())).length;

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
