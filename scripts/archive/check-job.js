require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch').default;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email: 'test@qr-menu.dev', password: 'TestPassword123!' });
    if (error) console.error('Sign in error:', error.message);
    const session = data?.session;
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const domain = baseUrl.split('//')[1].split('.')[0];
    const cookie = `sb-${domain}-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}`;

    const res = await fetch('http://localhost:3000/api/ai-menu/jobs', { headers: { 'Cookie': cookie } });
    const jobs = await res.json();
    console.log('Total jobs:', jobs.total || 0);
    if (jobs.jobs && jobs.jobs.length > 0) {
      const latest = jobs.jobs[0];
      console.log('Latest job:', latest.id, latest.status, latest.provider);
    } else {
      console.log('No jobs found');
    }
  } catch (e) {
    console.error('Script error:', e.message);
  }
})();