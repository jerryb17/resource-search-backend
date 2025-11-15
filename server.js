/**
 * Lightweight NLP Resource Search Backend
 * Optimized for Render free tier (0.5GB RAM)
 * No heavy ML models - uses efficient text matching algorithms
 */

import express from "express";
import cors from "cors";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { NLPService } from "./nlpService.js";
import { aiService } from "./aiService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Load data files
let resources = [];
let tasks = [];

try {
  const resourcesPath = join(__dirname, "data", "resources_data.json");
  const tasksPath = join(__dirname, "data", "tasks_data.json");

  resources = JSON.parse(readFileSync(resourcesPath, "utf8"));
  tasks = JSON.parse(readFileSync(tasksPath, "utf8"));

  console.log(`Loaded ${resources.length} resources and ${tasks.length} tasks`);
} catch (error) {
  console.error("Error loading data files:", error.message);
  console.log("Starting with empty data arrays");
}

// Initialize NLP service
const nlpService = new NLPService(resources);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", message: "Backend is running" });
});

// Get all resources with optional filtering
app.get("/api/resources", (req, res) => {
  try {
    const { availability, skill, expertise_level, department } = req.query;

    let filteredResources = [...resources];

    if (availability) {
      filteredResources = filteredResources.filter(
        (r) => r.availability === availability
      );
    }

    if (skill) {
      filteredResources = filteredResources.filter((r) =>
        r.skills.some((s) => s.toLowerCase().includes(skill.toLowerCase()))
      );
    }

    if (expertise_level) {
      filteredResources = filteredResources.filter(
        (r) => r.expertise_level === expertise_level
      );
    }

    if (department) {
      filteredResources = filteredResources.filter(
        (r) => r.department === department
      );
    }

    res.json({
      success: true,
      count: filteredResources.length,
      resources: filteredResources,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get specific resource by ID
app.get("/api/resources/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const resource = resources.find((r) => r.id === id);

    if (resource) {
      res.json({ success: true, resource });
    } else {
      res.status(404).json({ success: false, error: "Resource not found" });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Adjust resource workload directly (manual allocation)
app.post("/api/resources/:id/workload", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { added_hours } = req.body;

    if (typeof added_hours !== "number" || isNaN(added_hours)) {
      return res.status(400).json({
        success: false,
        error: "added_hours must be a valid number",
      });
    }

    const resource = resources.find((r) => r.id === id);
    if (!resource) {
      return res
        .status(404)
        .json({ success: false, error: "Resource not found" });
    }

    // Use same assumption as task assignment: 40 hours = 100% workload
    const hoursPerWeek = 40;
    const workloadIncrease = (added_hours / hoursPerWeek) * 100;

    resource.current_workload = Math.min(
      resource.current_workload + workloadIncrease,
      100
    );
    resource.current_workload = Math.round(resource.current_workload * 10) / 10;

    // Update availability based on workload
    resource.availability =
      resource.current_workload >= 80 ? "busy" : "available";

    return res.json({
      success: true,
      resource,
      message: `Workload updated to ${resource.current_workload}% for ${resource.name}`,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create a new task and assign it to a specific resource
app.post("/api/resources/:id/assign-task", (req, res) => {
  try {
    const resourceId = parseInt(req.params.id);
    const {
      title,
      description,
      priority = "medium",
      estimated_hours = 40,
      deadline,
      department,
      complexity = "medium",
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        error: "Title and description are required",
      });
    }

    const resource = resources.find((r) => r.id === resourceId);
    if (!resource) {
      return res
        .status(404)
        .json({ success: false, error: "Resource not found" });
    }

    // Generate new task ID
    const newTaskId =
      tasks.length > 0 ? Math.max(...tasks.map((t) => t.id)) + 1 : 1;

    const taskDepartment = department || resource.department || "Engineering";
    const taskDeadline =
      deadline ||
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10); // default +7 days

    const newTask = {
      id: newTaskId,
      title,
      description,
      priority,
      status: "assigned",
      required_skills: [],
      estimated_hours,
      deadline: taskDeadline,
      assigned_resource: resourceId,
      department: taskDepartment,
      complexity,
    };

    tasks.push(newTask);

    // Update workload similar to /tasks/:taskId/assign
    const hoursPerWeek = 40;
    const workloadIncrease = ((estimated_hours || 40) / hoursPerWeek) * 100;

    resource.current_workload = Math.min(
      resource.current_workload + workloadIncrease,
      100
    );
    resource.current_workload = Math.round(resource.current_workload * 10) / 10;

    // Update availability
    resource.availability =
      resource.current_workload >= 80 ? "busy" : "available";

    // Track assigned tasks on resource
    if (!resource.assigned_tasks) {
      resource.assigned_tasks = [];
    }
    resource.assigned_tasks.push(newTaskId);

    return res.json({
      success: true,
      task: newTask,
      resource,
      message: `Task "${title}" created and assigned to ${resource.name}. Workload updated to ${resource.current_workload}%`,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all tasks with optional filtering
app.get("/api/tasks", (req, res) => {
  try {
    const { status, priority } = req.query;

    let filteredTasks = [...tasks];

    if (status) {
      filteredTasks = filteredTasks.filter((t) => t.status === status);
    }

    if (priority) {
      filteredTasks = filteredTasks.filter((t) => t.priority === priority);
    }

    res.json({
      success: true,
      count: filteredTasks.length,
      tasks: filteredTasks,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Assign task to resource
app.post("/api/tasks/:taskId/assign", (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const { resource_id } = req.body;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) {
      return res.status(404).json({ success: false, error: "Task not found" });
    }

    const resource = resources.find((r) => r.id === resource_id);
    if (!resource) {
      return res
        .status(404)
        .json({ success: false, error: "Resource not found" });
    }

    // Calculate workload increase (assuming 40 hours = 100% capacity per week)
    const hoursPerWeek = 40;
    const workloadIncrease =
      ((task.estimated_hours || 40) / hoursPerWeek) * 100;

    // Update resource workload
    resource.current_workload = Math.min(
      resource.current_workload + workloadIncrease,
      100
    );
    resource.current_workload = Math.round(resource.current_workload * 10) / 10;

    // Update availability based on workload
    resource.availability =
      resource.current_workload >= 80 ? "busy" : "available";

    // Add task to resource's assigned tasks
    if (!resource.assigned_tasks) {
      resource.assigned_tasks = [];
    }
    resource.assigned_tasks.push(taskId);

    // Update task
    task.assigned_resource = resource_id;
    task.status = "assigned";

    res.json({
      success: true,
      task,
      resource,
      message: `Task assigned to ${resource.name}. Workload updated to ${resource.current_workload}%`,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Unassign task from resource
app.post("/api/tasks/:taskId/unassign", (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const task = tasks.find((t) => t.id === taskId);

    if (!task) {
      return res.status(404).json({ success: false, error: "Task not found" });
    }

    if (!task.assigned_resource) {
      return res
        .status(400)
        .json({ success: false, error: "Task is not assigned" });
    }

    const resource = resources.find((r) => r.id === task.assigned_resource);
    if (resource) {
      // Calculate workload decrease
      const hoursPerWeek = 40;
      const workloadDecrease =
        ((task.estimated_hours || 40) / hoursPerWeek) * 100;

      resource.current_workload = Math.max(
        resource.current_workload - workloadDecrease,
        0
      );
      resource.current_workload =
        Math.round(resource.current_workload * 10) / 10;

      // Update availability
      if (resource.current_workload < 80) {
        resource.availability = "available";
      }

      // Remove task from assigned tasks
      if (resource.assigned_tasks && resource.assigned_tasks.includes(taskId)) {
        resource.assigned_tasks = resource.assigned_tasks.filter(
          (id) => id !== taskId
        );
      }
    }

    // Update task
    task.assigned_resource = null;
    task.status = "pending";

    res.json({
      success: true,
      task,
      resource,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// NLP-based resource search
app.post("/api/search", (req, res) => {
  try {
    const { query, top_k = 10 } = req.body;

    if (!query) {
      return res
        .status(400)
        .json({ success: false, error: "Query is required" });
    }

    const results = nlpService.searchCandidates(query, top_k);

    res.json({
      success: true,
      query,
      count: results.length,
      resources: results,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Utility: wrap a promise with a timeout (ms)
function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const message = `${label} timed out after ${ms} ms`;
      console.error(message);
      reject(new Error(message));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

// Recommend resources for a task
app.post("/api/recommend", async (req, res) => {
  try {
    const {
      task_description,
      task_title = "",
      task_id,
      top_k = 5,
      use_ai = true, // Default to true, will fallback to NLP if AI not available
    } = req.body;

    // If task_id provided, get task details
    let taskDesc = task_description;
    let taskTitle = task_title;

    if (task_id) {
      const task = tasks.find((t) => t.id === task_id);
      if (task) {
        taskDesc = task.description;
        taskTitle = task.title;
      }
    }

    if (!taskDesc) {
      return res.status(400).json({
        success: false,
        error: "Task description is required",
      });
    }

    // Use AI if requested and available
    if (use_ai && aiService.geminiModel) {
      try {
        console.log(`Using AI (Gemini) to analyze task: ${taskTitle}`);
        const taskAnalysis = await withTimeout(
          aiService.analyzeTask(taskDesc, taskTitle),
          10000,
          "Gemini analyzeTask (recommend)"
        );
        console.log("AI Analysis:", taskAnalysis);

        // Use AI matching
        const recommendations = aiService.matchResourcesToTask(
          taskAnalysis,
          resources
        );
        const topRecommendations = recommendations.slice(0, top_k);

        // Add AI analysis to response
        const analysisSummary = aiService.generateTaskSummary(taskAnalysis);
        console.log("Answer provider: Gemini (recommend)");

        return res.json({
          success: true,
          task: taskDesc,
          task_analysis: taskAnalysis,
          analysis_summary: analysisSummary,
          count: topRecommendations.length,
          recommendations: topRecommendations,
          ai_powered: true,
        });
      } catch (aiError) {
        console.error("AI analysis error (recommend):", aiError);
        console.log(
          "Falling back to internal NLP matching for recommend endpoint"
        );
        // Fall through to NLP matching
      }
    } else if (use_ai && !aiService.geminiModel) {
      console.log(
        "Gemini model not configured; using internal NLP for recommend endpoint"
      );
    }

    // Fallback to lightweight NLP matching (internal system)
    const recommendations = nlpService.recommendForTask(
      taskDesc,
      taskTitle,
      top_k
    );

    // Generate analysis summary
    const analysisSummary = nlpService.generateTaskSummary(taskDesc, taskTitle);
    console.log("Answer provider: internal NLP (recommend)");

    res.json({
      success: true,
      task: taskDesc,
      count: recommendations.length,
      recommendations,
      analysis_summary: analysisSummary,
      ai_powered: false,
    });
  } catch (error) {
    console.error("Error in recommend:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get statistics
app.get("/api/stats", (req, res) => {
  try {
    const totalResources = resources.length;
    const availableResources = resources.filter(
      (r) => r.availability === "available"
    ).length;
    const busyResources = totalResources - availableResources;

    const totalTasks = tasks.length;
    const pendingTasks = tasks.filter((t) => t.status === "pending").length;
    const assignedTasks = tasks.filter((t) => t.status === "assigned").length;

    // Average workload
    const avgWorkload =
      totalResources > 0
        ? resources.reduce((sum, r) => sum + r.current_workload, 0) /
          totalResources
        : 0;

    // Skills distribution
    const skillCounts = {};
    resources.forEach((resource) => {
      resource.skills.forEach((skill) => {
        skillCounts[skill] = (skillCounts[skill] || 0) + 1;
      });
    });

    const topSkills = Object.entries(skillCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([skill, count]) => ({ skill, count }));

    res.json({
      success: true,
      stats: {
        total_resources: totalResources,
        available_resources: availableResources,
        busy_resources: busyResources,
        total_tasks: totalTasks,
        pending_tasks: pendingTasks,
        assigned_tasks: assignedTasks,
        average_workload: Math.round(avgWorkload * 10) / 10,
        top_skills: topSkills,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Analyze task (AI-powered or lightweight version)
app.post("/api/analyze-task", async (req, res) => {
  try {
    const { task_description, task_title = "", use_ai = true } = req.body;

    if (!task_description) {
      return res.status(400).json({
        success: false,
        error: "Task description is required",
      });
    }

    // Use AI if available, otherwise use NLP fallback
    let analysis;
    let summary;

    if (use_ai && aiService.geminiModel) {
      try {
        analysis = await withTimeout(
          aiService.analyzeTask(task_description, task_title),
          10000,
          "Gemini analyzeTask (analyze-task endpoint)"
        );
        summary = aiService.generateTaskSummary(analysis);
        console.log("Answer provider: Gemini (analyze-task)");
      } catch (aiError) {
        console.error("AI analysis error, using fallback:", aiError);
        analysis = nlpService.analyzeTask(task_description, task_title);
        summary = nlpService.generateTaskSummary(task_description, task_title);
        console.log("Answer provider: internal NLP (analyze-task, fallback)");
      }
    } else {
      analysis = nlpService.analyzeTask(task_description, task_title);
      summary = nlpService.generateTaskSummary(task_description, task_title);
      console.log("Answer provider: internal NLP (analyze-task)");
    }

    res.json({
      success: true,
      analysis,
      summary,
      ai_powered: use_ai && aiService.geminiModel !== null,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log("=".repeat(60));
  console.log("Resource Search Backend Server");
  console.log("=".repeat(60));
  console.log(`Loaded ${resources.length} resources`);
  console.log(`Loaded ${tasks.length} tasks`);
  console.log("AI Service Status:");
  console.log(
    `   - Gemini: ${
      aiService.geminiModel ? "Ready" : "Not configured (using NLP fallback)"
    }`
  );
  console.log(`Server running on port ${PORT}`);
  console.log("=".repeat(60));
});
