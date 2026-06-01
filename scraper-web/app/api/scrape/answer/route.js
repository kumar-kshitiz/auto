import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request) {
    try {
        const { answer } = await request.json();
        
        if (!answer) {
            return NextResponse.json({ success: false, message: "Answer is required" }, { status: 400 });
        }

        const statePath = path.resolve(process.cwd(), '../scraper_state.json');
        
        fs.writeFileSync(statePath, JSON.stringify({
            status: 'answered',
            answer: answer
        }));

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
