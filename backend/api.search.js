/**
 * India Job/Internship Finder from Resume
 * ─────────────────────────────────────────
 * Model  : Gemini 2.5 Flash (free tier via Google AI Studio)
 * Search : SerpAPI  (100 free queries/month)
 *
 * Pipeline:
 *  1. Parse resume  (PDF / TXT)
 *  2. Gemini → structured candidate profile
 *  3. Gemini → 6 targeted SerpAPI search queries
 *  4. SerpAPI → parallel search across top Indian job portals
 *  5. Gemini → score & filter results (≥6/10 kept)
 *  6. Print ranked URLs + save JSON
 */

import { GoogleGenAI } from "@google/genai";
import axios from "axios";
import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";

// ─────────────────────────────────────────────────────────
//  CONFIG  — provide keys via env vars or edit defaults
// ─────────────────────────────────────────────────────────
const CONFIG = {
  geminiApiKey : process.env.GEMINI_API_KEY  || "",   // https://aistudio.google.com/apikey
  serpApiKey   : process.env.SERP_API_KEY    || "",   // https://serpapi.com/
  model        : "gemini-2.5-flash",
  maxResults   : 20,   // final URLs to surface
  resultsPerQuery : 5, // SerpAPI results per search call
};

// ─────────────────────────────────────────────────────────
//  INDIAN JOB PORTALS — used for site-restricted searches
// ─────────────────────────────────────────────────────────
const JOB_PORTALS = [
  { name: "LinkedIn India",   site: "linkedin.com/jobs"  },
  { name: "Naukri",           site: "naukri.com"         },
  { name: "Internshala",      site: "internshala.com"    },
  { name: "Indeed India",     site: "in.indeed.com"      },
  { name: "Shine",            site: "shine.com"          },
  { name: "Foundit (Monster)",site: "foundit.in"         },
  { name: "IIMJobs",          site: "iimjobs.com"        },
  { name: "Hirist (Tech)",    site: "hirist.tech"        },
  { name: "Wellfound",        site: "wellfound.com"      },
  { name: "Cutshort",         site: "cutshort.io"        },
];

// ─────────────────────────────────────────────────────────
//  Gemini client initialisation
// ─────────────────────────────────────────────────────────
function getGemini() {
  if (!CONFIG.geminiApiKey) throw new Error("GEMINI_API_KEY is not set");
  const genAI = new GoogleGenerativeAI(CONFIG.geminiApiKey);
  return genAI.getGenerativeModel({ model: CONFIG.model });
}

async function geminiJSON(prompt) {
  const model = getGemini();
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",  // force pure JSON output
    },
  });
  const text = result.response.text().trim();
  // Strip any accidental markdown fences just in case
  const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/,"");
  return JSON.parse(clean);
}

// ─────────────────────────────────────────────────────────
//  STEP 1 — Parse resume (PDF / TXT / MD)
// ─────────────────────────────────────────────────────────
async function parseResume(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") {
    const data = await pdfParse(fs.readFileSync(filePath));
    return data.text;
  }
  if ([".txt", ".md"].includes(ext)) {
    return fs.readFileSync(filePath, "utf-8");
  }
  throw new Error(`Unsupported file type: ${ext}  →  use .pdf or .txt`);
}

// ─────────────────────────────────────────────────────────
//  STEP 2 — Extract structured candidate profile
// ─────────────────────────────────────────────────────────
async function extractProfile(resumeText) {
  console.log("🔍 Extracting profile from resume with Gemini...");

  const profile = await geminiJSON(`
You are an expert resume parser. Extract a structured profile from the resume below.
Return ONLY valid JSON matching this exact schema (no extra keys, no markdown):

{
  "name": "string",
  "targetRoles": ["string"],
  "skills": ["string"],
  "yearsOfExperience": 0,
  "educationLevel": "student|fresher|mid-level|senior",
  "educationDomain": "string",
  "keyAchievements": ["string"],
  "preferredLocations": ["string"],
  "jobType": "internship|full-time|both"
}

Notes:
- targetRoles: top 3 roles this person should apply for
- skills: top 10 technical/domain skills
- yearsOfExperience: 0 for students/freshers
- preferredLocations: extract from resume; default to ["India"] if absent
- jobType: infer from education level — students → internship; 0–1 yr → both; else full-time

Resume (first 6000 chars):
${resumeText.slice(0, 6000)}
`);

  return profile;
}

// ─────────────────────────────────────────────────────────
//  STEP 3 — Generate targeted search queries
// ─────────────────────────────────────────────────────────
async function generateSearchQueries(profile) {
  console.log("🧠 Generating search queries with Gemini...");

  const jobWord = profile.jobType === "internship" ? "internship" : "job";

  const queries = await geminiJSON(`
You are a job search expert for the Indian job market.
Generate exactly 8 Google search queries to find ${jobWord}s for this candidate.

CANDIDATE:
${JSON.stringify(profile, null, 2)}

Rules:
- Each query: 5–10 words, Google-friendly
- Mix: role-based, skill-based, location-specific queries
- Always include "India" or a major Indian city (Bangalore, Mumbai, Delhi, Hyderabad, Pune, Chennai)
- For students/freshers: mix in "fresher", "entry level", "internship" terms
- Include one "remote" query
- Return a JSON array of exactly 8 strings — nothing else

Example: ["Node.js backend developer jobs Bangalore", "fresher Python internship India 2024", ...]
`);

  return Array.isArray(queries) ? queries : JSON.parse(queries);
}

// ─────────────────────────────────────────────────────────
//  STEP 4 — SerpAPI search  (site-restricted)
// ─────────────────────────────────────────────────────────
async function searchSerpAPI(query, site = null) {
  const q = site ? `site:${site} ${query}` : query;

  const { data } = await axios.get("https://serpapi.com/search.json", {
    params: {
      api_key  : CONFIG.serpApiKey,
      q,
      location : "India",
      hl       : "en",
      gl       : "in",
      num      : CONFIG.resultsPerQuery,
      engine   : "google",
    },
    timeout: 10_000,
  });

  return (data.organic_results || [])
    .slice(0, CONFIG.resultsPerQuery)
    .map((item) => ({
      url     : item.link,
      title   : item.title   || "",
      snippet : item.snippet || "",
    }));
}

// ─────────────────────────────────────────────────────────
//  STEP 4 orchestrator — parallel portal searches
// ─────────────────────────────────────────────────────────
async function fetchJobUrls(queries, profile) {
  console.log("🌐 Searching Indian job portals via SerpAPI...");

  const topPortals = JOB_PORTALS.slice(0, 5);       // LinkedIn, Naukri, Internshala, Indeed, Shine
  const topQueries = queries.slice(0, 4);            // first 4 queries per portal

  const searches = [];

  // Portal-specific site-restricted searches
  for (const portal of topPortals) {
    for (const query of topQueries) {
      searches.push(
        searchSerpAPI(query, portal.site)
          .then((results) => results.map((r) => ({ ...r, portalName: portal.name })))
          .catch(() => [])
      );
    }
  }

  // Broad multi-portal searches for remaining queries
  for (const query of queries) {
    searches.push(
      searchSerpAPI(
        `${query} (site:naukri.com OR site:internshala.com OR site:linkedin.com/jobs OR site:in.indeed.com)`
      )
        .then((results) => results.map((r) => ({ ...r, portalName: detectPortal(r.url) })))
        .catch(() => [])
    );
  }

  const settled = await Promise.allSettled(searches);

  const seen = new Set();
  const allResults = [];

  for (const outcome of settled) {
    if (outcome.status !== "fulfilled") continue;
    for (const job of outcome.value) {
      if (job.url && !seen.has(job.url)) {
        seen.add(job.url);
        allResults.push(job);
      }
    }
  }

  console.log(`   ✅ ${allResults.length} unique raw results collected`);
  return allResults;
}

// ─────────────────────────────────────────────────────────
//  STEP 5 — Gemini re-ranks and filters results
// ─────────────────────────────────────────────────────────
async function rankAndFilter(jobs, profile) {
  console.log("⚡ Ranking results by resume relevance with Gemini...");

  if (jobs.length === 0) return [];

  // Cap batch at 50 to stay within token limits
  const batch = jobs.slice(0, 50);

  const listings = batch.map((j, i) => ({
    id     : i,
    url    : j.url,
    title  : j.title,
    snippet: j.snippet?.slice(0, 180),
  }));

  const ranked = await geminiJSON(`
You are a job-matching expert specialising in the Indian job market.
Score each listing for fit against this candidate profile.

CANDIDATE PROFILE:
${JSON.stringify(profile, null, 2)}

JOB LISTINGS:
${JSON.stringify(listings, null, 2)}

Scoring guide (1–10):
  10 = perfect match (role + skills + experience level + location)
   8 = strong match (role + most skills match)
   6 = decent match (related role or skills overlap)
  <6 = poor match — exclude

Return ONLY a JSON array sorted by score descending.
Only include listings with score >= 6.
Schema: [{ "id": number, "score": number, "reason": "one concise sentence" }]
`);

  const arr = Array.isArray(ranked) ? ranked : JSON.parse(ranked);

  return arr
    .filter((r) => r.score >= 6)
    .slice(0, CONFIG.maxResults)
    .map((r) => {
      const job = batch[r.id] || {};
      return {
        url   : job.url,
        title : job.title,
        score : r.score,
        reason: r.reason,
        portal: job.portalName || detectPortal(job.url),
      };
    });
}

// ─────────────────────────────────────────────────────────
//  Helper — detect portal from URL
// ─────────────────────────────────────────────────────────
function detectPortal(url = "") {
  for (const p of JOB_PORTALS) {
    if (url.includes(p.site.split("/")[0])) return p.name;
  }
  return "Other";
}

// ─────────────────────────────────────────────────────────
//  STEP 6 — Format and display output
// ─────────────────────────────────────────────────────────
function formatOutput(profile, rankedJobs) {
  console.log("\n" + "═".repeat(65));
  console.log(`🎯  RESULTS FOR : ${profile.name}`);
  console.log(`📋  Target Roles: ${profile.targetRoles.join(", ")}`);
  console.log(`💼  Job Type    : ${profile.jobType}`);
  console.log(`🔗  Found       : ${rankedJobs.length} relevant listings`);
  console.log("═".repeat(65));

  rankedJobs.forEach((job, i) => {
    console.log(`\n#${i + 1}  [${job.score}/10]  ${job.portal}`);
    console.log(`   📌  ${job.title}`);
    console.log(`   🔗  ${job.url}`);
    console.log(`   💡  ${job.reason}`);
  });

  const output = {
    candidate   : profile.name,
    targetRoles : profile.targetRoles,
    jobType     : profile.jobType,
    totalFound  : rankedJobs.length,
    generatedAt : new Date().toISOString(),
    results     : rankedJobs.map((j, i) => ({
      rank        : i + 1,
      portal      : j.portal,
      title       : j.title,
      url         : j.url,
      matchScore  : j.score,
      matchReason : j.reason,
    })),
  };

  return output;
}

// ─────────────────────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────────────────────
async function findJobs(resumeFilePath, options = {}) {
  console.log("🚀 India Job Finder  |  Gemini 2.5 Flash + SerpAPI\n");

  Object.assign(CONFIG, options);

  if (!CONFIG.geminiApiKey) throw new Error("GEMINI_API_KEY is not set  →  https://aistudio.google.com/apikey");
  if (!CONFIG.serpApiKey)   throw new Error("SERP_API_KEY is not set    →  https://serpapi.com/");

  try {
    // 1. Parse
    console.log(`📄 Parsing: ${resumeFilePath}`);
    const resumeText = await parseResume(resumeFilePath);

    // 2. Profile
    const profile = await extractProfile(resumeText);
    console.log(`   ✅ ${profile.name}  |  ${profile.targetRoles.join(", ")}  |  ${profile.jobType}`);

    // 3. Queries
    const queries = await generateSearchQueries(profile);
    console.log(`   ✅ ${queries.length} search queries:`);
    queries.forEach((q, i) => console.log(`      ${i + 1}. ${q}`));

    // 4. Fetch
    const rawJobs = await fetchJobUrls(queries, profile);

    // 5. Rank
    const rankedJobs = await rankAndFilter(rawJobs, profile);

    // 6. Output
    const output = formatOutput(profile, rankedJobs);

    const outFile = `jobs_${Date.now()}.json`;
    fs.writeFileSync(outFile, JSON.stringify(output, null, 2));
    console.log(`\n✅  Saved → ${outFile}\n`);

    return output;
  } catch (err) {
    console.error("❌ Error:", err.message);
    throw err;
  }
}

export { findJobs, extractProfile, generateSearchQueries };

// ─────────────────────────────────────────────────────────
//  CLI:  node index.js resume.pdf
// ─────────────────────────────────────────────────────────
const [,, resumeArg] = process.argv;
if (resumeArg) findJobs(resumeArg);