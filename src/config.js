// Backend URL configuration
// 1. Uses VITE_BACKEND_URL environment variable if set (e.g. in Vercel project settings or .env)
// 2. In production builds (import.meta.env.PROD), defaults to your live Render backend URL
// 3. In local development builds, defaults to http://localhost:8000
export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.PROD
    ? 'https://iot-backend-43ao.onrender.com'
    : 'http://localhost:8000');
