import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy_key';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(req: Request) {
    const { data: attempts } = await supabaseAdmin.from('quiz_attempts').select('*').order('created_at', { ascending: false }).limit(20);
    const { data: missions } = await supabaseAdmin.from('user_missions').select('*').eq('email', 'vuglavukpjescic@gmail.com');
    return NextResponse.json({
        attempts,
        missions
    });
}
