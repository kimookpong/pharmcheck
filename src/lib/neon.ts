import { createClient } from "@neondatabase/neon-js";

export const neonClient = createClient({
  auth: {
    url: import.meta.env.VITE_NEON_AUTH_URL,
  },
  dataApi: {
    url: import.meta.env.VITE_NEON_DATA_API_URL,
  },
});

export const authClient = neonClient.auth;
export const dataClient = neonClient; // Using the root client for data queries e.g. neonClient.from(...)
