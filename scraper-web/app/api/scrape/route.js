import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export async function POST(request) {
    try {
        const { category } = await request.json();
        
        if (!category) {
            return NextResponse.json({ success: false, message: "Category is required" }, { status: 400 });
        }

        console.log(`Starting scrape for category: ${category}`);

        // Run the scraper in the parent directory context to ensure relative paths 
        // (like ./chrome-profile) resolve correctly.
        const parentDir = path.resolve(process.cwd(), '..');
        
        const script = `
            import('./scrapping.js').then(m => {
                m.runScraper('${category}').catch(console.error);
            }).catch(console.error);
        `;

        exec(`node --input-type=module -e "${script.replace(/"/g, '\\"')}"`, { cwd: parentDir }, (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                return;
            }
            if (stderr) console.error(`stderr: ${stderr}`);
            if (stdout) console.log(`stdout: ${stdout}`);
        });

        return NextResponse.json({ success: true, message: `Scraping started for category: ${category}. Check terminal for logs.` });
    } catch (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
