"use server";

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function submitFeatureRequest(content: string, userId?: string) {
    if (!content || content.trim().length === 0) {
        return { success: false, message: "Request cannot be empty." };
    }

    const { error } = await supabase
        .from('feature_requests')
        .insert([{ content, user_id: userId }]);

    if (error) {
        console.error("Feature Request Error:", error);
        return { success: false, message: "Failed to submit request." };
    }

    return { success: true, message: "Request received. Thank you!" };
}
