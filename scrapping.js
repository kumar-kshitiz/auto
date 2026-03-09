import { chromium } from "playwright";

const category = "Software Development";

async function randomWait(page, min = 1000, max = 2000) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await page.waitForTimeout(delay);
}

async function smoothScroll(page) {
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, 800);
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

await page.goto("https://internshala.com/internships/", {
  waitUntil: "domcontentloaded"
});


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

// SELECT CATEGORY
await page.evaluate((category) => {

  const select = document.querySelector("#select_category");

  const option = Array.from(select.options)
    .find(o => o.textContent.trim() === category);

  if (option) {
    select.value = option.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

}, category);


// wait for internships
await page.waitForSelector("h3.job-internship-name");

await smoothScroll(page);


const jobTitles = page.locator("h3.job-internship-name");
const companies = page.locator("p.company-name");
const locations = page.locator(".locations span a");
const stipends = page.locator(".stipend");
const durations = page.locator(".ic-16-calendar + span");
const postedAt = page.locator(".ic-16-reschedule + span");
const ppoStatus = page.locator(".ppo_status span span");
const cards = page.locator(".individual_internship");

const count = await jobTitles.count();

console.log("Total internships found:", count);

const applyLinks = [];

for (let i = 0; i < count; i++) {

  const title = await jobTitles.nth(i).textContent();
  const company = await companies.nth(i).textContent();
  const location = await locations.nth(i).textContent();
  const stipend = await stipends.nth(i).textContent();
  const duration = await durations.nth(i).textContent();
  const postago = await postedAt.nth(i).textContent();
  const ppoText = await ppoStatus.nth(i).textContent();

  const ppoOffered = ppoText ? ppoText.trim() : "Not mentioned";

  const applyLink = await cards.nth(i).getAttribute("data-href");

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


// PRINT LINKS
console.log("\nCollected Apply Links:\n");

for (const link of applyLinks) {
  console.log(link);
}

})();