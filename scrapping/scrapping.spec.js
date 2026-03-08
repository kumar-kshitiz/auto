import { test } from '@playwright/test';
// test.setTimeout(120000); // 2 minutes

async function randomWait(page, min = 1000, max = 3000) {
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

test('Internshala Auto Apply Bot', async ({ page }) => {

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


    await page.goto("https://internshala.com/internships/");
    await page.waitForLoadState("domcontentloaded");

    const loginBtn = page.getByText('Login / Register', { exact: true });

    if (await loginBtn.count() === 0) {
        console.log("User not logged in. Please login to Internshala first.");
        return;
    }
    console.log("User already logged in. Starting internship apply process...");

    // Continue Bot logic
    // select category
    await page.click("#select_category_chosen", { force: true });
    await page.waitForTimeout(500);
    // await page.fill("#select_category_chosen input", "Civil Engineering");
    const categoryInput = page.locator("#select_category_chosen input");
    await categoryInput.fill("Civil Engineering");
   
    page.keyboard.press("Enter");

    await randomWait(page);

    const jobTitles = page.locator("h3.job-internship-name");
    const companies = page.locator("p.company-name");

    const count = await jobTitles.count();

    for (let i = 0; i < count; i++) {

        if(randomNumber(i)%3==0) await smoothScroll(page);
        await jobTitles.nth(i).scrollIntoViewIfNeeded();
        
        const title = await jobTitles.nth(i).textContent();
        // await randomWait(page);
        const company = await companies.nth(i).textContent();
        // await randomWait(page);

        console.log("Job:", title);
        console.log("Company:", company);
        console.log("----------------");
    }

});