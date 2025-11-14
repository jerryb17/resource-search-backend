/**
 * AI Service for intelligent task analysis and resource matching
 * Supports Google Gemini AI
 * Converted from Python ai_service.py
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

class AIService {
  constructor() {
    this.aiProvider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
    this.geminiModel = null;

    // Initialize Gemini
    if (this.aiProvider === "gemini" || this.aiProvider === "both") {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (geminiKey && geminiKey !== "your_gemini_api_key_here") {
        try {
          const genAI = new GoogleGenerativeAI(geminiKey);
          // Use gemini-2.0-flash (stable and fast model)
          this.geminiModel = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
          });
          console.log("✅ Gemini AI initialized (using gemini-2.0-flash)");
        } catch (error) {
          console.error("❌ Error initializing Gemini:", error.message);
          this.geminiModel = null;
        }
      } else {
        this.geminiModel = null;
        console.log(
          "⚠️  Gemini API key not configured - using fallback analysis"
        );
      }
    }
  }

  /**
   * Analyze a task using AI or fallback to keyword extraction
   * Returns task analysis even if AI is not configured
   */
  async analyzeTask(taskDescription, taskTitle = "") {
    const prompt = `You are an expert technical recruiter and project analyzer. Analyze the following task/query and extract detailed requirements.

**CRITICAL SKILL MATCHING RULES:**
1. When "AND" is used (e.g., "React AND Python" or "React Python"), BOTH skills are REQUIRED
2. List all REQUIRED skills separately - do not combine them  
3. Set "all_skills_required" to true when ALL skills must be present (uses "and"/"&" or comma)
4. Set "all_skills_required" to false when ANY skill is acceptable (uses "or")

**SKILL RELATIONSHIPS (Treat as equivalent):**
- .NET = ASP.NET = C# .NET = DotNet = ASPNET
- Node.js = NodeJS = Node
- .NET = ASP.NET = .NET Core = dotnet
- Azure = Microsoft Azure = MS Azure
- AWS = Amazon Web Services
- GCP = Google Cloud Platform
- React = ReactJS = React.js
- Vue = VueJS = Vue.js  
- Angular = AngularJS = Angular.js
- Node = NodeJS = Node.js
- Python = Python3
- JavaScript = JS = ECMAScript
- TypeScript = TS
- Kubernetes = K8s
- C# = CSharp
- AI = Machine Learning = ML
- NLP = Natural Language Processing
- Chatbot = Chat Bot

**Task Title:** ${taskTitle}
**Query/Description:** ${taskDescription}

Extract and return JSON with these fields:
1. required_skills: List ALL required skills (if "A and B", list both ["A", "B"])
2. all_skills_required: true if ALL skills needed, false if ANY skill acceptable
3. related_skills: Related/nice-to-have skills
4. department: Engineering, Design, Marketing, Data, etc.
5. complexity: "low", "medium", "high", or "critical"  
6. priority: "low", "medium", "high", or "critical"
7. estimated_hours: 10-200
8. key_requirements: Brief summary

**EXAMPLES:**

Query: "Find me a React and Python developer"
{
  "required_skills": ["React", "Python"],
  "all_skills_required": true,
  "related_skills": ["JavaScript", "TypeScript", "Django"],
  "department": "Engineering",
  "complexity": "medium",
  "priority": "medium",
  "estimated_hours": 40,
  "key_requirements": "Full stack developer with React and Python"
}

Query: "Find me an Angular and .NET developer"  
{
  "required_skills": ["Angular", ".NET"],
  "all_skills_required": true,
  "related_skills": ["TypeScript", "C#", "ASP.NET", ".NET Core"],
  "department": "Engineering",
  "complexity": "medium",
  "priority": "medium",
  "estimated_hours": 40,
  "key_requirements": "Full stack with Angular and .NET"
}

Query: "Azure developer"
{
  "required_skills": ["Azure"],
  "all_skills_required": true,
  "related_skills": ["Cloud", "DevOps", "Terraform", "Kubernetes"],
  "department": "DevOps",
  "complexity": "medium",
  "priority": "medium",
  "estimated_hours": 40,
  "key_requirements": "Cloud developer with Azure experience"
}

Query: ".NET Core developer"
{
  "required_skills": [".NET Core"],
  "all_skills_required": true,
  "related_skills": ["C#", "ASP.NET", "Azure", "SQL Server"],
  "department": "Engineering",
  "complexity": "medium",
  "priority": "medium",
  "estimated_hours": 40,
  "key_requirements": "Backend developer with .NET Core"
}

Query: "Find me a React or Python developer"
{
  "required_skills": ["React", "Python"],
  "all_skills_required": false,
  "related_skills": ["JavaScript", "TypeScript"],
  "department": "Engineering",
  "complexity": "medium",
  "priority": "medium",
  "estimated_hours": 40,
  "key_requirements": "Developer with React or Python skills"
}

Return ONLY valid JSON, no other text.`;

    try {
      // Try Gemini first (free and fast)
      if (this.geminiModel) {
        const genResult = await this.geminiModel.generateContent(prompt);
        const response = await genResult.response;
        let resultText = response.text().trim();

        // Clean up response (remove markdown code blocks if present)
        if (resultText.startsWith("```json")) {
          resultText = resultText.split("```json")[1].split("```")[0].trim();
        } else if (resultText.startsWith("```")) {
          resultText = resultText.split("```")[1].split("```")[0].trim();
        }

        const parsed = JSON.parse(resultText);
        return parsed;
      } else {
        // No AI available, use simple keyword extraction
        return this._fallbackAnalysis(taskDescription, taskTitle);
      }
    } catch (error) {
      console.error("❌ AI analysis error:", error.message);
      console.log("💡 Falling back to keyword-based analysis");
      return this._fallbackAnalysis(taskDescription, taskTitle);
    }
  }

  /**
   * Fallback keyword-based analysis when AI is not available
   */
  _fallbackAnalysis(description, title) {
    const text = `${title} ${description}`.toLowerCase();

    // Skill detection
    const skillKeywords = {
      react: ["react", "reactjs"],
      python: ["python"],
      javascript: ["javascript", "js"],
      typescript: ["typescript", "ts"],
      "node.js": ["node", "nodejs"],
      aws: ["aws", "amazon web services"],
      docker: ["docker", "container"],
      kubernetes: ["kubernetes", "k8s"],
      api: ["api", "rest", "graphql"],
    };

    const detectedSkills = [];
    for (const [skill, keywords] of Object.entries(skillKeywords)) {
      if (keywords.some((kw) => text.includes(kw))) {
        detectedSkills.push(skill.charAt(0).toUpperCase() + skill.slice(1));
      }
    }

    // Department detection
    let department = "Engineering";
    if (
      ["devops", "infrastructure", "deploy", "kubernetes", "docker"].some((w) =>
        text.includes(w)
      )
    ) {
      department = "DevOps";
    } else if (
      ["data", "analytics", "ml", "ai", "machine learning"].some((w) =>
        text.includes(w)
      )
    ) {
      department = "Data";
    } else if (
      ["design", "ui", "ux", "frontend"].some((w) => text.includes(w))
    ) {
      department = "Design";
    }

    // Complexity detection
    let complexity = "medium";
    if (
      ["complex", "architecture", "system", "enterprise"].some((w) =>
        text.includes(w)
      )
    ) {
      complexity = "high";
    } else if (["simple", "basic", "small"].some((w) => text.includes(w))) {
      complexity = "low";
    }

    // Priority detection
    let priority = "medium";
    if (
      ["urgent", "critical", "asap", "immediately"].some((w) =>
        text.includes(w)
      )
    ) {
      priority = "critical";
    } else if (
      ["important", "priority", "soon"].some((w) => text.includes(w))
    ) {
      priority = "high";
    } else if (["low", "later"].some((w) => text.includes(w))) {
      priority = "low";
    }

    return {
      required_skills:
        detectedSkills.length > 0 ? detectedSkills : ["General Development"],
      all_skills_required: text.includes(" and ") || text.includes(" & "),
      related_skills: [],
      department,
      complexity,
      priority,
      estimated_hours:
        complexity === "high" ? 80 : complexity === "low" ? 20 : 40,
      key_requirements: title || "Task analysis",
    };
  }

  /**
   * Intelligently match resources to a task based on AI analysis
   * Respects "all_skills_required" flag for AND logic
   * Returns resources ranked by suitability
   */
  matchResourcesToTask(taskAnalysis, resources) {
    const requiredSkills = (taskAnalysis.required_skills || []).map((s) =>
      s.toLowerCase()
    );
    const allSkillsRequired = taskAnalysis.all_skills_required || false;
    const relatedSkills = (taskAnalysis.related_skills || []).map((s) =>
      s.toLowerCase()
    );
    const complexity = taskAnalysis.complexity || "medium";

    // Skill relationship mapping for fuzzy matching
    const skillAliases = {
      ".net": [
        "asp.net",
        "c#",
        "dotnet",
        "aspnet",
        "c# .net",
        ".net core",
        "dotnet core",
        "net core",
        "net",
      ],
      "asp.net": [".net", "c#", "dotnet", "aspnet", ".net core"],
      ".net core": [".net", "asp.net", "dotnet", "dotnet core", "net core"],
      azure: ["microsoft azure", "ms azure", "azure cloud", "windows azure"],
      aws: ["amazon web services", "amazon aws", "aws cloud"],
      gcp: ["google cloud", "google cloud platform", "gcloud"],
      "node.js": ["nodejs", "node", "node js"],
      react: ["reactjs", "react.js", "react js"],
      vue: ["vuejs", "vue.js", "vue js"],
      angular: ["angularjs", "angular.js", "angular js"],
      python: ["python3", "python 3", "py"],
      javascript: ["js", "ecmascript", "es6", "es2015"],
      typescript: ["ts"],
      kubernetes: ["k8s", "k8"],
      docker: ["containers", "containerization"],
      "c#": ["csharp", "c sharp", "c-sharp"],
      ai: [
        "artificial intelligence",
        "machine learning",
        "ml",
        "deep learning",
      ],
      nlp: ["natural language processing", "language processing"],
      chatbot: ["chat bot", "conversational ai", "bot"],
    };

    const normalizeSkill = (skill) => {
      const skillLower = skill.toLowerCase();
      const aliases = new Set([skillLower]);

      // Check if this skill has aliases
      for (const [mainSkill, aliasList] of Object.entries(skillAliases)) {
        if (skillLower === mainSkill || aliasList.includes(skillLower)) {
          aliases.add(mainSkill);
          aliasList.forEach((alias) => aliases.add(alias));
        }
      }

      return aliases;
    };

    const scoredResources = [];

    for (const resource of resources) {
      let score = 0;
      const reasons = [];

      // Normalize resource skills
      const resourceSkillsNormalized = new Set();
      (resource.skills || []).forEach((skill) => {
        normalizeSkill(skill).forEach((alias) =>
          resourceSkillsNormalized.add(alias)
        );
      });

      // Skill matching with AND/OR logic
      if (requiredSkills.length > 0) {
        const matchedSkills = [];
        const missingSkills = [];

        for (const requiredSkill of requiredSkills) {
          const requiredSkillNormalized = normalizeSkill(requiredSkill);

          // Check if any alias matches
          const hasMatch = [...requiredSkillNormalized].some((alias) =>
            resourceSkillsNormalized.has(alias)
          );

          if (hasMatch) {
            matchedSkills.push(requiredSkill);
          } else {
            missingSkills.push(requiredSkill);
          }
        }

        // Apply AND logic: if all_skills_required=true, must have ALL skills
        if (allSkillsRequired) {
          if (missingSkills.length > 0) {
            // Missing required skills - skip this resource entirely
            continue;
          } else {
            // Has ALL required skills - high score!
            score += 60;
            reasons.push(`✅ Has ALL ${matchedSkills.length} required skills`);
          }
        } else {
          // OR logic: any matching skill is good
          const skillMatchRatio = matchedSkills.length / requiredSkills.length;
          score += skillMatchRatio * 50;
          if (matchedSkills.length > 0) {
            reasons.push(
              `Has ${matchedSkills.length}/${requiredSkills.length} required skills`
            );
          }
        }

        // Bonus for matching related skills
        let relatedMatched = 0;
        for (const relatedSkill of relatedSkills) {
          const relatedNormalized = normalizeSkill(relatedSkill);
          if (
            [...relatedNormalized].some((alias) =>
              resourceSkillsNormalized.has(alias)
            )
          ) {
            relatedMatched++;
          }
        }

        if (relatedMatched > 0) {
          score += relatedMatched * 5;
          reasons.push(`Has ${relatedMatched} related skills`);
        }
      }

      // Availability check
      if (resource.availability === "available") {
        score += 20;
        reasons.push("Currently available");
      } else {
        score += 5; // Still include busy resources but with lower score
      }

      // Workload consideration
      const workload = resource.current_workload || 50;
      if (workload < 50) {
        score += 15;
        reasons.push("Low workload");
      } else if (workload < 70) {
        score += 10;
        reasons.push("Moderate workload");
      } else {
        score += 5;
      }

      // Expertise level matching
      const expertise = resource.expertise_level || "mid";
      if (complexity === "high" && ["senior", "expert"].includes(expertise)) {
        score += 15;
        reasons.push("Senior level for complex task");
      } else if (
        complexity === "low" &&
        ["junior", "mid"].includes(expertise)
      ) {
        score += 10;
        reasons.push("Appropriate experience level");
      } else if (
        complexity === "medium" &&
        ["mid", "senior"].includes(expertise)
      ) {
        score += 10;
        reasons.push("Good experience match");
      }

      // Department match
      const taskDept = taskAnalysis.department || "";
      if (resource.department === taskDept) {
        score += 5;
        reasons.push("Same department");
      }

      // Only include resources with meaningful scores
      if (score > 20) {
        const resourceCopy = { ...resource };
        resourceCopy.match_score = Math.min(score / 100, 1.0); // Normalize to 0-1
        resourceCopy.recommendation_reason = reasons.join(" • ");
        scoredResources.push(resourceCopy);
      }
    }

    // Sort by score descending
    scoredResources.sort((a, b) => b.match_score - a.match_score);

    return scoredResources;
  }

  /**
   * Generate a human-readable summary of task analysis
   */
  generateTaskSummary(taskAnalysis) {
    const skills = (taskAnalysis.required_skills || []).join(", ");
    const complexity = taskAnalysis.complexity || "medium";
    const priority = taskAnalysis.priority || "medium";
    const hours = taskAnalysis.estimated_hours || "unknown";

    return `**Skills needed:** ${skills} | **Complexity:** ${complexity} | **Priority:** ${priority} | **Est. hours:** ${hours}`;
  }
}

// Singleton instance
export const aiService = new AIService();
