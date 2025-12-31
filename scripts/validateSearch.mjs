import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NLPService } from "../nlpService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resourcesPath = path.join(__dirname, "..", "data", "resources_data.json");
const resources = JSON.parse(fs.readFileSync(resourcesPath, "utf8"));

const nlp = new NLPService(resources);

const query =
  process.argv.slice(2).join(" ") ||
  "Find me VueJS and Node developer having more than 10 years of experience";

const parsed = nlp.parseCommand(query);
const results = nlp.searchCandidates(query, 10);

console.log("Query:", query);
console.log("Parsed:", parsed);
console.log("Result count:", results.length);
console.log(
  "Top results:",
  results.map((r) => ({
    id: r.id,
    name: r.name,
    experience_years: r.experience_years,
    skills: r.skills,
    match_score: r.match_score,
  }))
);


