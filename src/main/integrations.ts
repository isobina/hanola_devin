import { ipcMain, BrowserWindow, shell } from 'electron';
import { IPC_CHANNELS, ZoomMeeting, TeamsMeeting, IntegrationStatus } from '../shared/types';
import { getSettings } from './settings';
import http from 'http';
import https from 'https';
import { URL } from 'url';

// OAuth callback server
let oauthServer: http.Server | null = null;
const OAUTH_CALLBACK_PORT = 28465;
const OAUTH_REDIRECT_URI = `http://localhost:${OAUTH_CALLBACK_PORT}/callback`;

// Polling intervals
let zoomPollInterval: ReturnType<typeof setInterval> | null = null;
let teamsPollInterval: ReturnType<typeof setInterval> | null = null;

// ============================================================
// HTTP helpers
// ============================================================

function httpsRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {}
): Promise<{ status: number; data: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => (data += chunk.toString()));
        res.on('end', () => resolve({ status: res.statusCode || 0, data }));
      }
    );
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// ============================================================
// Zoom Integration
// ============================================================

async function startZoomOAuth(_mainWindow: BrowserWindow | null): Promise<string> {
  const settings = getSettings();
  const clientId = settings.zoomClientId;
  if (!clientId) throw new Error('Zoom Client ID not configured');

  return new Promise((resolve, reject) => {
    // Start local server to receive OAuth callback
    if (oauthServer) {
      oauthServer.close();
      oauthServer = null;
    }

    oauthServer = http.createServer((req, res) => {
      const reqUrl = new URL(req.url || '/', `http://localhost:${OAUTH_CALLBACK_PORT}`);
      if (reqUrl.pathname === '/callback') {
        const code = reqUrl.searchParams.get('code');
        const error = reqUrl.searchParams.get('error');

        res.writeHead(200, { 'Content-Type': 'text/html' });
        if (code) {
          res.end('<html><body><h2>Zoom connected successfully!</h2><p>You can close this window.</p><script>window.close()</script></body></html>');
          resolve(code);
        } else {
          res.end('<html><body><h2>Connection failed</h2><p>Please try again.</p></body></html>');
          reject(new Error(error || 'OAuth failed'));
        }

        // Close server after a short delay
        setTimeout(() => {
          oauthServer?.close();
          oauthServer = null;
        }, 1000);
      }
    });

    oauthServer.listen(OAUTH_CALLBACK_PORT, () => {
      const authUrl = `https://zoom.us/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(OAUTH_REDIRECT_URI)}`;
      shell.openExternal(authUrl);
    });

    // Timeout after 2 minutes
    setTimeout(() => {
      if (oauthServer) {
        oauthServer.close();
        oauthServer = null;
        reject(new Error('OAuth timeout'));
      }
    }, 120000);
  });
}

async function exchangeZoomCode(code: string): Promise<{ access_token: string; refresh_token: string }> {
  const settings = getSettings();
  const clientId = settings.zoomClientId;
  const clientSecret = settings.zoomClientSecret;
  if (!clientId || !clientSecret) throw new Error('Zoom credentials not configured');

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: OAUTH_REDIRECT_URI,
  }).toString();

  const response = await httpsRequest('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const data = JSON.parse(response.data);
  if (data.error) throw new Error(data.error);
  return { access_token: data.access_token, refresh_token: data.refresh_token };
}

async function refreshZoomToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string }> {
  const settings = getSettings();
  const clientId = settings.zoomClientId;
  const clientSecret = settings.zoomClientSecret;
  if (!clientId || !clientSecret) throw new Error('Zoom credentials not configured');

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  }).toString();

  const response = await httpsRequest('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const data = JSON.parse(response.data);
  if (data.error) throw new Error(data.error);
  return { access_token: data.access_token, refresh_token: data.refresh_token };
}

async function getZoomCurrentMeeting(accessToken: string): Promise<ZoomMeeting | null> {
  try {
    // Get user's live meetings
    const response = await httpsRequest('https://api.zoom.us/v2/users/me/meetings?type=live', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = JSON.parse(response.data);
    if (data.meetings && data.meetings.length > 0) {
      const meeting = data.meetings[0];
      return {
        id: String(meeting.id),
        topic: meeting.topic || 'Zoom Meeting',
        startTime: meeting.start_time,
        duration: meeting.duration,
        joinUrl: meeting.join_url,
        participants: [],
      };
    }
    return null;
  } catch (_err) {
    return null;
  }
}

async function getZoomMeetingParticipants(accessToken: string, meetingId: string): Promise<string[]> {
  try {
    const response = await httpsRequest(
      `https://api.zoom.us/v2/meetings/${meetingId}/participants`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = JSON.parse(response.data);
    if (data.participants) {
      return data.participants.map((p: { name: string; email?: string }) => p.name || p.email || 'Unknown');
    }
    return [];
  } catch (_err) {
    return [];
  }
}

// ============================================================
// Teams Integration (Microsoft Graph API)
// ============================================================

async function startTeamsOAuth(_mainWindow: BrowserWindow | null): Promise<string> {
  const settings = getSettings();
  const clientId = settings.teamsClientId;
  if (!clientId) throw new Error('Teams Client ID not configured');

  return new Promise((resolve, reject) => {
    if (oauthServer) {
      oauthServer.close();
      oauthServer = null;
    }

    oauthServer = http.createServer((req, res) => {
      const reqUrl = new URL(req.url || '/', `http://localhost:${OAUTH_CALLBACK_PORT}`);
      if (reqUrl.pathname === '/callback') {
        const code = reqUrl.searchParams.get('code');
        const error = reqUrl.searchParams.get('error');

        res.writeHead(200, { 'Content-Type': 'text/html' });
        if (code) {
          res.end('<html><body><h2>Microsoft Teams connected successfully!</h2><p>You can close this window.</p><script>window.close()</script></body></html>');
          resolve(code);
        } else {
          res.end('<html><body><h2>Connection failed</h2><p>Please try again.</p></body></html>');
          reject(new Error(error || 'OAuth failed'));
        }

        setTimeout(() => {
          oauthServer?.close();
          oauthServer = null;
        }, 1000);
      }
    });

    oauthServer.listen(OAUTH_CALLBACK_PORT, () => {
      const scopes = encodeURIComponent('OnlineMeetings.Read Calendars.Read User.Read offline_access');
      const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(OAUTH_REDIRECT_URI)}&scope=${scopes}&response_mode=query`;
      shell.openExternal(authUrl);
    });

    setTimeout(() => {
      if (oauthServer) {
        oauthServer.close();
        oauthServer = null;
        reject(new Error('OAuth timeout'));
      }
    }, 120000);
  });
}

async function exchangeTeamsCode(code: string): Promise<{ access_token: string; refresh_token: string }> {
  const settings = getSettings();
  const clientId = settings.teamsClientId;
  const clientSecret = settings.teamsClientSecret;
  if (!clientId || !clientSecret) throw new Error('Teams credentials not configured');

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: OAUTH_REDIRECT_URI,
    grant_type: 'authorization_code',
    scope: 'OnlineMeetings.Read Calendars.Read User.Read offline_access',
  }).toString();

  const response = await httpsRequest('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = JSON.parse(response.data);
  if (data.error) throw new Error(data.error_description || data.error);
  return { access_token: data.access_token, refresh_token: data.refresh_token };
}

async function refreshTeamsToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string }> {
  const settings = getSettings();
  const clientId = settings.teamsClientId;
  const clientSecret = settings.teamsClientSecret;
  if (!clientId || !clientSecret) throw new Error('Teams credentials not configured');

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: 'OnlineMeetings.Read Calendars.Read User.Read offline_access',
  }).toString();

  const response = await httpsRequest('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = JSON.parse(response.data);
  if (data.error) throw new Error(data.error_description || data.error);
  return { access_token: data.access_token, refresh_token: data.refresh_token };
}

async function getTeamsCurrentMeeting(accessToken: string): Promise<TeamsMeeting | null> {
  try {
    // Check calendar events happening now for online meetings
    const now = new Date();
    const startTime = new Date(now.getTime() - 30 * 60000).toISOString(); // 30 min ago
    const endTime = new Date(now.getTime() + 30 * 60000).toISOString(); // 30 min from now

    const response = await httpsRequest(
      `https://graph.microsoft.com/v1.0/me/calendarview?startdatetime=${startTime}&enddatetime=${endTime}&$filter=isOnlineMeeting eq true&$orderby=start/dateTime`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const data = JSON.parse(response.data);
    if (data.value && data.value.length > 0) {
      const event = data.value[0];
      const attendees = (event.attendees || []).map(
        (a: { emailAddress: { name?: string; address?: string } }) =>
          a.emailAddress?.name || a.emailAddress?.address || 'Unknown'
      );

      return {
        id: event.id,
        subject: event.subject || 'Teams Meeting',
        startTime: event.start?.dateTime,
        endTime: event.end?.dateTime,
        joinUrl: event.onlineMeeting?.joinUrl || event.onlineMeetingUrl,
        organizer: event.organizer?.emailAddress?.name || event.organizer?.emailAddress?.address || '',
        attendees,
      };
    }
    return null;
  } catch (_err) {
    return null;
  }
}

async function getTeamsOnlineParticipants(accessToken: string, meetingId: string): Promise<string[]> {
  try {
    const response = await httpsRequest(
      `https://graph.microsoft.com/v1.0/me/onlineMeetings/${meetingId}/attendanceReports`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = JSON.parse(response.data);
    if (data.value && data.value.length > 0) {
      const reportId = data.value[0].id;
      const recordsResponse = await httpsRequest(
        `https://graph.microsoft.com/v1.0/me/onlineMeetings/${meetingId}/attendanceReports/${reportId}/attendanceRecords`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const recordsData = JSON.parse(recordsResponse.data);
      if (recordsData.value) {
        return recordsData.value.map(
          (r: { identity: { displayName?: string }; emailAddress?: string }) =>
            r.identity?.displayName || r.emailAddress || 'Unknown'
        );
      }
    }
    return [];
  } catch (_err) {
    return [];
  }
}

// ============================================================
// Token storage (in-memory, backed by electron-store via settings)
// ============================================================

interface TokenStore {
  zoom: { accessToken: string; refreshToken: string } | null;
  teams: { accessToken: string; refreshToken: string } | null;
}

const tokenStore: TokenStore = {
  zoom: null,
  teams: null,
};

// ============================================================
// IPC Handler Setup
// ============================================================

export function setupIntegrationHandlers(mainWindow: BrowserWindow | null) {
  // --- Zoom ---
  ipcMain.handle(IPC_CHANNELS.ZOOM_CONNECT, async () => {
    try {
      const code = await startZoomOAuth(mainWindow);
      const tokens = await exchangeZoomCode(code);
      tokenStore.zoom = { accessToken: tokens.access_token, refreshToken: tokens.refresh_token };
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.ZOOM_DISCONNECT, () => {
    tokenStore.zoom = null;
    stopZoomPolling();
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.ZOOM_GET_STATUS, (): IntegrationStatus => {
    return {
      connected: tokenStore.zoom !== null,
      provider: 'zoom',
    };
  });

  ipcMain.handle(IPC_CHANNELS.ZOOM_GET_CURRENT_MEETING, async () => {
    if (!tokenStore.zoom) return null;
    try {
      const meeting = await getZoomCurrentMeeting(tokenStore.zoom.accessToken);
      if (meeting) {
        const participants = await getZoomMeetingParticipants(tokenStore.zoom.accessToken, meeting.id);
        meeting.participants = participants;
      }
      return meeting;
    } catch (_err) {
      // Try refreshing token
      try {
        if (tokenStore.zoom) {
          const newTokens = await refreshZoomToken(tokenStore.zoom.refreshToken);
          tokenStore.zoom = { accessToken: newTokens.access_token, refreshToken: newTokens.refresh_token };
          return await getZoomCurrentMeeting(tokenStore.zoom.accessToken);
        }
      } catch (_refreshErr) {
        tokenStore.zoom = null;
      }
      return null;
    }
  });

  // --- Teams ---
  ipcMain.handle(IPC_CHANNELS.TEAMS_CONNECT, async () => {
    try {
      const code = await startTeamsOAuth(mainWindow);
      const tokens = await exchangeTeamsCode(code);
      tokenStore.teams = { accessToken: tokens.access_token, refreshToken: tokens.refresh_token };
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.TEAMS_DISCONNECT, () => {
    tokenStore.teams = null;
    stopTeamsPolling();
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.TEAMS_GET_STATUS, (): IntegrationStatus => {
    return {
      connected: tokenStore.teams !== null,
      provider: 'teams',
    };
  });

  ipcMain.handle(IPC_CHANNELS.TEAMS_GET_CURRENT_MEETING, async () => {
    if (!tokenStore.teams) return null;
    try {
      const meeting = await getTeamsCurrentMeeting(tokenStore.teams.accessToken);
      if (meeting) {
        const participants = await getTeamsOnlineParticipants(tokenStore.teams.accessToken, meeting.id);
        if (participants.length > 0) {
          meeting.attendees = participants;
        }
      }
      return meeting;
    } catch (_err) {
      // Try refreshing token
      try {
        if (tokenStore.teams) {
          const newTokens = await refreshTeamsToken(tokenStore.teams.refreshToken);
          tokenStore.teams = { accessToken: newTokens.access_token, refreshToken: newTokens.refresh_token };
          return await getTeamsCurrentMeeting(tokenStore.teams.accessToken);
        }
      } catch (_refreshErr) {
        tokenStore.teams = null;
      }
      return null;
    }
  });

  // --- Meeting Detection Polling ---
  ipcMain.handle(IPC_CHANNELS.INTEGRATION_START_POLLING, (_event, provider: 'zoom' | 'teams') => {
    if (provider === 'zoom') {
      startZoomPolling(mainWindow);
    } else {
      startTeamsPolling(mainWindow);
    }
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.INTEGRATION_STOP_POLLING, (_event, provider: 'zoom' | 'teams') => {
    if (provider === 'zoom') {
      stopZoomPolling();
    } else {
      stopTeamsPolling();
    }
    return { success: true };
  });
}

// ============================================================
// Meeting detection polling
// ============================================================

function startZoomPolling(mainWindow: BrowserWindow | null) {
  stopZoomPolling();
  zoomPollInterval = setInterval(async () => {
    if (!tokenStore.zoom || !mainWindow) return;
    try {
      const meeting = await getZoomCurrentMeeting(tokenStore.zoom.accessToken);
      if (meeting) {
        const participants = await getZoomMeetingParticipants(tokenStore.zoom.accessToken, meeting.id);
        meeting.participants = participants;
        mainWindow.webContents.send(IPC_CHANNELS.INTEGRATION_MEETING_DETECTED, {
          provider: 'zoom',
          meeting,
        });
      }
    } catch (_err) {
      // Silently ignore polling errors
    }
  }, 30000); // Poll every 30 seconds
}

function stopZoomPolling() {
  if (zoomPollInterval) {
    clearInterval(zoomPollInterval);
    zoomPollInterval = null;
  }
}

function startTeamsPolling(mainWindow: BrowserWindow | null) {
  stopTeamsPolling();
  teamsPollInterval = setInterval(async () => {
    if (!tokenStore.teams || !mainWindow) return;
    try {
      const meeting = await getTeamsCurrentMeeting(tokenStore.teams.accessToken);
      if (meeting) {
        mainWindow.webContents.send(IPC_CHANNELS.INTEGRATION_MEETING_DETECTED, {
          provider: 'teams',
          meeting,
        });
      }
    } catch (_err) {
      // Silently ignore polling errors
    }
  }, 30000); // Poll every 30 seconds
}

function stopTeamsPolling() {
  if (teamsPollInterval) {
    clearInterval(teamsPollInterval);
    teamsPollInterval = null;
  }
}
