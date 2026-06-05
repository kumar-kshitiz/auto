import fs from 'fs';
import pdf from 'pdf-parse';
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import { extractProfile } from './extractProfile.js';

const prisma = new PrismaClient();

const CONFIG = {
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  serpApiKey: process.env.SERPAPI_KEY || process.env.SERP_API_KEY || "",
  model: "gemini-3.1-flash-lite",
  maxResults: 5,
  resultsPerQuery: 10
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

function generateSearchQueries(profile) {
  console.log("Generating search queries deterministically...");
  const role = (profile.targetRoles && profile.targetRoles[0]) || "Software Engineer";
  const skills = profile.skills || [];
  const s1 = skills[0] || "";
  const s2 = skills[1] || "";

  const queries = [
    `${role} jobs India`,
    `${role} fresher jobs Bangalore`,
    `${role} remote jobs`,
    `${s1} ${role} jobs`.trim(),
    `${s2} ${role} jobs`.trim(),
    `${role} Hyderabad`,
    `${role} Pune`,
    `${role} entry level India`
  ];
  return queries.filter(q => q.length > 5).slice(0, 8);
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
  console.log("Searching top Indian job portals via SerpAPI...");
  // Limit to top 3 portals
  const topPortals = JOB_PORTALS.filter(p => ["LinkedIn India", "Naukri", "Indeed India"].includes(p.name));
  const topQueries = queries.slice(0, 3);
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

  const settled = await Promise.allSettled(searches);
  const seen = new Set();
  const allResults = [];

  // Strict regex patterns to ensure the URL is a single JD, not a search list.
  const isValidJD = (url) => {
    const u = url.toLowerCase();
    if (u.includes("linkedin.com")) return u.includes("/jobs/view/") || u.includes("currentjobid=");
    if (u.includes("naukri.com")) return u.includes("job-listings") || /-job-[a-z0-9]+$/.test(u);
    if (u.includes("indeed.com")) return u.includes("viewjob") || u.includes("jk=");
    return true; 
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

function scoreJob(job, profile) {
  let score = 0;
  const text = (job.title + " " + (job.snippet || "")).toLowerCase();
  
  // Base match on role: 4 points
  if (profile.targetRoles) {
    for (const role of profile.targetRoles) {
      if (text.includes(role.toLowerCase())) {
        score += 4;
        break; 
      }
    }
  }
  
  // Skills match: up to 4 points
  let skillsMatched = 0;
  if (profile.skills) {
    for (const skill of profile.skills) {
      if (text.includes(skill.toLowerCase())) {
        skillsMatched++;
      }
    }
    score += Math.min(4, skillsMatched); 
  }
  
  // Location match: 1 point
  if (profile.preferredLocations) {
    for (const loc of profile.preferredLocations) {
      if (text.includes(loc.toLowerCase())) {
        score += 1;
        break;
      }
    }
  }
  
  // Experience match: 1 point
  if (profile.educationLevel === 'fresher' || profile.educationLevel === 'student') {
    if (text.includes('fresher') || text.includes('intern') || text.includes('entry') || text.includes('junior')) {
      score += 1;
    }
  } else {
    // Non-fresher assumption
    if (!text.includes('fresher') && !text.includes('intern')) {
      score += 1;
    }
  }

  // Bonus for exact title match
  if (profile.targetRoles) {
    const title = job.title.toLowerCase();
    for (const role of profile.targetRoles) {
      if (title.includes(role.toLowerCase())) {
        score += 2;
        break;
      }
    }
  }

  score = Math.min(10, score);
  if (score < 1) score = 1;
  return score;
}

async function rankAndFilter(jobs, profile) {
  console.log(" Ranking results deterministically by keyword scoring...");
  if (jobs.length === 0) return [];
  
  const scoredJobs = jobs.map(job => {
    const score = scoreJob(job, profile);
    return {
      url: job.url,
      title: job.title,
      score: score,
      reason: `Matched based on keyword heuristics (Score: ${score}/10)`,
      portal: job.portalName || detectPortal(job.url),
    };
  });
  
  scoredJobs.sort((a, b) => b.score - a.score);
  
  return scoredJobs
    .filter(r => r.score >= 6)
    .slice(0, CONFIG.maxResults);
}

export const processResume = async (filePath, filename) => {
  try {
    const extractedText = await extractTextFromPDF(filePath);
    const profile = await extractProfile(extractedText);

    const savedResume = await prisma.resume.create({
      data: {
        filename,
        extractedText,
        extractedSkills: JSON.stringify(profile.skills || []),
        extractedProfile: JSON.stringify(profile),
      }
    });

    return {
      ...savedResume,
      extractedSkills: JSON.parse(savedResume.extractedSkills),
      extractedProfile: JSON.parse(savedResume.extractedProfile),
    };
  } catch (error) {
    console.error('Error processing resume:', error);
    throw error;
  }
};

export const findJobsForResume = async (resumeId) => {
  try {
    const resume = await prisma.resume.findUnique({
      where: { id: resumeId }
    });
    
    if (!resume) throw new Error("Resume not found");
    
    const profile = JSON.parse(resume.extractedProfile);
    const queries = generateSearchQueries(profile);
    const rawJobs = await fetchJobUrls(queries, profile);
    const rankedJobs = await rankAndFilter(rawJobs, profile);
    
    const updatedResume = await prisma.resume.update({
      where: { id: resumeId },
      data: {
        jobResults: JSON.stringify(rankedJobs),
      }
    });
    
    return {
      ...updatedResume,
      extractedSkills: JSON.parse(updatedResume.extractedSkills),
      extractedProfile: JSON.parse(updatedResume.extractedProfile),
      jobResults: JSON.parse(updatedResume.jobResults)
    };
  } catch (error) {
    console.error('Error finding jobs for resume:', error);
    throw error;
  }
};
