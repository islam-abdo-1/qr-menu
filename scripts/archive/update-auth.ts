import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DIRECT_URL, max: 1 });

async function run() {
  const client = await pool.connect();
  try {
    // Update auth config via Supabase Management API
    const res = await fetch('https://api.supabase.com/v1/projects/chczpvevpfqiyvfwjbro/config/auth', {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        site_url: 'https://qr-menu-n4997pf58-islam230366qw-bots-projects.vercel.app',
        redirect_urls: [
          'https://qr-menu-n4997pf58-islam230366qw-bots-projects.vercel.app/auth/callback',
          'https://qr-menu-n4997pf58-islam230366qw-bots-projects.vercel.app/login',
          'https://qr-menu-n4997pf58-islam230366qw-bots-projects.vercel.app/admin',
          'http://localhost:3000/auth/callback',
          'http://localhost:3000/login',
          'http://localhost:3000/admin'
        ]
      })
    });
    
    if (res.ok) {
      console.log('✅ Supabase Auth config updated');
    } else {
      const err = await res.text();
      console.error('❌ Auth config failed:', err);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('❌ Error:', msg);
  } finally {
    await pool.end();
  }
}
run();