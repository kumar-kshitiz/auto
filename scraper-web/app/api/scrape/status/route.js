import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const statePath = path.resolve(process.cwd(), '../scraper_state.json');
        
        if (!fs.existsSync(statePath)) {
            return NextResponse.json({ status: 'not_running' });
        }

        const stateData = fs.readFileSync(statePath, 'utf8');
        const state = JSON.parse(stateData);

        return NextResponse.json(state);
    } catch (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
