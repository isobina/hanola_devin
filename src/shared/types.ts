export interface Meeting {
  id: string;
  title: string;
  created_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  attendees: string[];
  template_id: string | null;
  tags: string[];
}

export interface Note {
  id: string;
  meeting_id: string;
  raw_content: string;
  enhanced_content: string;
  transcript: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  meeting_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface Template {
  id: string;
  name: string;
  sections: string[];
  is_default: boolean;
  created_at: string;
}

export interface AppSettings {
  openaiApiKey: string;
  anthropicApiKey: string;
  geminiApiKey: string;
  defaultTemplateId: string | null;
  audioInputDevice: string | null;
  theme: 'light' | 'dark' | 'system';
  // Zoom integration
  zoomClientId: string;
  zoomClientSecret: string;
  // Teams integration
  teamsClientId: string;
  teamsClientSecret: string;
}

export interface ZoomMeeting {
  id: string;
  topic: string;
  startTime: string;
  duration: number;
  joinUrl: string;
  participants: string[];
}

export interface TeamsMeeting {
  id: string;
  subject: string;
  startTime: string;
  endTime: string;
  joinUrl: string;
  organizer: string;
  attendees: string[];
}

export interface IntegrationStatus {
  connected: boolean;
  provider: 'zoom' | 'teams';
}

export interface DetectedMeeting {
  provider: 'zoom' | 'teams';
  meeting: ZoomMeeting | TeamsMeeting;
}

export interface RecordingStatus {
  isRecording: boolean;
  duration: number;
  transcriptionStatus: 'idle' | 'recording' | 'transcribing' | 'done' | 'error';
}

// IPC Channel names
export const IPC_CHANNELS = {
  // Database
  DB_GET_MEETINGS: 'db:get-meetings',
  DB_GET_MEETING: 'db:get-meeting',
  DB_CREATE_MEETING: 'db:create-meeting',
  DB_UPDATE_MEETING: 'db:update-meeting',
  DB_DELETE_MEETING: 'db:delete-meeting',
  DB_GET_NOTE: 'db:get-note',
  DB_SAVE_NOTE: 'db:save-note',
  DB_GET_CHAT_MESSAGES: 'db:get-chat-messages',
  DB_SAVE_CHAT_MESSAGE: 'db:save-chat-message',
  DB_GET_TEMPLATES: 'db:get-templates',
  DB_SAVE_TEMPLATE: 'db:save-template',
  DB_DELETE_TEMPLATE: 'db:delete-template',

  // Audio
  AUDIO_START_RECORDING: 'audio:start-recording',
  AUDIO_STOP_RECORDING: 'audio:stop-recording',
  AUDIO_GET_DEVICES: 'audio:get-devices',
  AUDIO_STATUS: 'audio:status',

  // AI
  AI_TRANSCRIBE: 'ai:transcribe',
  AI_ENHANCE_NOTES: 'ai:enhance-notes',
  AI_CHAT: 'ai:chat',
  AI_GENERATE_TITLE: 'ai:generate-title',
  AI_DRAFT_EMAIL: 'ai:draft-email',
  AI_STREAM_CHUNK: 'ai:stream-chunk',
  AI_STREAM_DONE: 'ai:stream-done',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Export
  EXPORT_FILE: 'export:file',

  // Zoom Integration
  ZOOM_CONNECT: 'zoom:connect',
  ZOOM_DISCONNECT: 'zoom:disconnect',
  ZOOM_GET_STATUS: 'zoom:get-status',
  ZOOM_GET_CURRENT_MEETING: 'zoom:get-current-meeting',

  // Teams Integration
  TEAMS_CONNECT: 'teams:connect',
  TEAMS_DISCONNECT: 'teams:disconnect',
  TEAMS_GET_STATUS: 'teams:get-status',
  TEAMS_GET_CURRENT_MEETING: 'teams:get-current-meeting',

  // Integration polling
  INTEGRATION_START_POLLING: 'integration:start-polling',
  INTEGRATION_STOP_POLLING: 'integration:stop-polling',
  INTEGRATION_MEETING_DETECTED: 'integration:meeting-detected',
} as const;
