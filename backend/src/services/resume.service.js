import fs from 'fs';
import pdf from 'pdf-parse';
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';

const prisma = new PrismaClient();

const CONFIG = {
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  serpApiKey: process.env.SERPAPI_KEY || process.env.SERP_API_KEY || "",
  model: "gemini-3.1-flash-lite",
  maxResults: 2,
  resultsPerQuery: 2
};

const JOB_PORTALS = [
  { name: "LinkedIn India", site: "linkedin.com", inurl: "/jobs/view/" },
  { name: "Naukri", site: "naukri.com", inurl: "job-listings" },
  // { name: "Internshala", site: "internshala.com", inurl: "detail" },
  { name: "Indeed India", site: "in.indeed.com", inurl: "viewjob" },
  { name: "Shine", site: "shine.com", inurl: "/jobs/" },
  { name: "Foundit (Monster)", site: "foundit.in", inurl: "/job/" },
  { name: "IIMJobs", site: "iimjobs.com", inurl: "/j/" },
  { name: "Hirist (Tech)", site: "hirist.tech", inurl: "/j/" },
  { name: "Wellfound", site: "wellfound.com", inurl: "jobs" },
  { name: "Cutshort", site: "cutshort.io", inurl: "/job/" },
];

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
      responseMimeType: "application/json",
    },
  });
  const text = result.response.text().trim();
  const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(clean);
}

const extractTextFromPDF = async (filePath) => {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);
  return data.text;
};

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

async function generateSearchQueries(profile) {
  console.log("Generating search queries with Gemini...");
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

Example: ["Node.js backend developer jobs Bangalore", "fresher Python internship India 2024"]
`);
  return Array.isArray(queries) ? queries : JSON.parse(queries);
}

async function searchSerpAPI(query, site = null) {
  const q = site ? `site:${site} ${query}` : query;
  try {
    const { data } = await axios.get("https://serpapi.com/search.json", {
      params: {
        api_key: CONFIG.serpApiKey,
        q,
        location: "India",
        hl: "en",
        gl: "in",
        num: CONFIG.resultsPerQuery,
        engine: "google",
      },
      timeout: 10000,
    });
    return (data.organic_results || [])
      .slice(0, CONFIG.resultsPerQuery)
      .map((item) => ({
        url: item.link,
        title: item.title || "",
        snippet: item.snippet || "",
      }));
  } catch (err) {
    console.error("SerpAPI search error:", err.message);
    return [];
  }
}

function detectPortal(url = "") {
  for (const p of JOB_PORTALS) {
    if (url.includes(p.site.split("/")[0])) return p.name;
  }
  return "Other";
}

async function fetchJobUrls(queries, profile) {
  console.log("Searching Indian job portals via SerpAPI...");
  const topPortals = JOB_PORTALS.slice(0, 5);
  const topQueries = queries.slice(0, 4);
  const searches = [];

  for (const portal of topPortals) {
    for (const query of topQueries) {
      const q = `site:${portal.site} inurl:${portal.inurl} ${query}`;
      searches.push(
        searchSerpAPI(q)
          .then((results) => results.map((r) => ({ ...r, portalName: portal.name })))
          .catch(() => [])
      );
    }
  }

  for (const query of queries) {
    const q = `${query} (site:naukri.com inurl:job-listings OR site:linkedin.com inurl:/jobs/view/ OR site:in.indeed.com inurl:viewjob)`;
    searches.push(
      searchSerpAPI(q)
        .then((results) => results.map((r) => ({ ...r, portalName: detectPortal(r.url) })))
        .catch(() => [])
    );
  }

  const settled = await Promise.allSettled(searches);
  const seen = new Set();
  const allResults = [];

  // Strict regex patterns to ensure the URL is a single JD, not a search list.
  const isValidJD = (url) => {
    const u = url.toLowerCase();
    if (u.includes("linkedin.com")) return u.includes("/jobs/view/") || u.includes("currentjobid=");
    if (u.includes("naukri.com")) return u.includes("job-listings") || /-job-[a-z0-9]+$/.test(u);
    if (u.includes("internshala.com")) return u.includes("/detail");
    if (u.includes("indeed.com")) return u.includes("viewjob") || u.includes("jk=");
    if (u.includes("shine.com")) return u.includes("/jobs/") && !u.endsWith("/jobs/");
    if (u.includes("foundit.in")) return u.includes("/job/");
    if (u.includes("iimjobs.com") || u.includes("hirist.tech")) return u.includes("/j/");
    if (u.includes("wellfound.com")) return u.includes("/jobs/") && !u.endsWith("/jobs/");
    if (u.includes("cutshort.io")) return u.includes("/job/");
    return true; // if it's an unknown portal, let it through
  };

  for (const outcome of settled) {
    if (outcome.status !== "fulfilled") continue;
    for (const job of outcome.value) {
      if (job.url && !seen.has(job.url) && isValidJD(job.url)) {
        seen.add(job.url);
        allResults.push(job);
      }
    }
  }
  console.log(`   ${allResults.length} unique raw JD results collected`);
  return allResults;
}

async function rankAndFilter(jobs, profile) {
  console.log(" Ranking results by resume relevance with Gemini...");
  if (jobs.length === 0) return [];
  const batch = jobs.slice(0, 50);
  const listings = batch.map((j, i) => ({
    id: i,
    url: j.url,
    title: j.title,
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
        url: job.url,
        title: job.title,
        score: r.score,
        reason: r.reason,
        portal: job.portalName || detectPortal(job.url),
      };
    });
}

export const processResume = async (filePath, filename) => {
  try {
    const extractedText = await extractTextFromPDF(filePath);
    const profile = await extractProfile(extractedText);
    const queries = await generateSearchQueries(profile);
    const rawJobs = await fetchJobUrls(queries, profile);
    const rankedJobs = await rankAndFilter(rawJobs, profile);

    const savedResume = await prisma.resume.create({
      data: {
        filename,
        extractedText,
        extractedSkills: JSON.stringify(profile.skills || []),
        extractedProfile: JSON.stringify(profile),
        jobResults: JSON.stringify(rankedJobs),
      }
    });

    return {
      ...savedResume,
      extractedSkills: JSON.parse(savedResume.extractedSkills),
      extractedProfile: JSON.parse(savedResume.extractedProfile),
      jobResults: JSON.parse(savedResume.jobResults)
    };
  } catch (error) {
    console.error('Error processing resume:', error);
    throw error;
  }
};
