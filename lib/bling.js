/**
 * Bling API v3 Client
 * 
 * Handles OAuth token management and API requests.
 * Tokens are stored in memory (server-side) - for production,
 * consider using a database or Redis.
 */

const BLING_API_BASE = 'https://www.bling.com.br/Api/v3';
const BLING_OAUTH_TOKEN = 'https://www.bling.com.br/Api/v3/oauth/token';

// In-memory token store (works for single-instance deployments on Vercel)
// For production with multiple instances, use a database
let tokenStore = {
  access_token: null,
  refresh_token: null,
  expires_at: null,
};

/**
 * Initialize tokens from environment or stored values
 */
export function initTokens({ access_token, refresh_token }) {
  tokenStore.access_token = access_token;
  tokenStore.refresh_token = refresh_token;
  tokenStore.expires_at = Date.now() + 6 * 60 * 60 * 1000; // 6 hours default
}

/**
 * Get the OAuth authorization URL to start the auth flow
 */
export function getAuthUrl() {
  const clientId = process.env.BLING_CLIENT_ID;
  const redirectUri = process.env.BLING_REDIRECT_URI;
  const state = Math.random().toString(36).substring(7);
  
  return `https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=${clientId}&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCode(code) {
  const clientId = process.env.BLING_CLIENT_ID;
  const clientSecret = process.env.BLING_CLIENT_SECRET;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(BLING_OAUTH_TOKEN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await res.json();
  tokenStore.access_token = data.access_token;
  tokenStore.refresh_token = data.refresh_token;
  tokenStore.expires_at = Date.now() + (data.expires_in * 1000);
  
  return data;
}

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken() {
  const clientId = process.env.BLING_CLIENT_ID;
  const clientSecret = process.env.BLING_CLIENT_SECRET;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(BLING_OAUTH_TOKEN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenStore.refresh_token,
    }),
  });

  if (!res.ok) {
    throw new Error('Token refresh failed - re-authorization required');
  }

  const data = await res.json();
  tokenStore.access_token = data.access_token;
  tokenStore.refresh_token = data.refresh_token;
  tokenStore.expires_at = Date.now() + (data.expires_in * 1000);
  
  return data;
}

/**
 * Get a valid access token, refreshing if needed
 */
async function getValidToken() {
  // If we have stored env tokens and no runtime tokens, use env
  if (!tokenStore.access_token && process.env.BLING_ACCESS_TOKEN) {
    tokenStore.access_token = process.env.BLING_ACCESS_TOKEN;
    tokenStore.refresh_token = process.env.BLING_REFRESH_TOKEN;
    tokenStore.expires_at = Date.now() + 6 * 60 * 60 * 1000;
  }

  // Check if token is expired or about to expire (5 min buffer)
  if (tokenStore.expires_at && Date.now() > tokenStore.expires_at - 300000) {
    if (tokenStore.refresh_token) {
      await refreshAccessToken();
    } else {
      throw new Error('No refresh token available - re-authorization required');
    }
  }

  if (!tokenStore.access_token) {
    throw new Error('Not authenticated. Visit /api/auth/login to connect your Bling account.');
  }

  return tokenStore.access_token;
}

/**
 * Make an authenticated request to the Bling API
 */
export async function blingFetch(endpoint, options = {}) {
  const token = await getValidToken();
  
  const res = await fetch(`${BLING_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 401) {
    // Token expired, try refresh
    try {
      await refreshAccessToken();
      const newToken = tokenStore.access_token;
      const retryRes = await fetch(`${BLING_API_BASE}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${newToken}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
      return retryRes.json();
    } catch {
      throw new Error('Session expired - re-authorization required');
    }
  }

  return res.json();
}

/**
 * Fetch all pages of a paginated endpoint
 */
export async function blingFetchAll(endpoint, params = {}) {
  let page = 1;
  let allData = [];
  let hasMore = true;

  while (hasMore) {
    const queryParams = new URLSearchParams({ ...params, pagina: page, limite: 100 });
    const data = await blingFetch(`${endpoint}?${queryParams}`);
    
    if (data.data && data.data.length > 0) {
      allData = [...allData, ...data.data];
      page++;
      // Bling returns empty array when no more pages
      if (data.data.length < 100) hasMore = false;
    } else {
      hasMore = false;
    }
  }

  return allData;
}

export function isAuthenticated() {
  return !!(tokenStore.access_token || process.env.BLING_ACCESS_TOKEN);
}
