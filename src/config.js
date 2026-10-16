// Base path configuration loaded strictly from .env (VITE_BASE_PATH)
let rawBase = import.meta.env.VITE_BASE_PATH || import.meta.env.BASE_URL || '/';
if (!rawBase.startsWith('/')) rawBase = '/' + rawBase;
if (!rawBase.endsWith('/')) rawBase = rawBase + '/';
export const BASE_PATH = rawBase;


// Backend URL configuration
// 1. Uses VITE_BACKEND_URL environment variable if set (e.g. in Vercel project settings or .env)
// 2. In production builds (import.meta.env.PROD), defaults to your live Render backend URL
// 3. In local development builds, defaults to http://localhost:8000
export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.PROD
    ? 'https://iot-backend-43ao.onrender.com'
    : 'http://localhost:8000');

