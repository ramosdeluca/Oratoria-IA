import { createClient } from '@supabase/supabase-js';
const supabaseUrl = (process.env.SUPABASE_URL || 'https://bcsbtlhgxquowocqmwfw.supabase.co').trim();
const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjc2J0bGhneHF1b3dvY3Ftd2Z3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NTE2MTIsImV4cCI6MjA4ODAyNzYxMn0.9W0dNXXQKyVXI6njQcb0Wza0nsq2OgFq-WIUtavcvho').trim();

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
    console.log("Testing courses load...");
    const { data, error } = await supabase.from('courses').select('*, course_modules(*, lessons(*))');
    console.log("Data:", JSON.stringify(data, null, 2));
    if (error) console.log("Error:", error);
}

test();
