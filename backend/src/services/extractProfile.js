/**
 * resumeParser.js
 * ────────────────────────────────────────────────────────────────
 * Pure rule-based resume profile extractor — zero LLM calls.
 *
 * Techniques used per field:
 *  name             → positional heuristic: first capitalised non-keyword
 *                     line near top of resume
 *  skills           → dictionary lookup against 400+ canonical tech/domain skills
 *  targetRoles      → role dictionary matched against skills + section text
 *  yearsOfExperience→ regex on date-ranges (MM/YYYY – MM/YYYY or YYYY–YYYY)
 *  educationLevel   → degree-keyword lookup (B.Tech, MBA, PhD …)
 *  educationDomain  → branch/major extracted from education section
 *  preferredLocations→ Indian city name match (200+ cities)
 *  jobType          → rule: student/0yr→internship, <2yr→both, else full-time
 *  keyAchievements  → sentences containing impact verbs + numeric metric
 *  graduationYear   → extracted from education section date ranges/patterns
 *
 * CHANGES vs original:
 *  - splitSections(): heading detection now requires the line to consist ONLY
 *    of the heading keyword (± punctuation), preventing long body sentences
 *    that start with a keyword word from hijacking the current section.
 *  - Removed the old checkGraduationEligibility() export — that logic now
 *    lives in jdScorer.js as checkEligibility() which handles both experience
 *    and graduation-year eligibility in one place.
 */

import nlp from "compromise";

// ═══════════════════════════════════════════════════════════════
//  DICTIONARIES
// ═══════════════════════════════════════════════════════════════

const SKILLS_DICT = new Set([
  // Languages
  "javascript","typescript","python","java","c","c++","c#","go","golang","rust",
  "kotlin","swift","ruby","php","scala","r","matlab","perl","bash","shell",
  "dart","elixir","haskell","lua","objective-c","assembly","vba","groovy",
  // Web frontend
  "html","html5","css","css3","sass","less","react","reactjs","react.js","nextjs","next.js",
  "vue","vuejs","angular","svelte","tailwind","tailwind css","tailwindcss","bootstrap","jquery","webpack",
  "vite","redux","zustand","graphql","rest","restful","websocket","pwa",
  // Web backend
  "nodejs","node.js","express","expressjs","fastapi","fast api","flask","django","spring",
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
  "faiss","streamlit","playwright","rag","groq",
  // Testing
  "jest","mocha","chai","cypress","selenium","playwright","junit","pytest",
  "testing","unit testing","integration testing","tdd","bdd",
  // Tools & methodologies
  "git","github","gitlab","bitbucket","jira","confluence","figma","postman",
  "swagger","agile","scrum","kanban","microservices","serverless","grpc",
  "kafka","rabbitmq","celery","websockets","oauth","jwt","api","sdk",
  // Domain/soft skills (technical)
  "system design","oop","functional programming","data structures","algorithms",
  "operating systems","networking","cryptography","blockchain","web3","solidity",
  "embedded systems","iot","raspberry pi","arduino","fpga","verilog","vhdl",
  // Business/analytics
  "excel","power bi","tableau","looker","sql","nosql","etl","data warehousing",
  "product management","product analytics","a/b testing","google analytics",
  "seo","digital marketing","salesforce","sap","erp","crm",
  // Finance/quant
  "financial modeling","valuation","investment banking","equity research",
  "risk management","derivatives","fixed income","portfolio management",
  // RESTful APIs (common resume phrase)
  "restful apis","rest api","restful api",
]);

const ROLES_DICT = [
  { role:"Software Engineer",         signals:["javascript","python","java","c++","algorithms","data structures"] },
  { role:"Frontend Developer",        signals:["react","html","css","javascript","typescript","vue","angular"] },
  { role:"Backend Developer",         signals:["nodejs","java","python","django","spring","api","database","postgresql","mongodb"] },
  { role:"Full Stack Developer",      signals:["react","nodejs","html","css","javascript","database"] },
  { role:"Mobile Developer",          signals:["android","ios","flutter","react native","kotlin","swift","dart"] },
  { role:"Data Scientist",            signals:["machine learning","python","pandas","scikit-learn","tensorflow","pytorch","statistics"] },
  { role:"Data Analyst",              signals:["sql","excel","python","tableau","power bi","data analysis","pandas"] },
  { role:"Data Engineer",             signals:["spark","kafka","airflow","etl","sql","python","data warehousing","hadoop"] },
  { role:"ML Engineer",               signals:["machine learning","tensorflow","pytorch","python","mlops","mlflow","deep learning"] },
  { role:"DevOps Engineer",           signals:["docker","kubernetes","aws","azure","ci/cd","terraform","jenkins","linux"] },
  { role:"Cloud Engineer",            signals:["aws","azure","gcp","terraform","cloud","kubernetes","docker"] },
  { role:"Android Developer",         signals:["android","kotlin","java","jetpack","android studio"] },
  { role:"iOS Developer",             signals:["ios","swift","objective-c","xcode","uikit","swiftui"] },
  { role:"UI/UX Designer",            signals:["figma","design","wireframe","prototyping","user research","ux","ui"] },
  { role:"Product Manager",           signals:["product management","roadmap","agile","scrum","jira","analytics","stakeholder"] },
  { role:"Cybersecurity Analyst",     signals:["security","cryptography","penetration testing","firewalls","siem","networking"] },
  { role:"Embedded Systems Engineer", signals:["embedded","c","rtos","fpga","arduino","raspberry pi","verilog","microcontroller"] },
  { role:"Blockchain Developer",      signals:["blockchain","solidity","web3","ethereum","smart contracts","defi"] },
  { role:"Database Administrator",    signals:["sql","postgresql","mysql","oracle","database","indexing","query optimization"] },
  { role:"Quant Analyst",             signals:["financial modeling","statistics","python","r","derivatives","risk","matlab"] },
  { role:"Business Analyst",          signals:["business analysis","requirements","sql","excel","stakeholder","tableau","agile"] },
];

const DEGREE_MAP = [
  { patterns:["b.tech","b.e.","be ","btech","bachelor of technology","bachelor of engineering","b.sc","bsc","bachelor of science","b.com","bcom","bba","b.a.","ba ","bachelor"], level:"student" },
  { patterns:["m.tech","mtech","m.e.","master of technology","master of engineering","m.sc","msc","mba","master of business","m.a.","ma ","master","pgdm","pgd"], level:"fresher" },
  { patterns:["phd","ph.d","doctorate","doctor of philosophy"],           level:"senior"  },
  { patterns:["12th","hsc","higher secondary","plus two","intermediate"],  level:"student" },
  { patterns:["diploma","polytechnic"],                                    level:"student" },
];

const DOMAIN_PATTERNS = [
  ["Computer Science","computer science","cse","cs ","c.s."],
  ["Information Technology","information technology"," it "," i.t."],
  ["Electronics & Communication","electronics","ece","e&c","communication engineering"],
  ["Electrical Engineering","electrical","eee","e.e.e.","electrical engineering"],
  ["Mechanical Engineering","mechanical","mech","mechanical engineering"],
  ["Civil Engineering","civil engineering"],
  ["Chemical Engineering","chemical engineering","chem engg"],
  ["Biotechnology","biotechnology","biotech"],
  ["Data Science","data science"],
  ["Artificial Intelligence","artificial intelligence","ai and ml","ai & ml"],
  ["Finance","finance","financial"],
  ["Marketing","marketing"],
  ["Human Resources","human resource","hr management"],
  ["Operations","operations management","supply chain"],
  ["MBA","mba","master of business administration"],
  ["Physics","physics","b.sc physics"],
  ["Mathematics","mathematics","statistics","b.sc maths"],
];

const INDIAN_CITIES = new Set([
  "mumbai","delhi","bangalore","bengaluru","hyderabad","ahmedabad","chennai","gautam buddha nagar",
  "kolkata","surat","pune","jaipur","lucknow","kanpur","nagpur","indore",
  "thane","bhopal","visakhapatnam","pimpri","patna","vadodara","ghaziabad",
  "ludhiana","agra","nashik","faridabad","meerut","rajkot","varanasi",
  "srinagar","aurangabad","dhanbad","amritsar","allahabad","prayagraj",
  "ranchi","howrah","coimbatore","jabalpur","gwalior","vijayawada","jodhpur",
  "madurai","raipur","kota","chandigarh","guwahati","solapur","hubballi",
  "tiruchirappalli","bareilly","mysuru","mysore","tiruppur","gurgaon",
  "gurugram","aligarh","jalandhar","bhubaneswar","salem","mira-bhayandar",
  "warangal","guntur","bhiwandi","saharanpur","gorakhpur","bikaner","amravati",
  "noida","jamshedpur","bhilai","cuttack","firozabad","kochi","ernakulam",
  "navi mumbai","dehradun","durgapur","asansol","rourkela","nanded","kolhapur",
  "ajmer","akola","gulbarga","jamnagar","ujjain","loni","siliguri","jhansi",
  "ulhasnagar","nellore","jammu","sangli","belgaum","belagavi","mangaluru",
  "mangalore","ambattur","tirunelveli","malegaon","gaya","jalgaon","udaipur",
  "maheshtala","davanagere","kozhikode","calicut","kurnool","rajpur sonarpur",
  "bokaro","south dumdum","bellary","patiala","gopalpur","agartala","bhagalpur",
  "muzaffarnagar","bhatpara","panihati","latur","dhule","rohtak","korba",
  "bhilwara","brahmapur","muzaffarpur","ahmednagar","mathura","kollam",
  "avadi","kadapa","kamarhati","bilaspur","shahjahanpur","bijapur","vijapura",
  "rampur","shimoga","shivamogga","chandrapur","junagadh","thrissur",
  "alwar","bardhaman","kulti","nizamabad","parbhani","tumkur","kharagpur",
  "bihar sharif","panipat","deoghar","ichalkaranji","tirupati","karnal",
  "nagercoil","imphal","ratlam","hapur","arrah","anantapur","karimnagar",
  "etawah","ambernath","north dumdum","bathinda","bahadurgarh","haldwani",
  "phusro","kirari suleman nagar","pondicherry","puducherry",
  "remote","pan india","anywhere in india",
]);

const IMPACT_VERBS = new Set([
  "built","developed","designed","implemented","created","launched","deployed",
  "reduced","increased","improved","optimised","optimized","achieved","led",
  "managed","delivered","automated","saved","generated","boosted","scaled",
  "migrated","refactored","integrated","maintained","architected","engineered",
  "published","won","awarded","ranked","secured","raised","contributed",
  "authored","researched","analyzed","analysed","established","streamlined",
]);

// ═══════════════════════════════════════════════════════════════
//  SECTION SPLITTER  (fixed heading detection)
// ═══════════════════════════════════════════════════════════════

const SECTION_KEYWORDS = {
  experience   : ["experience","work experience","employment","internship","professional background","career"],
  education    : ["education","academic","qualification","degree","studies"],
  skills       : ["skills","technical skills","technologies","core competencies","tools","languages","frameworks"],
  projects     : ["projects","personal projects","academic projects","portfolio"],
  achievements : ["achievements","awards","honors","honours","certifications","accomplishments","activities"],
  summary      : ["summary","objective","profile","about","overview"],
};

/**
 * FIX: A line is treated as a section heading only when its ENTIRE content
 * (after stripping bullets, colons, and whitespace) matches a heading keyword.
 * Previously `lower.startsWith(kw)` would mis-classify body sentences like
 * "Experienced developer who built …" as the "experience" section heading.
 */
function isHeadingLine(lower) {
  // Strip common heading decorators
  const cleaned = lower
    .replace(/^[•\-–—*#>|\s]+/, "")  // leading bullets/symbols
    .replace(/[:.\s]+$/, "")          // trailing colon/period/space
    .trim();

  for (const [sec, keywords] of Object.entries(SECTION_KEYWORDS)) {
    if (keywords.some((kw) => cleaned === kw)) {
      return sec;
    }
  }
  return null;
}

function splitSections(text) {
  const lines    = text.split(/\r?\n/);
  const sections = {
    raw         : text,
    experience  : "",
    education   : "",
    skills      : "",
    projects    : "",
    achievements: "",
    summary     : "",
    other       : "",
  };
  let current = "other";

  for (const line of lines) {
    const lower   = line.trim().toLowerCase();
    const heading = isHeadingLine(lower);

    if (heading) {
      current = heading;
    } else {
      sections[current] += line + "\n";
    }
  }

  return sections;
}

// ═══════════════════════════════════════════════════════════════
//  FIELD EXTRACTORS
// ═══════════════════════════════════════════════════════════════

const NAME_STOPWORDS = new Set([
  "resume","curriculum","vitae","cv","profile","contact","address","email",
  "phone","mobile","linkedin","github","portfolio","objective","summary",
]);

function extractName(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const candidates = lines.slice(0, 12);

  for (const line of candidates) {
    const words = line.split(/\s+/);
    if (words.length < 2 || words.length > 5) continue;
    if (/[\d@|•:\/\\]/.test(line)) continue;
    if (!words.every((w) => /^[A-Z]/.test(w))) continue;
    if (words.some((w) => NAME_STOPWORDS.has(w.toLowerCase()))) continue;
    const doc = nlp(line);
    if (doc.people().length > 0 || words.every((w) => /^[A-Z][a-z]+$/.test(w))) {
      return line;
    }
  }

  for (const line of candidates) {
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.every((w) => /^[A-Z][a-z]/.test(w))) {
      return line;
    }
  }

  return "Unknown";
}

// ── SKILLS ──────────────────────────────────────────────────────
// Alias map so variants found in resume text map to canonical skills
const SKILL_ALIASES = {
  "reactjs"      : "react",
  "react.js"     : "react",
  "nodejs"       : "node.js",
  "node"         : "node.js",
  "postgres"     : "postgresql",
  "k8s"          : "kubernetes",
  "sklearn"      : "scikit-learn",
  "scikit learn" : "scikit-learn",
  "ml"           : "machine learning",
  "js"           : "javascript",
  "ts"           : "typescript",
  "py"           : "python",
  "golang"       : "go",
  "next.js"      : "nextjs",
  "vue.js"       : "vue",
  "vuejs"        : "vue",
  "angular.js"   : "angular",
  "angularjs"    : "angular",
  "express.js"   : "express",
  "expressjs"    : "express",
  "springboot"   : "spring",
  "spring boot"  : "spring",
  "gcp"          : "google cloud",
  "aws lambda"   : "aws",
  "mongo"        : "mongodb",
  "mongo db"     : "mongodb",
  "pg"           : "postgresql",
  "redis db"     : "redis",
  "ci cd"        : "ci/cd",
  "restful"      : "rest",
  "rest api"     : "rest",
  "restful api"  : "rest",
  "restful apis" : "rest",
  "graphql api"  : "graphql",
  "tailwind css" : "tailwind",
  "tailwindcss"  : "tailwind",
  "fast api"     : "fastapi",
  "hugging face" : "huggingface",
  "llama"        : "llm",
  "llama3"       : "llm",
  "llama2"       : "llm",
  "gemini api"   : "llm",
  "groq api"     : "llm",
  "faiss"        : "machine learning",
};

function normalizeSkill(raw) {
  const s = raw.toLowerCase().trim();
  return SKILL_ALIASES[s] || s;
}

function extractSkills(sections) {
  const searchText = [
    sections.skills,
    sections.projects,
    sections.summary,
    sections.experience,
  ]
    .join(" ")
    .toLowerCase()
    .replace(/[•\-–|,\/()[\]]/g, " ")
    .replace(/\s+/g, " ");

  const found = new Set();

  // Multi-word skills first (up to 3 words), then 2-word, then single
  for (let n = 3; n >= 1; n--) {
    const words = searchText.split(" ");
    for (let i = 0; i <= words.length - n; i++) {
      const phrase = words.slice(i, i + n).join(" ").trim();
      if (!phrase) continue;

      // Direct hit
      if (SKILLS_DICT.has(phrase)) { found.add(phrase); continue; }
      // Alias hit → store canonical
      if (SKILL_ALIASES[phrase])   { found.add(SKILL_ALIASES[phrase]); continue; }
    }
  }

  // Canonical form cleanup — prefer longer match, remove substrings
  const arr = [...found].sort((a, b) => b.length - a.length);
  const cleaned = arr.filter(
    (s) =>
      !arr.some(
        (longer) =>
          longer !== s &&
          longer.includes(s) &&
          longer.split(" ").length > s.split(" ").length
      )
  );

  return cleaned;
}

// ── YEARS OF EXPERIENCE ──────────────────────────────────────────

const MONTHS_MAP = {
  jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11,
  january:0,february:1,march:2,april:3,june:5,july:6,august:7,
  september:8,october:9,november:10,december:11,
};

function parseMonthYear(str) {
  str = String(str).toLowerCase().trim();
  if (!str) return null;

  if (/\b(present|current|till date|today)\b/.test(str)) {
    const now = new Date();
    return { month: now.getMonth(), year: now.getFullYear() };
  }

  const slashFmt = str.match(/(\d{1,2})\/(\d{2,4})/);
  if (slashFmt) {
    let month = parseInt(slashFmt[1], 10) - 1;
    let year  = parseInt(slashFmt[2], 10);
    if (year < 100) year += 2000;
    return { month: Math.max(0, Math.min(11, month)), year };
  }

  const mmYYYY = str.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b\s*(\d{2,4})/i
  );
  if (mmYYYY) {
    let year = parseInt(mmYYYY[2], 10);
    if (year < 100) year += 2000;
    return { month: MONTHS_MAP[mmYYYY[1].toLowerCase()] ?? 0, year };
  }

  const yearOnly = str.match(/\b(\d{4})\b/);
  if (yearOnly) return { month: 0, year: parseInt(yearOnly[1], 10) };

  const shortYear = str.match(/\b(\d{2})\b/);
  if (shortYear) {
    const year = parseInt(shortYear[1], 10);
    if (year > 10) return { month: 0, year: 1900 + year };
    return { month: 0, year: 2000 + year };
  }

  return null;
}

function monthsDiff(from, to) {
  return (to.year - from.year) * 12 + (to.month - from.month);
}

function extractYearsOfExperience(sections = {}) {
  const expText = (sections.experience || "").trim();

  if (!expText || expText.length < 5) {
    return { totalMonths: 0, years: 0, months: 0, decimalYears: 0 };
  }

  const workPatterns = [
    /\b(worked|developed|managed|led|built|engineered|architected|responsible|supervised|mentored|designed|implemented)\b/i,
    /\b(software engineer|developer|analyst|manager|architect|lead|consultant|specialist|executive|director|engineer|designer|administrator)\b/i,
    /\b(company|organization|corporation|corp|inc|ltd|llp|startup)\b/i,
    /\b(intern|internship|full[- ]?time|part[- ]?time|contract|employment|job|role|position)\b/i,
  ];

  const hasWorkContent = workPatterns.some((p) => p.test(expText));
  if (!hasWorkContent) return { totalMonths: 0, years: 0, months: 0, decimalYears: 0 };

  const ranges = extractDateRanges(expText);

  if (ranges.length > 0) {
    const merged     = mergeRanges(ranges);
    const totalMonths = merged.reduce((sum, r) => sum + (r.end - r.start + 1), 0);
    return formatExperience(totalMonths);
  }

  const duration = extractExplicitDuration(expText);
  if (duration > 0) return formatExperience(duration);

  return { totalMonths: 0, years: 0, months: 0, decimalYears: 0 };
}

function extractDateRanges(text) {
  const ranges = [];
  const dateToken =
    "(?:present|current|till\\s*date|today|now|" +
    "\\d{1,2}[\\/.-]\\d{2,4}|" +
    "\\d{4}[\\/.-]\\d{1,2}|" +
    "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\s*'?\\d{2,4}|" +
    "\\d{4}" +
    ")";

  const regex = new RegExp(
    `(${dateToken})\\s*(?:-|–|—|to|until|through)\\s*(${dateToken})`,
    "gi"
  );

  let match;
  while ((match = regex.exec(text)) !== null) {
    const from = parseDate(match[1]);
    const to   = parseDate(match[2]);
    if (!from || !to) continue;

    let start = monthIndex(from);
    let end   = monthIndex(to);
    if (start > end) [start, end] = [end, start];

    const diff = end - start + 1;
    if (diff > 0 && diff < 600) ranges.push({ start, end });
  }

  return removeDuplicateRanges(ranges);
}

function parseDate(value) {
  if (!value) return null;
  const str = value.trim().toLowerCase();

  if (["present","current","today","now"].includes(str) || str.includes("till date")) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }

  const monthMap = {
    jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,
    jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,sept:9,september:9,
    oct:10,october:10,nov:11,november:11,dec:12,december:12,
  };

  let m = str.match(
    /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*'?(\d{2,4})/
  );
  if (m) {
    let year = parseInt(m[2], 10);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    return { year, month: monthMap[m[1]] };
  }

  m = str.match(/^(\d{1,2})[\/.-](\d{2,4})$/);
  if (m) {
    let month = parseInt(m[1], 10);
    let year  = parseInt(m[2], 10);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    if (month >= 1 && month <= 12) return { year, month };
  }

  m = str.match(/^(\d{4})[\/.-](\d{1,2})$/);
  if (m) {
    const year  = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    if (month >= 1 && month <= 12) return { year, month };
  }

  m = str.match(/^(\d{4})$/);
  if (m) return { year: parseInt(m[1], 10), month: 1 };

  return null;
}

function monthIndex(date) {
  return date.year * 12 + (date.month - 1);
}

function mergeRanges(ranges) {
  if (!ranges.length) return [];
  ranges.sort((a, b) => a.start - b.start);
  const merged = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const current = ranges[i];
    const last    = merged[merged.length - 1];
    if (current.start <= last.end + 1) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

function removeDuplicateRanges(ranges) {
  const seen = new Set();
  return ranges.filter((r) => {
    const key = `${r.start}-${r.end}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractExplicitDuration(text) {
  let maxMonths = 0;
  const regex = /(\d+)\s*(?:years?|yrs?)\s*(?:[, ]*(?:and)?\s*(\d+)\s*(?:months?|mos?))?/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const years  = parseInt(match[1], 10) || 0;
    const months = parseInt(match[2], 10) || 0;
    maxMonths = Math.max(maxMonths, years * 12 + months);
  }
  return maxMonths;
}

function formatExperience(totalMonths) {
  const years  = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return { totalMonths, years, months, decimalYears: Number((totalMonths / 12).toFixed(1)) };
}

// ── EDUCATION LEVEL ──────────────────────────────────────────────
function extractEducationLevel(sections, yearsOfExp) {
  const eduText = (sections.education + " " + sections.raw).toLowerCase();

  if (/phd|ph\.d|doctorate/.test(eduText)) return "senior";

  if (/m\.tech|mtech|m\.e\.|mba|m\.sc|pgdm|master/.test(eduText)) {
    return yearsOfExp > 2 ? "mid-level" : "fresher";
  }

  if (/b\.tech|btech|b\.e\.|bsc|b\.sc|b\.com|bba|bachelor/.test(eduText)) {
    if (yearsOfExp === 0) return "student";
    if (yearsOfExp < 2)  return "fresher";
    return "mid-level";
  }

  if (/diploma|12th|hsc|higher secondary/.test(eduText)) return "student";

  if (yearsOfExp === 0) return "student";
  if (yearsOfExp < 2)   return "fresher";
  if (yearsOfExp < 6)   return "mid-level";
  return "senior";
}

// ── EDUCATION DOMAIN ─────────────────────────────────────────────
function extractEducationDomain(sections) {
  const eduText = (sections.education + " " + sections.raw).toLowerCase();
  for (const [domain, ...keywords] of DOMAIN_PATTERNS) {
    if (keywords.flat().some((kw) => eduText.includes(kw))) return domain;
  }
  return "Engineering";
}

// ── GRADUATION YEAR ──────────────────────────────────────────────
function extractGraduationYear(sections) {
  const text = (sections.education + " " + sections.raw).toLowerCase();
  const now     = new Date().getFullYear();
  const maxYear = now + 10;
  let graduationYear = null;

  const isValidYear = (y) => y >= 2000 && y <= maxYear;

  // "Aug 2023 – Aug 2027" style — take the end year
  const batchRangePattern = /(\d{4})\s*(?:-|to|–)\s*(\d{4})(?:\s*batch)?/g;
  let match;

  while ((match = batchRangePattern.exec(text)) !== null) {
    const startYear = parseInt(match[1], 10);
    const endYear   = parseInt(match[2], 10);
    if (isValidYear(startYear) && isValidYear(endYear) && startYear < endYear) {
      graduationYear = endYear;
      break;
    }
  }

  if (graduationYear) return graduationYear;

  const singleYearPattern =
    /(?:passing year|passed year|year of passing|graduation year|expected to graduate in|expected graduation|class of|batch of|graduating in|graduated in)\s*[:\-]?\s*(\d{4})/g;

  while ((match = singleYearPattern.exec(text)) !== null) {
    const year = parseInt(match[1], 10);
    if (isValidYear(year)) return year;
  }

  return null;
}

// ── PREFERRED LOCATIONS ──────────────────────────────────────────
function extractLocations(sections) {
  const searchText = (
    sections.raw + " " + sections.summary + " " + sections.experience
  ).toLowerCase();
  const found = new Set();

  for (const city of INDIAN_CITIES) {
    const re = new RegExp(`\\b${city}\\b`, "i");
    if (re.test(searchText)) found.add(city.charAt(0).toUpperCase() + city.slice(1));
  }

  if (/\b(remote|work from home|wfh)\b/i.test(searchText)) found.add("Remote");

  return found.size > 0 ? [...found].slice(0, 4) : ["India"];
}

// ── KEY ACHIEVEMENTS ─────────────────────────────────────────────
const OUTCOME_WORDS = new Set([
  "award","prize","winner","scholarship","rank","top","first","gold","silver",
  "published","patent","hackathon","competition","honour","honor","fellowship",
]);

function extractAchievements(sections) {
  const text = [
    sections.achievements,
    sections.experience,
    sections.projects,
    sections.raw,
  ].join(" ");

  const sentences = text
    .split(/[.\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && s.length < 300);

  const scored = sentences.map((s) => {
    const lower = s.toLowerCase();
    let score = 0;

    const words = lower.split(/\s+/);
    if (words.some((w) => IMPACT_VERBS.has(w))) score += 2;
    if (/\d+%|\d+x|\d+\s*(times|hours|users|customers|ms|seconds|kb|mb|gb)/i.test(s)) score += 3;
    if (/\$|₹|usd|inr|lakh|crore|million|billion/i.test(s)) score += 2;
    if (/\d+/.test(s)) score += 1;
    if ([...OUTCOME_WORDS].some((w) => lower.includes(w))) score += 2;

    return { s, score };
  });

  const seen = new Set();
  return scored
    .filter((x) => x.score >= 3)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.s.replace(/^[-•*]\s*/, "").trim())
    .filter((s) => { if (seen.has(s)) return false; seen.add(s); return true; })
    .slice(0, 4);
}

// ── TARGET ROLES ─────────────────────────────────────────────────
function extractTargetRoles(skills) {
  const skillSet = new Set(skills.map((s) => s.toLowerCase()));

  const scored = ROLES_DICT.map(({ role, signals }) => {
    const matches = signals.filter((sig) =>
      [...skillSet].some((sk) => sk.includes(sig) || sig.includes(sk))
    );
    return { role, score: matches.length };
  });

  return scored
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((r) => r.role);
}

// ── JOB TYPE ─────────────────────────────────────────────────────
function inferJobType(educationLevel, yearsOfExp) {
  if (educationLevel === "student" || yearsOfExp === 0) return "internship";
  if (yearsOfExp < 2) return "both";
  return "full-time";
}

// ═══════════════════════════════════════════════════════════════
//  MAIN EXPORTED FUNCTION
// ═══════════════════════════════════════════════════════════════

/**
 * extractProfile(resumeText: string) → profile object
 *
 * Returns:
 *  name, targetRoles, skills, yearsOfExperience, experience,
 *  educationLevel, educationDomain, graduationYear,
 *  keyAchievements, preferredLocations, rawSections, jobType
 */
export function extractProfile(resumeText) {
  console.log("Extracting profile from resume (rule-based, no LLM)...");

  const text = resumeText
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[–—]/g, "-");

  const sections = splitSections(text);

  const experienceDetails = extractYearsOfExperience(sections);
  const yearsOfExp        = experienceDetails.decimalYears || 0;
  const educationLevel    = extractEducationLevel(sections, yearsOfExp);
  const skills            = extractSkills(sections);
  const targetRoles       = extractTargetRoles(skills);

  const profile = {
    name             : extractName(text),
    targetRoles      : targetRoles.length > 0 ? targetRoles : ["Software Engineer"],
    skills,
    yearsOfExperience: yearsOfExp,
    experience       : experienceDetails,
    educationLevel,
    educationDomain  : extractEducationDomain(sections),
    keyAchievements  : extractAchievements(sections),
    preferredLocations: extractLocations(sections),
    graduationYear   : extractGraduationYear(sections),
    rawSections      : sections,
    jobType          : inferJobType(educationLevel, yearsOfExp),
  };

  console.log("Profile extracted (no LLM tokens used)");
  return profile;
}

// ── CLI test: node resumeParser.js resume.txt ─────────────────
if (process.argv[2]) {
  import("fs").then(({ default: fs }) => {
    import("pdf-parse").then(async ({ default: pdfParse }) => {
      let text;
      if (process.argv[2].endsWith(".pdf")) {
        const data = await pdfParse(fs.readFileSync(process.argv[2]));
        text = data.text;
      } else {
        text = fs.readFileSync(process.argv[2], "utf-8");
      }
      const profile = extractProfile(text);
      console.log("\n Extracted Profile:\n");
      console.log(JSON.stringify(profile, null, 2));
    });
  });
}