// Backend URL configuration
// Reads from VITE_BACKEND_URL in dashboard/.env, defaulting to local backend
export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
