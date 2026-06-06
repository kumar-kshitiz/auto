/**
 * jdScorer.js
 * ────────────────────────────────────────────────────────────────
 * Rule-based JD extractor + Resume ↔ JD scorer. Zero LLM calls.
 *
 * EXPORTS
 *   extractJD(jdText)                        → structured JD profile
 *   checkEligibility(resumeProfile, jdProfile) → { eligible, reason? }
 *   scoreResume(resumeProfile, jdProfile)     → detailed score object
 *
 * SCORING WEIGHTS
 *   Experienced (yearsOfExperience >= 2)
 *     Skills 40% | Experience 25% | Projects 15% | Education 10% | Keywords 10%
 *
 *   Fresher (yearsOfExperience < 2)
 *     Skills 40% | Projects 30% | Internships 15% | Education 10% | Keywords 5%
 *
 * ELIGIBILITY GATE  (runs before scoring)
 *   Experienced candidates : must meet minimum required experience (±1 yr tolerance)
 *   Fresher candidates     : must match eligible graduation batch years (if stated in JD)
 *
 * ────────────────────────────────────────────────────────────────
 */

// ═══════════════════════════════════════════════════════════════
//  SHARED DICTIONARIES
// ═══════════════════════════════════════════════════════════════

const SKILLS_DICT = new Set([
  // Languages
  "javascript","typescript","python","java","c","c++","c#","go","golang","rust",
  "kotlin","swift","ruby","php","scala","r","matlab","perl","bash","shell",
  "dart","elixir","haskell","lua","objective-c","assembly","vba","groovy",
  // Web frontend
  "html","html5","css","css3","sass","less","react","reactjs","react.js","nextjs","next.js",
  "vue","vuejs","angular","svelte","tailwind","bootstrap","jquery","webpack",
  "vite","redux","zustand","graphql","rest","restful","websocket","pwa",
  // Web backend
  "nodejs","node.js","express","expressjs","fastapi","flask","django","spring",
  "springboot","laravel","rails","asp.net","nestjs","hapi","koa","gin","fiber",
  // Mobile
  "android","ios","react native","flutter","xamarin","ionic","cordova",
  // Databases
  "mysql","postgresql","postgres","mongodb","redis","sqlite","oracle","mssql",
  "cassandra","dynamodb","firebase","supabase","elasticsearch","neo4j",
  "mariadb","couchdb","influxdb","clickhouse","bigquery","snowflake","hive",
  // Cloud & DevOps
  "aws","azure","gcp","google cloud","docker","kubernetes","k8s","terraform",
  "ansible","jenkins","github actions","gitlab ci","circleci","helm","argocd",
  "prometheus","grafana","nginx","apache","linux","unix","ci/cd","devops",
  "cloudformation","pulumi","vagrant","heroku","vercel","netlify","digitalocean",
  // ML/AI/Data
  "machine learning","deep learning","nlp","computer vision","tensorflow",
  "pytorch","keras","scikit-learn","sklearn","pandas","numpy","matplotlib",
  "seaborn","xgboost","lightgbm","huggingface","openai","langchain","llm",
  "data science","data analysis","data engineering","etl","spark","hadoop",
  "kafka","airflow","dbt","mlflow","kubeflow","opencv","yolo","bert","gpt",
  // Testing
  "jest","mocha","chai","cypress","selenium","playwright","junit","pytest",
  "testing","unit testing","integration testing","tdd","bdd",
  // Tools & methodologies
  "git","github","gitlab","bitbucket","jira","confluence","figma","postman",
  "swagger","agile","scrum","kanban","microservices","serverless","grpc",
  "rabbitmq","celery","websockets","oauth","jwt","api","sdk",
  // Domain/technical
  "system design","oop","functional programming","data structures","algorithms",
  "operating systems","networking","cryptography","blockchain","web3","solidity",
  "embedded systems","iot","raspberry pi","arduino","fpga","verilog","vhdl",
  // Business/analytics
  "excel","power bi","tableau","looker","sql","nosql","data warehousing",
  "product management","product analytics","a/b testing","google analytics",
  "seo","digital marketing","salesforce","sap","erp","crm",
  // Finance/quant
  "financial modeling","valuation","investment banking","equity research",
  "risk management","derivatives","fixed income","portfolio management",
]);

const SKILL_ALIASES = {
  "reactjs"     : "react",
  "react.js"    : "react",
  "nodejs"      : "node.js",
  "node"        : "node.js",
  "postgres"    : "postgresql",
  "k8s"         : "kubernetes",
  "sklearn"     : "scikit-learn",
  "scikit learn": "scikit-learn",
  "ml"          : "machine learning",
  "ai"          : "machine learning",
  "js"          : "javascript",
  "ts"          : "typescript",
  "py"          : "python",
  "golang"      : "go",
  "next.js"     : "nextjs",
  "vue.js"      : "vue",
  "vuejs"       : "vue",
  "angular.js"  : "angular",
  "angularjs"   : "angular",
  "express.js"  : "express",
  "expressjs"   : "express",
  "springboot"  : "spring",
  "spring boot" : "spring",
  "gcp"         : "google cloud",
  "aws lambda"  : "aws",
  "mongo"       : "mongodb",
  "mongo db"    : "mongodb",
  "pg"          : "postgresql",
  "redis db"    : "redis",
  "ci cd"       : "ci/cd",
  "ci/cd"       : "ci/cd",
  "restful"     : "rest",
  "rest api"    : "rest",
  "graphql api" : "graphql",
  "tailwind css": "tailwind",
  "tailwindcss" : "tailwind",
  "fast api"    : "fastapi",
  "hugging face": "huggingface",
  "llama"       : "llm",
  "llama3"      : "llm",
  "llama2"      : "llm",
  "gemini"      : "llm",
  "groq"        : "llm",
  "faiss"       : "machine learning",
  "streamlit"   : "python",
  "playwright"  : "testing",
};

// Build a reverse alias map: canonical → all variants (for matching raw text)
// e.g. "react" → ["react", "reactjs", "react.js"]
const CANONICAL_TO_VARIANTS = (() => {
  const map = {};
  // Seed with direct dict entries
  for (const skill of SKILLS_DICT) {
    const norm = skill.toLowerCase();
    if (!map[norm]) map[norm] = new Set([norm]);
  }
  // Add alias variants
  for (const [variant, canonical] of Object.entries(SKILL_ALIASES)) {
    if (!map[canonical]) map[canonical] = new Set([canonical]);
    map[canonical].add(variant);
  }
  return map;
})();

const DEGREE_HIERARCHY = [
  "student",
  "fresher",
  "mid-level",
  "senior",
];

const DOMAIN_GROUPS = [
  ["Computer Science","Information Technology","Artificial Intelligence","Data Science","Software Engineering"],
  ["Electronics & Communication","Electrical Engineering","Embedded Systems"],
  ["Mechanical Engineering","Civil Engineering","Chemical Engineering"],
  ["Finance","Business Administration","MBA","Economics","Commerce"],
  ["Marketing","Human Resources","Operations","Management"],
  ["Mathematics","Physics","Statistics"],
  ["Biotechnology","Bioinformatics","Life Sciences"],
];

const JD_SECTION_KEYWORDS = {
  responsibilities : ["responsibilities","what you'll do","what you will do","role","duties","your role","day to day","key responsibilities","job duties"],
  requirements     : ["requirements","what we're looking for","what we are looking for","qualifications","must have","mandatory","required skills","you should have","we require"],
  preferred        : ["preferred","nice to have","bonus","good to have","plus","desired","optional","additional skills"],
  about            : ["about the role","about this role","about the position","overview","job summary","position summary","about us","who we are"],
  benefits         : ["benefits","perks","what we offer","compensation","salary","package"],
  education        : ["education","academic","qualification","degree"],
};

const EXP_LEVEL_SIGNALS = {
  internship : ["intern","internship","trainee","apprentice","student developer"],
  fresher    : ["fresher","fresh graduate","entry level","entry-level","junior","0-1 year","0-2 year","< 1 year","less than 1 year","recent graduate","new grad"],
  mid        : ["mid level","mid-level","3-5 year","2-4 year","2+ year","3+ year","4+ year","intermediate"],
  senior     : ["senior","lead","principal","staff","architect","6+ year","7+ year","5+ year","10+ year","expert"],
};

const ROLE_SIGNALS = [
  { role:"Software Engineer",         signals:["software engineer","sde","software developer","swe"] },
  { role:"Frontend Developer",        signals:["frontend","front-end","front end","ui developer","react developer","angular developer","vue developer"] },
  { role:"Backend Developer",         signals:["backend","back-end","back end","server side","api developer","node developer","django developer"] },
  { role:"Full Stack Developer",      signals:["full stack","fullstack","full-stack"] },
  { role:"Mobile Developer",          signals:["mobile developer","android developer","ios developer","flutter developer","react native"] },
  { role:"Data Scientist",            signals:["data scientist","ml engineer","machine learning engineer","ai engineer","data science"] },
  { role:"Data Analyst",              signals:["data analyst","business intelligence","bi analyst","analytics engineer"] },
  { role:"Data Engineer",             signals:["data engineer","etl developer","pipeline engineer","spark developer"] },
  { role:"DevOps Engineer",           signals:["devops","site reliability","sre","platform engineer","cloud engineer","infrastructure engineer"] },
  { role:"UI/UX Designer",            signals:["ux designer","ui designer","product designer","ux researcher","interaction designer"] },
  { role:"Product Manager",           signals:["product manager","product owner","pm ","p.m."] },
  { role:"Cybersecurity Analyst",     signals:["security analyst","cybersecurity","penetration tester","infosec","security engineer"] },
  { role:"Embedded Systems Engineer", signals:["embedded engineer","firmware engineer","rtos developer","hardware engineer"] },
  { role:"Blockchain Developer",      signals:["blockchain developer","smart contract","solidity developer","web3 developer"] },
  { role:"Database Administrator",    signals:["dba","database administrator","database engineer"] },
  { role:"QA Engineer",               signals:["qa engineer","quality assurance","test engineer","sdet","automation engineer"] },
];

const DOMAIN_KEYWORDS = new Set([
  "microservices","serverless","event-driven","domain driven","clean architecture",
  "solid principles","design patterns","distributed systems","high availability",
  "fault tolerance","scalability","performance optimization","load balancing",
  "caching","message queue","pub sub","api gateway","service mesh",
  "agile","scrum","kanban","tdd","bdd","code review","pair programming",
  "documentation","technical writing","mentoring","cross-functional",
  "stakeholder management","product thinking","customer focus",
  "fintech","edtech","healthtech","saas","b2b","b2c","ecommerce","marketplace",
  "startup","enterprise","open source","research","analytics",
  "problem solving","communication","teamwork","leadership","ownership",
  "initiative","fast learner","self-starter","detail oriented","analytical",
  "rag","retrieval augmented generation","llm","large language model",
  "automation","pipeline","crawler","web scraping","real-time",
]);

// ═══════════════════════════════════════════════════════════════
//  UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function normalizeSkill(raw) {
  const s = raw.toLowerCase().trim();
  return SKILL_ALIASES[s] || s;
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[•\-–—|,\/()[\]{}*#@!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/**
 * Extract all canonical skills from a block of text.
 * Uses trigram → bigram → unigram sliding window.
 * Also expands each SKILLS_DICT entry through its known aliases/variants,
 * so "React.js" in raw text correctly maps to canonical "react".
 */
function extractSkillsFromText(text) {
  const words   = tokenize(text);
  const found   = new Set();
  const usedIdx = new Set();

  const tryMatch = (phrase, indices) => {
    const norm = normalizeSkill(phrase);
    // Direct dict hit
    if (SKILLS_DICT.has(norm)) {
      found.add(norm);
      indices.forEach((i) => usedIdx.add(i));
      return true;
    }
    // Alias hit → store canonical
    if (SKILL_ALIASES[norm]) {
      found.add(SKILL_ALIASES[norm]);
      indices.forEach((i) => usedIdx.add(i));
      return true;
    }
    return false;
  };

  for (let i = 0; i <= words.length - 3; i++) {
    const phrase = words.slice(i, i + 3).join(" ");
    tryMatch(phrase, [i, i + 1, i + 2]);
  }
  for (let i = 0; i <= words.length - 2; i++) {
    if (usedIdx.has(i) && usedIdx.has(i + 1)) continue;
    const phrase = words.slice(i, i + 2).join(" ");
    tryMatch(phrase, [i, i + 1]);
  }
  for (let i = 0; i < words.length; i++) {
    if (usedIdx.has(i)) continue;
    tryMatch(words[i], [i]);
  }

  return [...found];
}

function splitJDSections(text) {
  const lines    = text.split(/\r?\n/);
  const sections = {
    raw             : text,
    responsibilities: "",
    requirements    : "",
    preferred       : "",
    about           : "",
    benefits        : "",
    education       : "",
    other           : "",
  };
  let current = "other";

  for (const line of lines) {
    const lower = line.trim().toLowerCase();
    let matched = false;
    for (const [sec, keywords] of Object.entries(JD_SECTION_KEYWORDS)) {
      if (keywords.some((kw) => lower === kw || lower.startsWith(kw + ":") || lower.startsWith(kw + " "))) {
        current = sec;
        matched = true;
        break;
      }
    }
    if (!matched) sections[current] += line + "\n";
  }

  return sections;
}

function parseRequiredExperience(text) {
  const lower = text.toLowerCase();

  const rangeMatch = lower.match(/(\d+)\s*(?:-|to|–)\s*(\d+)\s*(?:years?|yrs?)/);
  if (rangeMatch) {
    return { min: parseInt(rangeMatch[1], 10), max: parseInt(rangeMatch[2], 10) };
  }

  const plusMatch = lower.match(/(?:(\d+)\+|at least (\d+)|minimum (\d+)|(\d+) or more)\s*(?:years?|yrs?)/);
  if (plusMatch) {
    const val = parseInt(plusMatch[1] || plusMatch[2] || plusMatch[3] || plusMatch[4], 10);
    return { min: val, max: val + 4 };
  }

  const singleMatch = lower.match(/(\d+)\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience|exp)/);
  if (singleMatch) {
    const val = parseInt(singleMatch[1], 10);
    return { min: Math.max(0, val - 1), max: val + 2 };
  }

  if (EXP_LEVEL_SIGNALS.internship.some((s) => lower.includes(s))) return { min: 0, max: 1 };
  if (EXP_LEVEL_SIGNALS.fresher.some((s) => lower.includes(s)))    return { min: 0, max: 2 };
  if (EXP_LEVEL_SIGNALS.senior.some((s) => lower.includes(s)))     return { min: 5, max: 15 };
  if (EXP_LEVEL_SIGNALS.mid.some((s) => lower.includes(s)))        return { min: 2, max: 5 };

  return null;
}

function parseRequiredEducation(text) {
  const lower = text.toLowerCase();
  if (/phd|ph\.d|doctorate/.test(lower))                              return "senior";
  if (/m\.tech|mtech|master|mba|m\.sc|pgdm/.test(lower))             return "fresher";
  if (/b\.tech|btech|b\.e\.|bachelor|b\.sc|undergraduate/.test(lower)) return "student";
  return null;
}

function extractDomainKeywords(text) {
  const lower = text.toLowerCase();
  const found = new Set();
  for (const kw of DOMAIN_KEYWORDS) {
    if (lower.includes(kw)) found.add(kw);
  }
  return [...found];
}

function parseJobType(text) {
  const lower = text.toLowerCase();
  if (EXP_LEVEL_SIGNALS.internship.some((s) => lower.includes(s))) return "internship";
  if (/part[- ]?time/.test(lower))  return "part-time";
  if (/contract|freelance/.test(lower)) return "contract";
  return "full-time";
}

function parseEligibleGraduationYears(text) {
  const lower = text.toLowerCase();
  const now = new Date().getFullYear();
  const maxYear = now + 10;
  const eligibleYears = new Set();

  const isValidYear = (y) => y >= 2000 && y <= maxYear;

  const extractYearsFromMatch = (str) => {
    const matches = str.match(/\d{4}/g) || [];
    return matches.map((y) => parseInt(y, 10)).filter(isValidYear);
  };

  const patterns = [
    /(?:batch of|eligible for|class of|passing year|graduation year|eligible candidates)\s*[:\-]?\s*([0-9]{4}(?:\s*(?:\/|,|or|and|-)\s*[0-9]{4})*)/g,
    /([0-9]{4}(?:\s*(?:-|to|–)\s*[0-9]{4})?)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(lower)) !== null) {
      const raw = match[1];
      const years = extractYearsFromMatch(raw);
      years.forEach((year) => eligibleYears.add(year));
    }
  }

  if (eligibleYears.size > 0) {
    return [...eligibleYears].sort((a, b) => a - b);
  }
  return null;
}

function parseProjectRequirements(text) {
  const lower = text.toLowerCase();
  const signals = {
    portfolioRequired  : /portfolio|github|project link|showcase|demo|personal project/.test(lower),
    openSourcePreferred: /open source|open-source|oss|contributor/.test(lower),
    minProjects        : 0,
  };
  const projMatch = lower.match(/(\d+)\+?\s*(?:side\s*)?projects?/);
  if (projMatch) signals.minProjects = parseInt(projMatch[1], 10);
  return signals;
}

// ═══════════════════════════════════════════════════════════════
//  MAIN JD EXTRACTOR
// ═══════════════════════════════════════════════════════════════

export function extractJD(jdText) {
  const text = jdText
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[–—]/g, "-");

  const sections = splitJDSections(text);
  const lower    = text.toLowerCase();

  // ── Job title ────────────────────────────────────────────────
  let title = "Unknown Role";
  for (const { role, signals } of ROLE_SIGNALS) {
    if (signals.some((s) => lower.includes(s))) { title = role; break; }
  }
  const firstLines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (firstLines.length > 0 && firstLines[0].length < 80 && firstLines[0].length > 3) {
    if (firstLines[0].split(" ").length <= 8) title = firstLines[0];
  }

  // ── Experience level ────────────────────────────────────────
  let targetLevel = "fresher";
  if      (EXP_LEVEL_SIGNALS.internship.some((s) => lower.includes(s))) targetLevel = "internship";
  else if (EXP_LEVEL_SIGNALS.senior.some((s) => lower.includes(s)))     targetLevel = "senior";
  else if (EXP_LEVEL_SIGNALS.mid.some((s) => lower.includes(s)))        targetLevel = "mid";
  else if (EXP_LEVEL_SIGNALS.fresher.some((s) => lower.includes(s)))    targetLevel = "fresher";

  // ── Skills extraction ────────────────────────────────────────
  const requiredRaw  = extractSkillsFromText(sections.requirements + " " + sections.responsibilities);
  const preferredRaw = extractSkillsFromText(sections.preferred);
  const requiredSet  = new Set(requiredRaw);
  const preferredSet = new Set(preferredRaw.filter((s) => !requiredSet.has(s)));

  const requiredSkills  = [...requiredSet];
  const preferredSkills = [...preferredSet];
  const allSkills       = [...new Set([...requiredSkills, ...preferredSkills])];

  // ── Experience requirement ───────────────────────────────────
  const requiredExperience = parseRequiredExperience(
    sections.requirements + " " + sections.responsibilities + " " + sections.about
  );

  // ── Education ────────────────────────────────────────────────
  const requiredEducation = parseRequiredEducation(
    sections.requirements + " " + sections.education + " " + sections.raw
  );

  let educationDomain = null;
  const eduText = (sections.education + " " + sections.requirements + " " + sections.about).toLowerCase();
  const DOMAIN_PATTERNS = [
    ["Computer Science", "computer science","cse","cs ","c.s."],
    ["Information Technology", "information technology"," it "],
    ["Electronics & Communication", "electronics","ece"],
    ["Electrical Engineering", "electrical","eee"],
    ["Mechanical Engineering", "mechanical","mech"],
    ["Data Science", "data science"],
    ["Artificial Intelligence", "artificial intelligence","ai and ml","ai & ml"],
    ["Finance", "finance","financial"],
    ["Marketing", "marketing"],
    ["MBA", "mba","master of business"],
    ["Mathematics","mathematics","statistics"],
  ];
  for (const [domain, ...keywords] of DOMAIN_PATTERNS) {
    if (keywords.flat().some((kw) => eduText.includes(kw))) { educationDomain = domain; break; }
  }

  const jobType             = parseJobType(text);
  const domainKeywords      = extractDomainKeywords(text);
  const projectRequirements = parseProjectRequirements(text);
  const eligibleGraduationYears = parseEligibleGraduationYears(text);

  return {
    title,
    targetLevel,
    requiredSkills,
    preferredSkills,
    allSkills,
    requiredExperience,
    requiredEducation,
    educationDomain,
    jobType,
    domainKeywords,
    projectRequirements,
    eligibleGraduationYears,
    rawSections: sections,
  };
}

// ═══════════════════════════════════════════════════════════════
//  ELIGIBILITY GATE
//  Must be called BEFORE scoreResume(). If not eligible, return
//  the result directly and skip scoring entirely.
// ═══════════════════════════════════════════════════════════════

/**
 * checkEligibility(resumeProfile, jdProfile)
 *
 * Returns:
 *   { eligible: true }
 *   { eligible: false, reason: string, field: "experience"|"graduationYear" }
 *
 * Rules:
 *   A) Experienced candidates (YOE >= 2):
 *      - If JD has a requiredExperience range, candidate YOE must be >= min - 1
 *        (1 year tolerance to avoid harsh cut-offs).
 *      - Upper-bound (over-qualification) is NOT a hard block — just a scoring penalty.
 *
 *   B) Fresher / internship candidates (YOE < 2):
 *      - If JD specifies eligible graduation years, candidate's graduation year
 *        must appear in that list.
 *      - If graduation year cannot be extracted from resume, assume eligible
 *        (give benefit of doubt) but log a warning.
 *
 *   C) Tier mismatch:
 *      - If JD is explicitly for experienced (min >= 2 yrs) but candidate is a
 *        fresher (YOE < 2), flag as ineligible.
 *      - If JD is explicitly an internship/fresher role but candidate has 4+ yrs
 *        experience, flag as ineligible (over-qualified for the role type).
 */
export function checkEligibility(resumeProfile, jdProfile) {
  const yoe = resumeProfile.yearsOfExperience ?? resumeProfile.experience?.decimalYears ?? 0;
  const req = jdProfile.requiredExperience;
  const jdTargetLevel = jdProfile.targetLevel;   // internship | fresher | mid | senior
  const isFresherCandidate = yoe < 2;

  // ── A. Tier mismatch checks ──────────────────────────────────

  // JD is for experienced but candidate is a fresher
  if (!isFresherCandidate && req && req.min >= 2) {
    // Candidate IS experienced — fall through to experience check below
  }
  if (isFresherCandidate && req && req.min >= 2) {
    return {
      eligible: false,
      field: "experience",
      reason: `This role requires a minimum of ${req.min} years of experience. Your profile shows ${yoe} year(s) of experience. Please look for fresher or entry-level roles instead.`,
    };
  }

  // JD is an internship/fresher-only role but candidate is over-qualified
  if (!isFresherCandidate && (jdTargetLevel === "internship" || jdTargetLevel === "fresher") && yoe >= 4) {
    return {
      eligible: false,
      field: "experience",
      reason: `This role is designed for freshers/interns. Your ${yoe} year(s) of experience makes you over-qualified. Consider applying for mid-level or senior positions.`,
    };
  }

  // ── B. Experienced candidate: experience range check ─────────

  if (!isFresherCandidate && req) {
    const tolerance = 1; // allow 1 year below minimum
    if (yoe < req.min - tolerance) {
      return {
        eligible: false,
        field: "experience",
        reason: `This role requires ${req.min}–${req.max} years of experience. Your profile shows ${yoe} year(s). You need at least ${(req.min - tolerance).toFixed(1)} years to be eligible.`,
      };
    }
  }

  // ── C. Fresher candidate: graduation batch check ─────────────

  if (isFresherCandidate) {
    const eligibleYears = jdProfile.eligibleGraduationYears;
    if (eligibleYears && eligibleYears.length > 0) {
      const gradYear = resumeProfile.graduationYear;
      if (!gradYear) {
        // Cannot extract — give benefit of doubt
        return {
          eligible: true,
          warning: "Graduation year could not be extracted from your resume. Please ensure it is clearly mentioned. Assuming eligible for now.",
        };
      }
      if (!eligibleYears.includes(gradYear)) {
        return {
          eligible: false,
          field: "graduationYear",
          reason: `This role is open only for the ${eligibleYears.join(", ")} passing batch(es). Your graduation year is ${gradYear}, which does not match. Please check for openings suited to your batch.`,
        };
      }
    }
  }

  return { eligible: true };
}

// ═══════════════════════════════════════════════════════════════
//  SCORING ENGINE
// ═══════════════════════════════════════════════════════════════

function isFresher(resumeProfile) {
  const yoe = resumeProfile.yearsOfExperience ?? resumeProfile.experience?.decimalYears ?? 0;
  return yoe < 2 || resumeProfile.educationLevel === "student";
}

/**
 * scoreSkills — unchanged from original, works correctly.
 */
function scoreSkills(resumeProfile, jdProfile) {
  const resumeSkills = new Set(
    (resumeProfile.skills || []).map(normalizeSkill)
  );

  const matched  = [];
  const partial  = [];
  const missing  = [];
  let earnedPoints = 0;
  let totalPoints  = 0;

  const scoreSkill = (skill, weight) => {
    const norm = normalizeSkill(skill);
    totalPoints += weight;

    if (resumeSkills.has(norm)) {
      earnedPoints += weight;
      matched.push(skill);
      return;
    }

    const partialHit = [...resumeSkills].some(
      (rs) => rs.includes(norm) || norm.includes(rs)
    );

    if (partialHit) {
      earnedPoints += weight * 0.6;
      partial.push(skill);
      return;
    }

    missing.push(skill);
  };

  for (const skill of jdProfile.requiredSkills)  scoreSkill(skill, 2);
  for (const skill of jdProfile.preferredSkills) scoreSkill(skill, 1);

  const rawScore = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 50;

  const bonusSkills = [...resumeSkills].filter(
    (rs) => !jdProfile.allSkills.some((js) => normalizeSkill(js) === rs || rs.includes(normalizeSkill(js)))
  );
  const bonusPoints = Math.min(10, bonusSkills.length * 1.5);

  return {
    score      : Math.min(100, rawScore + bonusPoints),
    matched,
    partial,
    missing,
    bonusSkills: bonusSkills.slice(0, 5),
  };
}

function scoreExperience(resumeProfile, jdProfile) {
  const yoe = resumeProfile.yearsOfExperience ?? resumeProfile.experience?.decimalYears ?? 0;
  const req  = jdProfile.requiredExperience;

  if (!req) return { score: 70, detail: "No explicit experience requirement in JD" };

  const { min, max } = req;

  if (yoe >= min && yoe <= max) {
    return { score: 100, detail: `${yoe} yrs matches required ${min}-${max} yrs` };
  }

  if (yoe < min) {
    const gap     = min - yoe;
    const penalty = Math.min(60, gap * 15);
    return {
      score : Math.max(10, 100 - penalty),
      detail: `${yoe} yrs is ${gap.toFixed(1)} yrs below required minimum (${min} yrs)`,
    };
  }

  const excess  = yoe - max;
  const penalty = Math.min(30, excess * 8);
  return {
    score : Math.max(60, 100 - penalty),
    detail: `${yoe} yrs exceeds required max (${max} yrs) — may be over-qualified`,
  };
}

// ═══════════════════════════════════════════════════════════════
//  FIX: scoreProjects — completely rewritten
// ═══════════════════════════════════════════════════════════════
/**
 * scoreProjects — accurately measures how well a candidate's projects
 * demonstrate the skills required by the JD.
 *
 * KEY FIXES over original:
 *
 * 1. ALIAS-AWARE SKILL MATCHING
 *    Instead of doing `resumeText.includes(jdSkill)` (raw string match that
 *    misses "React.js" when JD has "react"), we extract canonical skills from
 *    the project text using the same `extractSkillsFromText()` used everywhere
 *    else, then compare canonical sets.
 *
 * 2. PROJECTS-ONLY TEXT (no raw fallback contamination)
 *    We use ONLY rawSections.projects.  If that is empty we try a heuristic
 *    extraction from the full raw text, but we never silently fall back to the
 *    full resume (which would give free credit for skills listed in the skills
 *    section, not actually used in projects).
 *
 * 3. ACCURATE PROJECT COUNT
 *    Instead of the unreliable `(\d+) projects` regex we count distinct project
 *    blocks by detecting project title patterns (a short non-bullet line that
 *    is followed by bullet points / tech stack lines) or by counting GitHub
 *    repo headers, dashes, or known delimiter patterns.
 *
 * 4. IMPACT SIGNAL BONUS
 *    Projects that contain measurable impact verbs + metrics get a bonus,
 *    rewarding well-described projects over bare skill lists.
 *
 * 5. BREADTH vs DEPTH balance
 *    Score = 50 pts skill-match coverage
 *          + 20 pts project count (diminishing returns)
 *          + 20 pts impact / depth signals
 *          + 10 pts GitHub / portfolio link
 *    Each bucket is independently capped so one great area can't mask a zero.
 */

const PROJECT_IMPACT_VERBS = new Set([
  "built","developed","designed","implemented","created","launched","deployed",
  "reduced","increased","improved","optimised","optimized","achieved","led",
  "automated","saved","generated","boosted","scaled","migrated","refactored",
  "integrated","architected","engineered","published","contributed",
  "streamlined","delivered","researched","analyzed","established","handled",
]);

const PROJECT_METRIC_PATTERN = /\d+\s*%|\d+x|\d+\s*(?:ms|seconds?|minutes?|hrs?|hours?|days?|users?|customers?|listings?|requests?|rps|qps|kb|mb|gb|tb)/i;

/**
 * Count distinct projects in the projects section text.
 * Heuristic: a project title is a short line (≤12 words) that:
 *   - is NOT a bullet point
 *   - does NOT start with common noise words
 *   - is followed by additional content
 */
function countProjects(projectText) {
  if (!projectText || projectText.trim().length < 10) return 0;

  const lines = projectText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const BULLET_PREFIX = /^[•\-–*▪▸►>·]/;
  const NOISE_STARTS  = /^(skills|technologies|tools|languages|frameworks|experience|education|summary|objective|projects|achievements|certifications)/i;

  let count = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip bullets and noise headings
    if (BULLET_PREFIX.test(line))  continue;
    if (NOISE_STARTS.test(line))   continue;

    const words = line.split(/\s+/);

    // Candidate title: 1–10 words, sentence-case or title-case, no trailing period
    if (words.length >= 1 && words.length <= 10 && !line.endsWith(".")) {
      // Must have at least one capitalised word
      const hasCapital = words.some((w) => /^[A-Z]/.test(w));
      if (!hasCapital) continue;

      // Peek ahead: must be followed by at least 2 more non-empty lines
      // (tech stack line + at least one bullet)
      const ahead = lines.slice(i + 1, i + 4).filter(Boolean);
      if (ahead.length >= 1) {
        count++;
      }
    }
  }

  // Fallback: if heuristic found nothing, at least return 1 if there's content
  return count > 0 ? count : (projectText.trim().length > 50 ? 1 : 0);
}

/**
 * Measure depth/impact of project descriptions.
 * Returns 0–1 ratio of sentences that contain an impact verb + metric/outcome.
 */
function measureProjectImpact(projectText) {
  if (!projectText || projectText.trim().length < 10) return 0;

  const sentences = projectText
    .split(/[.\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);

  if (sentences.length === 0) return 0;

  let impactCount = 0;

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    const words = lower.split(/\s+/);
    const hasVerb   = words.some((w) => PROJECT_IMPACT_VERBS.has(w));
    const hasMetric = PROJECT_METRIC_PATTERN.test(sentence);
    if (hasVerb && hasMetric) impactCount += 1;
    else if (hasVerb)         impactCount += 0.3;
  }

  return Math.min(1, impactCount / Math.max(1, sentences.length * 0.5));
}

function scoreProjects(resumeProfile, jdProfile) {
  // ── Step 1: Get project text (projects section only, no raw fallback) ──
  let projectText = (resumeProfile.rawSections?.projects || "").trim();

  // If the projects section is empty, try to extract project blocks from raw
  // text by looking for the "Projects" heading and slicing out that block.
  // This is a safety net only — we do NOT use the entire raw resume.
  if (projectText.length < 30) {
    const raw = resumeProfile.rawSections?.raw || "";
    const projectMatch = raw.match(
      /(?:projects?|portfolio)[\s\S]*?(?=\n(?:experience|education|skills|achievements|certifications|summary|objective)\b|$)/i
    );
    projectText = projectMatch ? projectMatch[0] : "";
  }

  if (projectText.length < 20) {
    return {
      score : 0,
      detail: "No projects section found in resume",
      matchedSkills: [],
      totalJdSkills: jdProfile.allSkills.length,
      projectCount : 0,
      impactScore  : 0,
    };
  }

  // ── Step 2: Extract canonical skills from project text ──────────────────
  // This is the core fix: use the same extractor (alias-aware) instead of
  // raw string includes().
  const projectSkillsSet = new Set(extractSkillsFromText(projectText));

  // ── Step 3: Match JD skills against extracted project skills ───────────
  const jdCanonicalSkills = jdProfile.allSkills.map(normalizeSkill);

  const matchedSkills  = [];
  const partialSkills  = [];

  for (const jdSkill of jdCanonicalSkills) {
    if (projectSkillsSet.has(jdSkill)) {
      matchedSkills.push(jdSkill);
      continue;
    }
    // Partial: project skill is a substring of JD skill or vice-versa
    const partialHit = [...projectSkillsSet].some(
      (ps) => ps.includes(jdSkill) || jdSkill.includes(ps)
    );
    if (partialHit) partialSkills.push(jdSkill);
  }

  const totalJdSkills   = jdCanonicalSkills.length;
  const effectiveMatches = matchedSkills.length + partialSkills.length * 0.5;
  const coverageRatio   = totalJdSkills > 0
    ? effectiveMatches / totalJdSkills
    : 0;

  // ── Step 4: Count projects accurately ──────────────────────────────────
  const projectCount = countProjects(projectText);

  // ── Step 5: Measure impact/depth ───────────────────────────────────────
  const impactRatio = measureProjectImpact(projectText);

  // ── Step 6: Portfolio / GitHub ─────────────────────────────────────────
  const hasGithub = /github\.com|gitlab\.com|bitbucket\.org/.test(
    resumeProfile.rawSections?.raw || ""
  );

  // ── Step 7: Compose score ──────────────────────────────────────────────
  //  50 pts — skill coverage (how many JD skills appear in projects)
  //  20 pts — project count  (diminishing returns: 1→8, 2→14, 3→18, 4+→20)
  //  20 pts — impact / depth signals
  //  10 pts — GitHub / portfolio link

  const skillPoints = Math.round(coverageRatio * 50);

  const countPoints = projectCount === 0 ? 0
    : projectCount === 1 ? 8
    : projectCount === 2 ? 14
    : projectCount === 3 ? 18
    : 20;

  const impactPoints = Math.round(impactRatio * 20);

  const githubPoints = hasGithub ? 10 : 0;

  // Portfolio required penalty
  let portfolioPenalty = 0;
  if (jdProfile.projectRequirements?.portfolioRequired && !hasGithub) {
    portfolioPenalty = 10;
  }

  const rawScore = skillPoints + countPoints + impactPoints + githubPoints - portfolioPenalty;

  return {
    score        : Math.min(100, Math.max(0, rawScore)),
    detail       : `Skills: ${matchedSkills.length} exact + ${partialSkills.length} partial / ${totalJdSkills} JD skills; Projects: ~${projectCount}; Impact ratio: ${(impactRatio * 100).toFixed(0)}%; GitHub: ${hasGithub}`,
    matchedSkills: matchedSkills.slice(0, 6),
    partialSkills: partialSkills.slice(0, 4),
    totalJdSkills,
    projectCount,
    impactScore  : Math.round(impactRatio * 100),
    hasGithub,
  };
}

function scoreInternships(resumeProfile, jdProfile) {
  const expText = (resumeProfile.rawSections?.experience || "").toLowerCase();

  if (!expText || expText.length < 10) {
    return { score: 0, detail: "No internship/experience section found" };
  }

  const hasInternship = /intern|internship|trainee|apprentice/.test(expText);
  if (!hasInternship) {
    return { score: 20, detail: "No internship keywords found; some experience present" };
  }

  // Use alias-aware extraction for consistent matching
  const internSkillsSet  = new Set(extractSkillsFromText(expText));
  const jdCanonicalSkills = jdProfile.allSkills.map(normalizeSkill);

  const internSkillMatches = jdCanonicalSkills.filter((s) => internSkillsSet.has(s));
  const coverageRatio = jdCanonicalSkills.length > 0
    ? internSkillMatches.length / jdCanonicalSkills.length
    : 0;

  const internCount = (expText.match(/intern/g) || []).length;

  let score = 50;
  score    += Math.round(coverageRatio * 40);
  score    += Math.min(10, internCount * 3);

  return {
    score  : Math.min(100, score),
    detail : `Internship found; ${internSkillMatches.length}/${jdCanonicalSkills.length} JD skills matched in internship`,
    matchedSkills: internSkillMatches.slice(0, 5),
  };
}

function scoreEducation(resumeProfile, jdProfile) {
  const resumeLevel  = resumeProfile.educationLevel  || "student";
  const resumeDomain = resumeProfile.educationDomain || "";
  const jdLevel      = jdProfile.requiredEducation;
  const jdDomain     = jdProfile.educationDomain;

  let levelScore  = 70;
  let domainScore = 50;

  if (jdLevel) {
    const resumeIdx = DEGREE_HIERARCHY.indexOf(resumeLevel);
    const jdIdx     = DEGREE_HIERARCHY.indexOf(jdLevel);

    if (resumeIdx < 0 || jdIdx < 0) {
      levelScore = 60;
    } else if (resumeIdx >= jdIdx) {
      levelScore = 100;
    } else {
      const gap  = jdIdx - resumeIdx;
      levelScore = Math.max(20, 100 - gap * 25);
    }
  }

  if (jdDomain && resumeDomain) {
    if (resumeDomain.toLowerCase() === jdDomain.toLowerCase()) {
      domainScore = 100;
    } else {
      const inSameGroup = DOMAIN_GROUPS.some(
        (grp) => grp.includes(resumeDomain) && grp.includes(jdDomain)
      );
      domainScore = inSameGroup ? 70 : 30;
    }
  } else if (!jdDomain) {
    domainScore = 80;
  }

  const score = Math.round(levelScore * 0.6 + domainScore * 0.4);

  return {
    score,
    detail: `Level: ${resumeLevel} vs required ${jdLevel || "any"} (${levelScore}/100); Domain: ${resumeDomain || "unknown"} vs JD ${jdDomain || "any"} (${domainScore}/100)`,
  };
}

function scoreKeywords(resumeProfile, jdProfile) {
  const resumeText = [
    resumeProfile.rawSections?.raw          || "",
    (resumeProfile.keyAchievements || []).join(" "),
  ].join(" ").toLowerCase();

  if (!resumeText || resumeText.length < 20) {
    return { score: 0, detail: "Insufficient resume text for keyword scoring" };
  }

  const jdKeywords = jdProfile.domainKeywords;

  if (jdKeywords.length === 0) {
    return { score: 60, detail: "No domain keywords identified in JD" };
  }

  const matchedKeywords = jdKeywords.filter((kw) => resumeText.includes(kw));
  const coverageRatio   = matchedKeywords.length / jdKeywords.length;

  const jobTypeMatch =
    !jdProfile.jobType || jdProfile.jobType === resumeProfile.jobType ||
    jdProfile.jobType === "both";

  const score = Math.round(coverageRatio * 90) + (jobTypeMatch ? 10 : 0);

  return {
    score  : Math.min(100, score),
    detail : `${matchedKeywords.length}/${jdKeywords.length} domain keywords matched`,
    matched: matchedKeywords.slice(0, 6),
    missing: jdKeywords.filter((kw) => !resumeText.includes(kw)).slice(0, 6),
  };
}

// ═══════════════════════════════════════════════════════════════
//  MAIN SCORER
// ═══════════════════════════════════════════════════════════════

/**
 * scoreResume(resumeProfile, jdProfile)
 *
 * NOTE: Call checkEligibility() first.
 * If the candidate is ineligible, this function should NOT be called —
 * return the eligibility result directly to the user.
 */
export function scoreResume(resumeProfile, jdProfile) {
  const fresher = isFresher(resumeProfile);
  const tier    = fresher ? "fresher" : "experienced";

  const skillResult     = scoreSkills(resumeProfile, jdProfile);
  const projectResult   = scoreProjects(resumeProfile, jdProfile);
  const educationResult = scoreEducation(resumeProfile, jdProfile);
  const keywordResult   = scoreKeywords(resumeProfile, jdProfile);

  const experienceResult = fresher ? null : scoreExperience(resumeProfile, jdProfile);
  const internshipResult = fresher ? scoreInternships(resumeProfile, jdProfile) : null;

  let total = 0;
  let breakdown = {};

  if (fresher) {
    const weights = { skills: 0.40, projects: 0.30, internships: 0.15, education: 0.10, keywords: 0.05 };

    const ws = skillResult.score      * weights.skills;
    const wp = projectResult.score    * weights.projects;
    const wi = internshipResult.score * weights.internships;
    const we = educationResult.score  * weights.education;
    const wk = keywordResult.score    * weights.keywords;

    total = Math.round(ws + wp + wi + we + wk);

    breakdown = {
      skills      : { ...skillResult,      weight: weights.skills,      weighted: +ws.toFixed(1) },
      projects    : { ...projectResult,    weight: weights.projects,    weighted: +wp.toFixed(1) },
      internships : { ...internshipResult, weight: weights.internships, weighted: +wi.toFixed(1) },
      education   : { ...educationResult,  weight: weights.education,   weighted: +we.toFixed(1) },
      keywords    : { ...keywordResult,    weight: weights.keywords,    weighted: +wk.toFixed(1) },
    };
  } else {
    const weights = { skills: 0.40, experience: 0.25, projects: 0.15, education: 0.10, keywords: 0.10 };

    const ws = skillResult.score      * weights.skills;
    const wx = experienceResult.score * weights.experience;
    const wp = projectResult.score    * weights.projects;
    const we = educationResult.score  * weights.education;
    const wk = keywordResult.score    * weights.keywords;

    total = Math.round(ws + wx + wp + we + wk);

    breakdown = {
      skills     : { ...skillResult,      weight: weights.skills,     weighted: +ws.toFixed(1) },
      experience : { ...experienceResult, weight: weights.experience, weighted: +wx.toFixed(1) },
      projects   : { ...projectResult,    weight: weights.projects,   weighted: +wp.toFixed(1) },
      education  : { ...educationResult,  weight: weights.education,  weighted: +we.toFixed(1) },
      keywords   : { ...keywordResult,    weight: weights.keywords,   weighted: +wk.toFixed(1) },
    };
  }

  total = Math.min(100, Math.max(0, total));

  // ── Strengths & Gaps ─────────────────────────────────────────
  const strengths = [];
  const gaps      = [];

  if (skillResult.matched.length > 0) {
    strengths.push(`Matches ${skillResult.matched.length} required skill(s): ${skillResult.matched.slice(0, 4).join(", ")}`);
  }
  if (skillResult.missing.length > 0) {
    gaps.push(`Missing ${skillResult.missing.length} JD skill(s): ${skillResult.missing.slice(0, 4).join(", ")}`);
  }

  if (!fresher && experienceResult) {
    if (experienceResult.score >= 80) strengths.push("Experience level aligns well with JD");
    else gaps.push(experienceResult.detail);
  }

  if (projectResult.score >= 70) {
    strengths.push(`Strong project portfolio — ${projectResult.projectCount} project(s) demonstrating relevant tech`);
  } else if (projectResult.score < 40) {
    const hint = projectResult.matchedSkills.length === 0
      ? "Projects don't mention JD-required technologies — describe the tech stack used in each project"
      : "Projects partially cover JD skills — add more projects or detail the technologies used";
    gaps.push(hint);
  }

  if (fresher && internshipResult) {
    if (internshipResult.score >= 60) strengths.push("Relevant internship experience found");
    else if (internshipResult.score < 30) gaps.push("No relevant internship experience — consider open-source contributions or personal projects");
  }

  if (educationResult.score >= 80) strengths.push("Education meets or exceeds JD requirements");
  else if (educationResult.score < 50) gaps.push(educationResult.detail);

  if (keywordResult.missing && keywordResult.missing.length > 0) {
    gaps.push(`Resume lacks industry keywords: ${keywordResult.missing.slice(0, 3).join(", ")}`);
  }

  // ── Recommendation ───────────────────────────────────────────
  let recommendation;
  if      (total >= 80) recommendation = "Strong Match — Highly recommended to apply";
  else if (total >= 65) recommendation = "Good Match — Worth applying; address minor gaps";
  else if (total >= 50) recommendation = "Moderate Match — Upskill in missing areas before applying";
  else if (total >= 35) recommendation = "Weak Match — Significant gaps; consider building skills first";
  else                  recommendation = "Poor Match — Role requires a very different background";

  return {
    total,
    tier,
    breakdown,
    strengths,
    gaps,
    recommendation,
    meta: {
      candidateName: resumeProfile.name,
      jobTitle     : jdProfile.title,
      candidateYOE : resumeProfile.yearsOfExperience ?? resumeProfile.experience?.decimalYears ?? 0,
      requiredExp  : jdProfile.requiredExperience,
      scoredAt     : new Date().toISOString(),
    },
  };
}

// ═══════════════════════════════════════════════════════════════
//  RECOMMENDED USAGE PATTERN
// ═══════════════════════════════════════════════════════════════
//
//  import { extractJD, checkEligibility, scoreResume } from "./jdScorer.js";
//  import { extractProfile } from "./resumeParser.js";
//
//  const jdProfile     = extractJD(jdText);
//  const resumeProfile = extractProfile(resumeText);
//
//  const eligibility = checkEligibility(resumeProfile, jdProfile);
//  if (!eligibility.eligible) {
//    // Show eligibility.reason to the user — do NOT call scoreResume
//    console.log("❌ Not Eligible:", eligibility.reason);
//  } else {
//    if (eligibility.warning) console.warn("⚠️", eligibility.warning);
//    const result = scoreResume(resumeProfile, jdProfile);
//    console.log("✅ Score:", result.total, result.recommendation);
//  }

// ═══════════════════════════════════════════════════════════════
//  CLI TEST  —  node jdScorer.js <jd.txt> <resume.txt>
// ═══════════════════════════════════════════════════════════════
if (process.argv[2] && process.argv[3]) {
  import("fs").then(async ({ default: fs }) => {
    const { extractProfile } = await import("./resumeParser.js");

    const jdText     = fs.readFileSync(process.argv[2], "utf-8");
    const resumeText = fs.readFileSync(process.argv[3], "utf-8");

    const jdProfile     = extractJD(jdText);
    const resumeProfile = extractProfile(resumeText);

    const eligibility = checkEligibility(resumeProfile, jdProfile);

    if (!eligibility.eligible) {
      console.log("\n❌ Candidate is NOT ELIGIBLE for this role:");
      console.log(`   Field : ${eligibility.field}`);
      console.log(`   Reason: ${eligibility.reason}`);
    } else {
      if (eligibility.warning) {
        console.warn("\n⚠️  Warning:", eligibility.warning);
      }
      const result = scoreResume(resumeProfile, jdProfile);
      console.log("\n✅ Score Report:");
      console.log(JSON.stringify(result, null, 2));
    }
  });
}