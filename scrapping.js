import { chromium } from "playwright";
import {answerWithGemini} from './intern_ques_gemini.js';

const category = "software development";
// const url = "net-development,3d-printing,ai-agent-development,asp-net,accounts,acting,aerospace,agriculture-and-food-engineering,analytics,anchoring,android-app-development,angular-js-development,animation,architecture,artificial-intelligence-ai,audio-making-editing,auditing,automobile-engineering,backend-development,bank,big-data,bioinformatics,biology,biotech,blockchain-development,blogging,brand-management,business-development,mba,ca-articleship,cad-design,civil,cloud-computing,computer-science,computer-vision,cyber-security,data-entry,data-science,database-building,electrical,flutter-development,front-end-development,full-stack-development,java,javascript-development,mlops-engineering,machine-learning,natural-language-processing-nlp,node-js-development,search-engine-optimization-seo,software-development,software-testing,web-development,wordpress-development-internship";

const categoryMap = {
  "net development": "net-development",
  "3d printing": "3d-printing",
  "ai agent development": "ai-agent-development",
  "asp net": "asp-net",
  "accounts": "accounts",
  "acting": "acting",
  "aerospace": "aerospace",
  "agriculture and food engineering": "agriculture-and-food-engineering",
  "analytics": "analytics",
  "anchoring": "anchoring",
  "android app development": "android-app-development",
  "angular js development": "angular-js-development",
  "animation": "animation",
  "architecture": "architecture",
  "artificial intelligence": "artificial-intelligence-ai",
  "audio making editing": "audio-making-editing",
  "auditing": "auditing",
  "automobile engineering": "automobile-engineering",
  "backend development": "backend-development",
  "bank": "bank",
  "big data": "big-data",
  "bioinformatics": "bioinformatics",
  "biology": "biology",
  "biotech": "biotech",
  "blockchain development": "blockchain-development",
  "blogging": "blogging",
  "brand management": "brand-management",
  "business development": "business-development",
  "mba": "mba",
  "ca articleship": "ca-articleship",
  "cad design": "cad-design",
  "civil": "civil",
  "cloud computing": "cloud-computing",
  "computer science": "computer-science",
  "computer vision": "computer-vision",
  "cyber security": "cyber-security",
  "data entry": "data-entry",
  "data science": "data-science",
  "database building": "database-building",
  "electrical": "electrical",
  "flutter development": "flutter-development",
  "front end development": "front-end-development",
  "full stack development": "full-stack-development",
  "java": "java",
  "javascript development": "javascript-development",
  "mlops engineering": "mlops-engineering",
  "machine learning": "machine-learning",
  "natural language processing": "natural-language-processing-nlp",
  "node js development": "node-js-development",
  "seo": "search-engine-optimization-seo",
  "software development": "software-development",
  "software testing": "software-testing",
  "web development": "web-development",
  "wordpress development": "wordpress-development"
};

function getInternshalaLink(category){
  const slug = categoryMap[category.toLowerCase().trim()];
  if(!slug){
    throw new Error("Invalid Category");
  }
  return `https://internshala.com/internships/${slug}-internship/`;
}

async function randomWait(page, min = 1000, max = 3000) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await page.waitForTimeout(delay);
}

async function smoothScroll(page,scrollState) {
  // for (let i = 0; i < 10; i++) {
  //   await page.mouse.wheel(0, 2000);
  //   await page.waitForTimeout(600);
  // }
  while(scrollState.keepScrolling){
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(500);
  }
}

(async () => {

console.log("Starting bot...");

// Dedicated persistent profile
const context = await chromium.launchPersistentContext("./chrome-profile", {
  headless: false,
  channel: "chrome",
  viewport: null,
  args: [
    "--start-maximized",
    "--disable-blink-features=AutomationControlled"
  ]
});

console.log("Chrome launched");

const page = await context.newPage();

console.log("Opening Internshala...");

await page.goto("https://internshala.com/internships/");


// CHECK LOGIN
const profile = page.locator(".profile_name span");

let profileName = await profile.textContent().catch(() => null);

if (!profileName) {

  console.log("User not logged in.");
  console.log("Waiting for manual login...");

   // Handle Google popup if user clicks it
  context.on("page", async (popup) => {
    console.log("Google login popup detected");
    await popup.waitForLoadState("domcontentloaded");
  });
  // wait indefinitely until login happens
  await profile.waitFor({ state: "visible", timeout: 0 });

  profileName = await profile.textContent();
}

console.log("Logged in as:", profileName);

const categoryLink = getInternshalaLink(category);

await page.goto(categoryLink, {
  waitUntil: "domcontentloaded"
});


let scrollState = { keepScrolling: true };
// not wait even async call
const scrollTask = smoothScroll(page,scrollState);


const jobTitles = page.locator("h3.job-internship-name");
const companies = page.locator("p.company-name");
const locations = page.locator(".locations span a");
const stipends = page.locator("span.stipend");
const durations = page.locator(".ic-16-calendar + span");
const postedAt = page.locator(".ic-16-reschedule + span");
const ppoStatus = page.locator(".ppo_status span span");
const link = page.locator("h3.job-internship-name a");

// const count = page.locator(".individual_internship");
const count = await jobTitles.count();
console.log("Total internships found:", count);

const applyLinks = [];

for (let i = 0; i < count-40; i++) {

  const title = await jobTitles.nth(i).textContent();
  const company = await companies.nth(i).textContent();
  const location = await locations.nth(i).textContent();
  const stipend = await stipends.nth(i).textContent();
  const duration = await durations.nth(i).textContent();
  const postago = await postedAt.nth(i).textContent();
  // const ppoText = await ppoStatus.nth(i).textContent();

  // const ppoOffered = ppoText ? ppoText.trim() : "Not mentioned";
  let ppoOffered = "Not mentioned";

  if (await ppoStatus.count() > i) {
    const ppoText = await ppoStatus.nth(i).textContent();
    ppoOffered = ppoText ? ppoText.trim() : "Not mentioned";
  }

  const applyLink = await link.nth(i).getAttribute("href");

  const fullLink = "https://internshala.com" + applyLink;

  applyLinks.push(fullLink);

  await randomWait(page);

  console.log("Job:", title);
  console.log("Company:", company);
  console.log("Location:", location);
  console.log("Stipend:", stipend);
  console.log("Duration:", duration);
  console.log("Posted:", postago);
  console.log("PPO:", ppoOffered);
  console.log("----------------");
}

scrollState.keepScrolling = false;
await scrollTask;

// PRINT LINKS
console.log("\nCollected Apply Links:\n");

// for (const link of applyLinks) {
//   console.log(link);
// }

// apply to the link:

for (const link of applyLinks) {
  // open extracted link:
  const jobPage = await context.newPage();
  await jobPage.goto(link,{ waitUntil: "domcontentloaded" });

  const applyBtn = jobPage.locator('#top_easy_apply_button');
  const applyBtn2 = jobPage.locator('.apply_now_btn');

  if (await applyBtn2.isDisabled()) {
    continue;
  }

  if (await applyBtn.isVisible()) {
    await applyBtn.click();
    console.log("Clicked Apply button");
  } else {
    console.log("Apply button not found");
  }

// confirmation availability question set to YES
const availabilityOption = jobPage.locator('#confirm_availability_container label').first();

if (await availabilityOption.count() > 0) {
  await availabilityOption.check();   // better for radio buttons
  console.log("Availability confirmed");
} else {
  console.log("Availability option not present");
}

// check whether additional question present or not ?

const availabilityOfAdditionalQues=jobPage.locator('.additional_question');

if(await availabilityOfAdditionalQues.count()>0){
  console.log("Additional questions present");
  //count no.of question present:
  // const questCount = await availabilityOfAdditionalQues.count();

  // Additional question - three types:
  const questions = jobPage.locator('.form-group.additional_question');
const questCount = await questions.count();


  for (let i = 0; i < questCount; i++) {

  const questionBlock = questions.nth(i);

  const optionQues = questionBlock.locator('.custom_question_boolean_container');
  const rangeSelect = questionBlock.locator('select.custom_question_range');
  const textQues = questionBlock.locator('.assessment_question label');

  // TYPE 1: Option question
  if (await optionQues.count() > 0) {
    await optionQues.locator('label').first().click();
    console.log("Option based question present");
  }

  // // TYPE 2: Range question
  // else if (await rangeSelect.count() > 0) {

  //   const options = rangeSelect.locator('option:not([disabled])');
  //   const count = await options.count();

  //   const lastValue = await options.nth(count - 1).getAttribute('value');

  //   await rangeSelect.selectOption(lastValue);

  //   console.log("Range question answered with:", lastValue);
  // }

  // TYPE 3: Text question
  else if (await textQues.count() > 0) {

    const question = await textQues.innerText();

    const generatedAnswer = await answerWithGemini(question);

    console.log("Custom question:", question);
    console.log("Gemini answer:", generatedAnswer);

    const textarea = questionBlock.locator('textarea');

    await textarea.fill(generatedAnswer);
  }
}
}else{
  console.log("No additional questions available")
}

const submitbtn = jobPage.locator('.submit_button_container');

await submitbtn.click();

await randomWait(jobPage);

  // await page.waitForSelector("a.apply_now_button",{ timeout: 12000000 });
  // page.setDefaultNavigationTimeout(6000000);

  // await page.click("#easy_apply_button");
  
  // const getNewApplyLink = await page.locator('a.apply_now_button').getAttribute("href");
  // const newFullLink = "https://internshala.com" + getNewApplyLink;
  // console.log(newFullLink);
  
  // close this page
  jobPage.close();
}


page.close();
context.close();


})();