const url = 'https://bcsbtlhgxquowocqmwfw.supabase.co/rest/v1/';
const apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjc2J0bGhneHF1b3dvY3Ftd2Z3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NTE2MTIsImV4cCI6MjA4ODAyNzYxMn0.9W0dNXXQKyVXI6njQcb0Wza0nsq2OgFq-WIUtavcvho';

async function test() {
    console.log("Fetching OpenAPI spec...");
    try {
        const res = await fetch(url, {
            headers: {
                'apikey': apikey,
                'Authorization': `Bearer ${apikey}`
            }
        });
        const json = await res.json();
        console.log("Tables exposed:");
        console.log(Object.keys(json.definitions || {}));
    } catch (e) {
        console.error(e);
    }
}

test();
