/**
 * Lightweight NLP Service
 * No heavy ML models - uses efficient text matching and scoring
 * Optimized for low memory usage (0.5GB RAM on Render free tier)
 */

export class NLPService {
  constructor(resources = []) {
    this.resources = resources;
    
    // Skill aliases for fuzzy matching
    this.skillAliases = {
      '.net': ['asp.net', 'c#', 'dotnet', 'aspnet', 'c# .net', '.net core', 'dotnet core', 'net core', 'net'],
      'asp.net': ['.net', 'c#', 'dotnet', 'aspnet', '.net core'],
      '.net core': ['.net', 'asp.net', 'dotnet', 'dotnet core', 'net core'],
      'azure': ['microsoft azure', 'ms azure', 'azure cloud', 'windows azure'],
      'aws': ['amazon web services', 'amazon aws', 'aws cloud'],
      'gcp': ['google cloud', 'google cloud platform', 'gcloud'],
      'node.js': ['nodejs', 'node', 'node js'],
      'react': ['reactjs', 'react.js', 'react js'],
      'vue': ['vuejs', 'vue.js', 'vue js'],
      'angular': ['angularjs', 'angular.js', 'angular js'],
      'python': ['python3', 'python 3', 'py'],
      'javascript': ['js', 'ecmascript', 'es6', 'es2015'],
      'typescript': ['ts'],
      'kubernetes': ['k8s', 'k8'],
      'docker': ['containers', 'containerization'],
      'c#': ['csharp', 'c sharp', 'c-sharp'],
      'ai': ['artificial intelligence', 'machine learning', 'ml', 'deep learning'],
      'nlp': ['natural language processing', 'language processing'],
      'chatbot': ['chat bot', 'conversational ai', 'bot']
    };
    
    // Common skills for extraction
    this.commonSkills = [
      'react', 'python', 'javascript', 'typescript', 'node.js', 'java', 'c#',
      'angular', 'vue.js', 'django', 'flask', 'fastapi', 'aws', 'azure', 'gcp',
      'docker', 'kubernetes', 'mongodb', 'postgresql', 'mysql', 'redis',
      'graphql', 'rest', 'api', 'microservices', 'machine learning', 'ml',
      'ai', 'nlp', 'data science', 'devops', 'frontend', 'backend', 'full stack',
      'mobile', 'ios', 'android', 'flutter', 'react native', '.net', 'asp.net'
    ];
  }
  
  /**
   * Parse natural language command to extract intent and parameters
   */
  parseCommand(command) {
    const commandLower = command.toLowerCase();
    const parsed = {
      skills: [],
      availability: null,
      expertise_level: null,
      specializations: []
    };
    
    // Extract skills
    for (const skill of this.commonSkills) {
      if (commandLower.includes(skill)) {
        parsed.skills.push(skill);
      }
    }
    
    // Extract availability
    if (['available', 'free', 'not busy'].some(word => commandLower.includes(word))) {
      parsed.availability = 'available';
    }
    
    // Extract expertise level
    if (commandLower.includes('senior') || commandLower.includes('experienced')) {
      parsed.expertise_level = 'senior';
    } else if (commandLower.includes('junior') || commandLower.includes('entry')) {
      parsed.expertise_level = 'junior';
    } else if (commandLower.includes('mid') || commandLower.includes('intermediate')) {
      parsed.expertise_level = 'mid';
    } else if (commandLower.includes('expert') || commandLower.includes('architect')) {
      parsed.expertise_level = 'expert';
    }
    
    return parsed;
  }
  
  /**
   * Normalize skill name to handle aliases
   */
  normalizeSkill(skill) {
    const skillLower = skill.toLowerCase();
    const aliases = new Set([skillLower]);
    
    // Check if this skill has aliases
    for (const [mainSkill, aliasList] of Object.entries(this.skillAliases)) {
      if (skillLower === mainSkill || aliasList.includes(skillLower)) {
        aliases.add(mainSkill);
        aliasList.forEach(alias => aliases.add(alias));
      }
    }
    
    return aliases;
  }
  
  /**
   * Calculate text similarity using simple word overlap
   * Lightweight alternative to cosine similarity with embeddings
   */
  calculateSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\W+/).filter(w => w.length > 2));
    const words2 = new Set(text2.toLowerCase().split(/\W+/).filter(w => w.length > 2));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    // Jaccard similarity
    return union.size > 0 ? intersection.size / union.size : 0;
  }
  
  /**
   * Score resource match based on query
   */
  scoreResource(resource, query) {
    let score = 0;
    const queryLower = query.toLowerCase();
    const resourceText = [
      resource.title || '',
      resource.name || '',
      ...(resource.skills || []),
      ...(resource.specializations || []),
      resource.department || '',
      resource.expertise_level || ''
    ].join(' ').toLowerCase();
    
    // Text similarity score
    score += this.calculateSimilarity(query, resourceText) * 40;
    
    // Skill matching
    const querySkills = this.commonSkills.filter(skill => queryLower.includes(skill));
    if (querySkills.length > 0) {
      const resourceSkillsNormalized = new Set();
      (resource.skills || []).forEach(skill => {
        this.normalizeSkill(skill).forEach(alias => resourceSkillsNormalized.add(alias));
      });
      
      let matchedSkills = 0;
      querySkills.forEach(querySkill => {
        const querySkillNormalized = this.normalizeSkill(querySkill);
        if ([...querySkillNormalized].some(alias => resourceSkillsNormalized.has(alias))) {
          matchedSkills++;
        }
      });
      
      score += (matchedSkills / querySkills.length) * 30;
    }
    
    // Availability bonus
    if (queryLower.includes('available') && resource.availability === 'available') {
      score += 15;
    }
    
    // Expertise level matching
    if (queryLower.includes('senior') && resource.expertise_level === 'senior') {
      score += 10;
    } else if (queryLower.includes('junior') && resource.expertise_level === 'junior') {
      score += 10;
    }
    
    // Department matching
    const departments = ['engineering', 'devops', 'data', 'design', 'marketing'];
    for (const dept of departments) {
      if (queryLower.includes(dept) && resource.department?.toLowerCase().includes(dept)) {
        score += 5;
      }
    }
    
    return score;
  }
  
  /**
   * Filter candidates based on parsed query
   */
  filterCandidates(parsedQuery) {
    let filtered = [...this.resources];
    
    if (parsedQuery.availability) {
      filtered = filtered.filter(r => r.availability === parsedQuery.availability);
    }
    
    if (parsedQuery.expertise_level) {
      filtered = filtered.filter(r => r.expertise_level === parsedQuery.expertise_level);
    }
    
    if (parsedQuery.skills && parsedQuery.skills.length > 0) {
      filtered = filtered.filter(r => {
        const resourceSkillsNormalized = new Set();
        (r.skills || []).forEach(skill => {
          this.normalizeSkill(skill).forEach(alias => resourceSkillsNormalized.add(alias));
        });
        
        return parsedQuery.skills.some(querySkill => {
          const querySkillNormalized = this.normalizeSkill(querySkill);
          return [...querySkillNormalized].some(alias => resourceSkillsNormalized.has(alias));
        });
      });
    }
    
    return filtered;
  }
  
  /**
   * Search candidates using NLP
   */
  searchCandidates(query, topK = 10) {
    // Parse the command
    const parsed = this.parseCommand(query);
    
    // First filter by hard constraints
    let candidates = this.filterCandidates(parsed);
    
    // If no filtered results, use all candidates
    if (candidates.length === 0) {
      candidates = [...this.resources];
    }
    
    // Score and rank candidates
    const scored = candidates.map(resource => ({
      ...resource,
      match_score: this.scoreResource(resource, query) / 100
    }));
    
    // Sort by score descending
    scored.sort((a, b) => b.match_score - a.match_score);
    
    // Return top K
    return scored.slice(0, topK);
  }
  
  /**
   * Recommend resources for a task
   */
  recommendForTask(taskDescription, taskTitle = '', topK = 5) {
    // Focus on available candidates
    const availableCandidates = this.resources.filter(
      r => r.availability === 'available'
    );
    
    if (availableCandidates.length === 0) {
      return [];
    }
    
    // Combine title and description for matching
    const taskText = `${taskTitle} ${taskDescription}`;
    
    // Score candidates
    const scored = availableCandidates.map(resource => {
      const score = this.scoreResource(resource, taskText);
      
      // Additional scoring for task matching
      let taskScore = score;
      
      // Check required skills from task
      const taskSkills = this.extractSkillsFromText(taskText);
      if (taskSkills.length > 0) {
        const resourceSkillsNormalized = new Set();
        (resource.skills || []).forEach(skill => {
          this.normalizeSkill(skill).forEach(alias => resourceSkillsNormalized.add(alias));
        });
        
        let matchedSkills = 0;
        taskSkills.forEach(taskSkill => {
          const taskSkillNormalized = this.normalizeSkill(taskSkill);
          if ([...taskSkillNormalized].some(alias => resourceSkillsNormalized.has(alias))) {
            matchedSkills++;
          }
        });
        
        taskScore += (matchedSkills / taskSkills.length) * 30;
      }
      
      // Workload consideration
      const workload = resource.current_workload || 50;
      if (workload < 50) {
        taskScore += 10;
      } else if (workload < 70) {
        taskScore += 5;
      }
      
      // Experience matching
      const complexity = this.detectComplexity(taskText);
      if (complexity === 'high' && resource.expertise_level === 'senior') {
        taskScore += 10;
      } else if (complexity === 'low' && ['junior', 'mid'].includes(resource.expertise_level)) {
        taskScore += 5;
      }
      
      return {
        ...resource,
        match_score: Math.min(taskScore / 100, 1.0),
        recommendation_reason: this.generateRecommendationReason(resource, taskText)
      };
    });
    
    // Sort by score descending
    scored.sort((a, b) => b.match_score - a.match_score);
    
    return scored.slice(0, topK);
  }
  
  /**
   * Extract skills from text
   */
  extractSkillsFromText(text) {
    const textLower = text.toLowerCase();
    return this.commonSkills.filter(skill => textLower.includes(skill));
  }
  
  /**
   * Detect complexity from text
   */
  detectComplexity(text) {
    const textLower = text.toLowerCase();
    if (['complex', 'architecture', 'system', 'enterprise', 'critical'].some(w => textLower.includes(w))) {
      return 'high';
    }
    if (['simple', 'basic', 'small', 'quick'].some(w => textLower.includes(w))) {
      return 'low';
    }
    return 'medium';
  }
  
  /**
   * Generate recommendation reason
   */
  generateRecommendationReason(resource, taskText) {
    const reasons = [];
    
    if (resource.experience_years) {
      reasons.push(`${resource.experience_years} years of experience`);
    }
    
    if (resource.expertise_level) {
      reasons.push(`${resource.expertise_level} level expertise`);
    }
    
    if (resource.projects_completed) {
      reasons.push(`${resource.projects_completed} projects completed`);
    }
    
    // Check skill matches
    const taskSkills = this.extractSkillsFromText(taskText);
    const matchedSkills = (resource.skills || []).filter(skill => {
      const skillNormalized = this.normalizeSkill(skill);
      return taskSkills.some(taskSkill => {
        const taskSkillNormalized = this.normalizeSkill(taskSkill);
        // Check if any alias from skillNormalized exists in taskSkillNormalized Set
        return [...skillNormalized].some(alias => taskSkillNormalized.has(alias));
      });
    });
    
    if (matchedSkills.length > 0) {
      reasons.push(`Matches ${matchedSkills.length} required skill${matchedSkills.length > 1 ? 's' : ''}`);
    }
    
    return reasons.length > 0 ? reasons.join(' • ') : 'Good match for this task';
  }
  
  /**
   * Analyze task (lightweight version)
   */
  analyzeTask(taskDescription, taskTitle = '') {
    const text = `${taskTitle} ${taskDescription}`.toLowerCase();
    
    // Extract skills
    const requiredSkills = this.extractSkillsFromText(text);
    
    // Detect department
    let department = 'Engineering';
    if (['devops', 'infrastructure', 'deploy', 'kubernetes', 'docker'].some(w => text.includes(w))) {
      department = 'DevOps';
    } else if (['data', 'analytics', 'ml', 'ai', 'machine learning'].some(w => text.includes(w))) {
      department = 'Data';
    } else if (['design', 'ui', 'ux', 'frontend'].some(w => text.includes(w))) {
      department = 'Design';
    }
    
    // Detect complexity
    const complexity = this.detectComplexity(text);
    
    // Detect priority
    let priority = 'medium';
    if (['urgent', 'critical', 'asap', 'immediately'].some(w => text.includes(w))) {
      priority = 'critical';
    } else if (['important', 'priority', 'soon'].some(w => text.includes(w))) {
      priority = 'high';
    } else if (['low', 'later'].some(w => text.includes(w))) {
      priority = 'low';
    }
    
    // Estimate hours (simple heuristic)
    let estimatedHours = 40;
    if (complexity === 'high') {
      estimatedHours = 80;
    } else if (complexity === 'low') {
      estimatedHours = 20;
    }
    
    return {
      required_skills: requiredSkills.length > 0 ? requiredSkills : ['General Development'],
      all_skills_required: text.includes(' and ') || text.includes(' & '),
      related_skills: [],
      department,
      complexity,
      priority,
      estimated_hours: estimatedHours,
      key_requirements: taskTitle || 'Task analysis'
    };
  }
  
  /**
   * Generate task summary
   */
  generateTaskSummary(taskDescription, taskTitle = '') {
    const analysis = this.analyzeTask(taskDescription, taskTitle);
    const skills = analysis.required_skills.join(', ') || 'General Development';
    return `**Skills needed:** ${skills} | **Complexity:** ${analysis.complexity} | **Priority:** ${analysis.priority} | **Est. hours:** ${analysis.estimated_hours}`;
  }
}

