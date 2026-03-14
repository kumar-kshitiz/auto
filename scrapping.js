import { chromium } from "playwright";
import { answerWithGemini } from './intern_ques_gemini.js';

const category = "backend development";
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

async function randomWait(page, min = 1000, max = 3000) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await page.waitForTimeout(delay);
}

async function smoothScroll(page, scrollState) {
  // for (let i = 0; i < 10; i++) {
  //   await page.mouse.wheel(0, 2000);
  //   await page.waitForTimeout(600);
  // }
  while (scrollState.keepScrolling) {
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(500);
  }
}

function getLongestCommonSubstring(a, b) {
  const m = a.length;
  const n = b.length;

  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  let maxLen = 0;
  let endIndex = 0;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;

        if (dp[i][j] > maxLen) {
          maxLen = dp[i][j];
          endIndex = i;
        }
      }
    }
  }

  return a.slice(endIndex - maxLen, endIndex).trim();
}

async function loginInternshala(page){
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
}

async function getInternshalaLink(category) {
  const slug = categoryMap[category.toLowerCase().trim()];
  if (!slug) {
    throw new Error("Invalid Category");
  }
  return `https://internshala.com/internships/${slug}-internship/`;
}

async function detailsFromJobCards(page, applyLinks) {
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


  for (let i = 0; i < count - 40; i++) {

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
}

async function fillCoverLetter(jobPage, coverLetter) {

  console.log("Cover Letter question present");
  const jobSummary = jobPage.locator('.job_summary');
  const sectionDivs = jobSummary.locator(':scope > div');

  const sectionCount = await sectionDivs.count();
  const allLiTexts = [];

  for (let i = 0; i < sectionCount; i++) {
    const section = sectionDivs.nth(i);
    const ulItems = section.locator('ul');
    const liItems = ulItems.locator('li');
    const liCount = await liItems.count();

    for (let j = 0; j < liCount; j++) {
      const text = (await liItems.nth(j).textContent())?.trim();
      if (text) {
        allLiTexts.push(text);
      }
    }
  }

  const finalText = allLiTexts.join('\n');
  console.log(finalText);

  const ansCL = await answerWithGemini(null, null, finalText);
  console.log(ansCL);

  const visibleEditor = coverLetter.locator('#cover_letter_holder');

  await visibleEditor.click();
  await jobPage.keyboard.press('Control+A');
  await jobPage.keyboard.press('Backspace');
  await jobPage.keyboard.type(ansCL, { delay: 5 });
}

async function fillUpQuestions(jobPage,questCount, questions) {
  for (let i = 0; i < questCount; i++) {

    const questionBlock = questions.nth(i);

    const optionQues = questionBlock.locator('.custom_question_boolean_container');
    const rangeSelect = questionBlock.locator('select.custom_question_range');
    const multipleOptQues = questionBlock.locator('.custom_question_mcq_container');
    const textQues = questionBlock.locator('.assessment_question label');

    // TYPE 1: Option question
    if (await optionQues.count() > 0) {
      await optionQues.locator('label').first().click();
      console.log("Option based question present");
    }

    // TYPE 2: Range question
    else if (await rangeSelect.count() > 0) {

      const options = rangeSelect.locator('option:not([disabled])');
      const count = await options.count();

      const lastValue = await options.nth(count - 1).getAttribute('value');

      await rangeSelect.evaluate((el, value) => {
        el.value = value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, lastValue);

      console.log("Range question answered with:", lastValue);
    }
    // TYPE-3: multiple questions:
    else if (await multipleOptQues.count() > 0) {
      console.log("HELLO");

      const question2 = await textQues.innerText();
      const geminiAnswers = await answerWithGemini(null, question2, null);

      console.log("Question:", question2);
      console.log("Gemini raw:", geminiAnswers);

      let matchedSet = new Set();

      try {
        const matchedValues = JSON.parse(geminiAnswers)
          .filter(v => typeof v === "string")
          .map(v => v.trim().toLowerCase());

        matchedSet = new Set(matchedValues);
        console.log("Matched values:", [...matchedSet]);
      } catch (error) {
        console.log("Failed to parse Gemini response:", error.message);
      }

      const optionLabels = multipleOptQues.locator('.checkbox label');
      const labelCount = await optionLabels.count();
      console.log("Total labels found:", labelCount);

      for (let i = 0; i < labelCount; i++) {
        const label = optionLabels.nth(i);
        const labelText = (await label.textContent())?.trim().toLowerCase();

        if (!labelText) continue;

        let bestMatch = "";
        let bestAnswer = "";

        for (const answer of matchedSet) {
          const commonSubstring = getLongestCommonSubstring(answer, labelText);

          if (commonSubstring.length > bestMatch.length) {
            bestMatch = commonSubstring;
            bestAnswer = answer;
          }
        }

        console.log(`Option ${i}: ${labelText}`);
        console.log(`Best common substring: "${bestMatch}" with "${bestAnswer}"`);

        if (bestAnswer) {
          const ratio = bestMatch.length / bestAnswer.length;

          if (bestMatch.length >= 4 && ratio >= 0.6) {
            await label.click();
            console.log(`Clicked: ${labelText}`);
          }
        }
      }
    }
    // TYPE 4: Text question
    else if (await textQues.count() > 0) {

      const question1 = await textQues.innerText();

      const generatedAnswer = await answerWithGemini(question1, null, null);

      console.log("Custom question:", question1);
      console.log("Gemini answer:", generatedAnswer);

      const textarea = questionBlock.locator('textarea');

      await textarea.click();
      await jobPage.keyboard.press("Control+A");
      await jobPage.keyboard.press("Backspace");
      await jobPage.keyboard.type(generatedAnswer,{dealy:5});
      
    }

  }
}

async function submitApplication(jobPage) {
  try {
    const submitbtn = jobPage.locator('.submit_button_container');

    await submitbtn.waitFor({ state: 'visible', timeout: 5000 });
    await submitbtn.click();

    console.log("Application submitted");
  } catch (error) {
    console.log("Submit button not found or clickable. Pausing script...");

    // pause for long time (e.g., 10 minutes)
    await jobPage.waitForTimeout(10 * 60 * 1000);
  }

  await randomWait(jobPage);
}

async function applyToInternships(applyLinks, context) {

  for (const link of applyLinks) {
    // open extracted link:

    const jobPage = await context.newPage();
    await jobPage.goto(link, { waitUntil: "domcontentloaded" });
    // jobPage.waitForTimeout(10 * 60 * 100000);

    const applyBtn = jobPage.locator('#top_easy_apply_button');
    const applyBtn2 = jobPage.locator('.apply_now_btn');

    if (await applyBtn2.count() > 0) {
      const btnText = ((await applyBtn2.first().textContent()) || "").trim().toLowerCase();

      if (btnText.includes("already applied")) {
        console.log("Already Applied!");
        continue;
      }
    }

    if (await applyBtn.isVisible()) {
      await applyBtn.click();
      console.log("Clicked Apply button");
    } else {
      console.log("Apply button not found");
    }

    // Check ask for cover letter:
    const coverLetter = jobPage.locator('.cover_letter_container');

    if (await coverLetter.count() > 0) {
      await fillCoverLetter(jobPage, coverLetter);
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

    const availabilityOfAdditionalQues = jobPage.locator('.additional_question');

    if (await availabilityOfAdditionalQues.count() > 0) {
      console.log("Additional questions present");

      // Additional question - four types:
      const questions = jobPage.locator('.form-group.additional_question');
      const questCount = await questions.count();

      await fillUpQuestions(jobPage,questCount, questions);

    } else {
      console.log("No additional questions available")
    }
    // await page.waitForSelector("a.apply_now_button",{ timeout: 12000000 });

    //submit application
    await submitApplication(jobPage);
    // close this page
    jobPage.close();
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

  // login to internshala
  await loginInternshala(page);
  
  const categoryLink = await getInternshalaLink(category);

  await page.goto(categoryLink, {
    waitUntil: "domcontentloaded"
  });


  let scrollState = { keepScrolling: true };
  // not wait even async call
  const scrollTask = smoothScroll(page, scrollState);

  const applyLinks = [];
  await detailsFromJobCards(page, applyLinks);

  scrollState.keepScrolling = false;
  await scrollTask;

  // apply to the link:
  await applyToInternships(applyLinks, context);

  page.close();
  context.close();

  console.log("Operation Successfull");

})();