import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bcsbtlhgxquowocqmwfw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjc2J0bGhneHF1b3dvY3Ftd2Z3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NTE2MTIsImV4cCI6MjA4ODAyNzYxMn0.9W0dNXXQKyVXI6njQcb0Wza0nsq2OgFq-WIUtavcvho';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
    console.log("Testing profile load...");
    // Let's get any users from Auth

    // Actually, we can't access Auth without admin key, but we can try to select from profiles
    const { data, error } = await supabase.from('profiles').select('*').limit(5);
    console.log("Profiles Data:", data);
    console.log("Profiles Error:", error);

    // Check if avatar_id exists by making an update on a non-existent row
    const { error: updateError } = await supabase.from('profiles').update({ avatar_id: '123' }).eq('id', 'non-existent-id');
    console.log("Update Error (checking column):", updateError);
}

test();
