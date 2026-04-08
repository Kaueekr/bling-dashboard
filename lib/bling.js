/**
 * Bling API v3 Client
 * Tokens stored in HTTP-only cookies for Vercel serverless compatibility.
 */

const BLING_API_BASE = 'https://www.bling.com.br/Api/v3';
const BLING_OAUTH_TOKEN = 'https://www.bling.com.br/Api/v3/oauth/token';
const COOKIE_NAME = 'bling_tokens';

/**
 * Get the OAuth authorization URL
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

  return res.json();
}

/**
 * Refresh the access token
 */
export async function refreshAccessToken(refreshToken) {
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
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    throw new Error('Token refresh failed');
  }

  return res.json();
}

/**
 * Parse tokens from cookie
 */
export function getTokensFromCookies(cookieHeader) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

/**
 * Create Set-Cookie header value
 */
export function createTokenCookie(tokens) {
  const value = encodeURIComponent(JSON.stringify({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + (tokens.expires_in || 21600) * 1000,
  }));
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`;
}

/**
 * Create cookie to delete tokens (logout)
 */
export function deleteTokenCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

/**
 * Make an authenticated request to the Bling API
 */
export async function blingFetch(endpoint, tokens, options = {}) {
  let { access_token, refresh_token, expires_at } = tokens;
  let newTokens = null;

  // Refresh if expired
  if (expires_at && Date.now() > expires_at - 300000) {
    try {
      const refreshed = await refreshAccessToken(refresh_token);
      access_token = refreshed.access_token;
      newTokens = refreshed;
    } catch {
      throw new Error('Session expired - please reconnect');
    }
  }

  const res = await fetch(`${BLING_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  // If 401, try refresh once
  if (res.status === 401 && refresh_token) {
    try {
      const refreshed = await refreshAccessToken(refresh_token);
      access_token = refreshed.access_token;
      newTokens = refreshed;

      const retryRes = await fetch(`${BLING_API_BASE}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      const data = await retryRes.json();
      return { data, newTokens };
    } catch {
      throw new Error('Session expired - please reconnect');
    }
  }

  const data = await res.json();
  return { data, newTokens };
}
