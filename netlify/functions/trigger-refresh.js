// OPTIONAL fallback scheduler: if you'd rather not enable pg_cron/pg_net in
// Supabase, you can use a Netlify Scheduled Function to ping the Edge Function
// instead. Netlify's free tier includes scheduled functions (cron syntax).
//
// To enable: rename this file's export config below to your desired cadence,
// and set SUPABASE_FUNCTION_URL + SUPABASE_SERVICE_ROLE_KEY as Netlify env vars
// (Site settings → Environment variables). Note: keep the service role key out
// of any VITE_-prefixed variable so it's never bundled into the frontend.

export default async () => {
  const url = process.env.SUPABASE_FUNCTION_URL // e.g. https://xxxx.functions.supabase.co/fetch-analytics
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.error('Missing SUPABASE_FUNCTION_URL or SUPABASE_SERVICE_ROLE_KEY env vars.')
    return new Response('Missing config', { status: 500 })
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
  })

  const body = await res.text()
  return new Response(body, { status: res.status })
}

export const config = {
  // Every 30 minutes. Adjust as needed — see https://docs.netlify.com/functions/scheduled-functions/
  schedule: '*/30 * * * *',
}
