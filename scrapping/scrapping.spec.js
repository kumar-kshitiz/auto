import { chromium,test } from '@playwright/test';
test.setTimeout(100000); // 1.8 minutes
const category = "Software Development";

async function randomWait(page, min = 1000, max = 1500) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await page.waitForTimeout(delay);
}

function randomNumber(){
    const delay = Math.floor(Math.random() * (10)) + 21;
    return delay;
}

async function smoothScroll(page) {
  await page.evaluate(async () => {
    for(let i=0;i<10;i++){
        await page.mouse.wheel(0, 800);   // scroll down
        await page.waitForTimeout(400);   // small pause
    }
  });
}

test('Internshala Auto Apply Bot', async () => {

    const context = await chromium.launchPersistentContext(
    "/home/kshitiz/.config/google-chrome/Default",
        {
            headless: false,
            channel: "chrome"
        }
    );

    console.log("Browser launched");
    const page = await context.newPage();
    console.log("Page created");

    // remove popup completely
    await page.addInitScript(() => {

        function removeModal() {
            const modal = document.querySelector('.subscription_alert');
            if (modal) modal.remove();

            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) backdrop.remove();
        }

        removeModal();

        const observer = new MutationObserver(removeModal);

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    });

    console.log("Page loaded");
    await page.goto("https://internshala.com/internships/");
    await page.waitForLoadState("domcontentloaded");

    const loggedIn = await page.evaluate(async () => {
        const res = await fetch("/registration/student", {
            method: "GET",
            credentials: "include",
            redirect: "follow"
        });

        return res.url.includes("/student/dashboard");
    });



    if (!loggedIn) {
        console.log("User not logged in. Please login first.");
        return;
    }

    console.log("User logged in. Starting internship apply process...");

    // Continue Bot logic
    // select category
    // await page.fill("#select_category_chosen input", "Civil Engineering");
    

    await page.evaluate((category) => {

        const select = document.querySelector("#select_category");

        const option = Array.from(select.options)
        .find(o => o.textContent.trim() === category);

        if(option){
            select.value = option.value;
            select.dispatchEvent(new Event("change", { bubbles: true }));
        }

    }, category);

    await page.waitForSelector("h3.job-internship-name");
    // await page.waitForTimeout(5000);
    // page.keyboard.press("Enter");
    // page.locator('select[name="select_category"]').selectOption({label:'Civil Engineering'});

    // await randomWait(page);

    const jobTitles = page.locator("h3.job-internship-name");
    const companies = page.locator("p.company-name");
    const locations =  page.locator(".locations span a");
    const stipends =  page.locator('.stipend');
    const durations = page.locator('.ic-16-calendar + span');
    const postedAt = page.locator('.ic-16-reschedule + span');
    const ppoStatus = page.locator('.ppo_status span span');
    const cards = page.locator('.individual_internship');
    const count = await jobTitles.count();
    console.log(count);

    const applyLinks=[];
    for (let i = 0; i < count; i++) {

        // if(randomNumber(i)%3==0) await smoothScroll(page);
        // await jobTitles.nth(i).scrollIntoViewIfNeeded();
        
        const title = await jobTitles.nth(i).textContent();
        // await randomWait(page);
        const company = await companies.nth(i).textContent();
        const location = await locations.nth(i).textContent();
        const stipend = await stipends.nth(i).textContent();
        const duration = await durations.nth(i).textContent();
        const postago = await postedAt.nth(i).textContent();
        const ppoText = await ppoStatus.nth(i).textContent();
        const ppoOffered = ppoText ? ppoText.trim() : "Not mentioned";
        const applyLink = await cards.nth(i).getAttribute("data-href");
        applyLinks.push(applyLink);

        await randomWait(page);

        console.log("Job:", title);
        console.log("Company:", company);
        console.log("Location:", location);
        console.log("Stipened:",stipend);
        console.log("Duration:",duration);
        console.log("PostedAt:",postago);
        console.log("PPO Offered upto:",ppoOffered);
        // console.log("Apply link:",applyLink);
        console.log("----------------");
    }

    for(const link of applyLinks){
        console.log(link);
    }

});