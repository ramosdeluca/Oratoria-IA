import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bcsbtlhgxquowocqmwfw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjc2J0bGhneHF1b3dvY3Ftd2Z3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NTE2MTIsImV4cCI6MjA4ODAyNzYxMn0.9W0dNXXQKyVXI6njQcb0Wza0nsq2OgFq-WIUtavcvho';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
    console.log("Creating dummy user...");
    const email = `test-${Date.now()}@oratoriaia.com`;
    const password = "password123";

    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                username: `testuser${Date.now()}`,
                name: "Test",
                surname: "User",
                cpf: "12345678901",
            }
        }
    });

    if (authError) {
        console.error("Auth Error:", authError);
        return;
    }

    console.log("User created:", authData.user?.id);

    // Wait a second for trigger
    await new Promise(r => setTimeout(r, 2000));

    console.log("Fetching profile...");
    const { data, error } = await supabase.from('profiles').select('*').eq('id', authData.user?.id).single();
    console.log("Profile Data:", data);
    console.log("Profile Error:", error);
}

test();
