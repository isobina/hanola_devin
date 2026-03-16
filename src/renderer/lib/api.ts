// Wrapper around electron API for use in renderer
// Falls back to mock data when not running in Electron (e.g., during development in browser)

import type { Meeting, Note, ChatMessage, Template, AppSettings, IntegrationStatus, ZoomMeeting, TeamsMeeting } from '../../shared/types';

const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;

// In-memory mock store for browser development
const mockStore: {
  meetings: Meeting[];
  notes: Record<string, Note>;
  chatMessages: Record<string, ChatMessage[]>;
  templates: Template[];
  settings: AppSettings;
} = {
  meetings: [],
  notes: {},
  chatMessages: {},
  templates: [
    { id: '1', name: 'Default', sections: ['Summary', 'Key Points', 'Action Items', 'Notes'], is_default: true, created_at: new Date().toISOString() },
    { id: '2', name: 'Customer Discovery', sections: ['About Them', 'Key Takeaways', 'Decision-Making Insights', 'Budget & Timeline', 'Next Steps'], is_default: true, created_at: new Date().toISOString() },
    { id: '3', name: '1-on-1', sections: ['Check-in', 'Discussion Points', 'Action Items', 'Feedback'], is_default: true, created_at: new Date().toISOString() },
    { id: '4', name: 'User Interview', sections: ['Background', 'Tasks Observed', 'Key Quotes', 'Insights', 'Follow-ups'], is_default: true, created_at: new Date().toISOString() },
    { id: '5', name: 'Standup', sections: ['Yesterday', 'Today', 'Blockers'], is_default: true, created_at: new Date().toISOString() },
    { id: '6', name: 'Pitch', sections: ['Company Overview', 'Problem/Solution', 'Traction', 'Ask', 'Questions Asked'], is_default: true, created_at: new Date().toISOString() },
  ],
  settings: {
    openaiApiKey: '',
    anthropicApiKey: '',
    geminiApiKey: '',
    defaultTemplateId: null,
    audioInputDevice: null,
    theme: 'system',
    zoomClientId: '',
    zoomClientSecret: '',
    teamsClientId: '',
    teamsClientSecret: '',
  },
};

let mockIdCounter = 100;
function mockId(): string {
  return `mock-${++mockIdCounter}`;
}

export const api = {
  // Meetings
  getMeetings: async (search?: string): Promise<Meeting[]> => {
    if (isElectron) return window.electronAPI.getMeetings(search);
    let meetings = [...mockStore.meetings];
    if (search) {
      const term = search.toLowerCase();
      meetings = meetings.filter(m =>
        m.title.toLowerCase().includes(term) ||
        m.attendees.some(a => a.toLowerCase().includes(term)) ||
        m.tags.some(t => t.toLowerCase().includes(term))
      );
    }
    return meetings.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  getMeeting: async (id: string): Promise<Meeting | null> => {
    if (isElectron) return window.electronAPI.getMeeting(id);
    return mockStore.meetings.find(m => m.id === id) || null;
  },

  createMeeting: async (data: { title: string; template_id?: string; attendees?: string[]; tags?: string[] }): Promise<Meeting> => {
    if (isElectron) return window.electronAPI.createMeeting(data);
    const meeting: Meeting = {
      id: mockId(),
      title: data.title,
      created_at: new Date().toISOString(),
      ended_at: null,
      duration_seconds: null,
      attendees: data.attendees || [],
      template_id: data.template_id || null,
      tags: data.tags || [],
    };
    mockStore.meetings.unshift(meeting);
    mockStore.notes[meeting.id] = {
      id: mockId(),
      meeting_id: meeting.id,
      raw_content: '',
      enhanced_content: '',
      transcript: '',
      created_at: meeting.created_at,
      updated_at: meeting.created_at,
    };
    return meeting;
  },

  updateMeeting: async (id: string, data: Record<string, unknown>): Promise<Meeting | null> => {
    if (isElectron) return window.electronAPI.updateMeeting(id, data);
    const idx = mockStore.meetings.findIndex(m => m.id === id);
    if (idx === -1) return null;
    mockStore.meetings[idx] = { ...mockStore.meetings[idx], ...data } as Meeting;
    return mockStore.meetings[idx];
  },

  deleteMeeting: async (id: string): Promise<void> => {
    if (isElectron) return window.electronAPI.deleteMeeting(id);
    mockStore.meetings = mockStore.meetings.filter(m => m.id !== id);
    delete mockStore.notes[id];
    delete mockStore.chatMessages[id];
  },

  // Notes
  getNote: async (meetingId: string): Promise<Note | null> => {
    if (isElectron) return window.electronAPI.getNote(meetingId);
    return mockStore.notes[meetingId] || null;
  },

  saveNote: async (meetingId: string, data: { raw_content?: string; enhanced_content?: string; transcript?: string }): Promise<Note | null> => {
    if (isElectron) return window.electronAPI.saveNote(meetingId, data);
    if (!mockStore.notes[meetingId]) {
      mockStore.notes[meetingId] = {
        id: mockId(),
        meeting_id: meetingId,
        raw_content: '',
        enhanced_content: '',
        transcript: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    mockStore.notes[meetingId] = {
      ...mockStore.notes[meetingId],
      ...data,
      updated_at: new Date().toISOString(),
    };
    return mockStore.notes[meetingId];
  },

  // Chat
  getChatMessages: async (meetingId: string): Promise<ChatMessage[]> => {
    if (isElectron) return window.electronAPI.getChatMessages(meetingId);
    return mockStore.chatMessages[meetingId] || [];
  },

  saveChatMessage: async (meetingId: string, role: string, content: string): Promise<ChatMessage> => {
    if (isElectron) return window.electronAPI.saveChatMessage(meetingId, role, content);
    const msg: ChatMessage = {
      id: mockId(),
      meeting_id: meetingId,
      role: role as 'user' | 'assistant',
      content,
      created_at: new Date().toISOString(),
    };
    if (!mockStore.chatMessages[meetingId]) mockStore.chatMessages[meetingId] = [];
    mockStore.chatMessages[meetingId].push(msg);
    return msg;
  },

  // Templates
  getTemplates: async (): Promise<Template[]> => {
    if (isElectron) return window.electronAPI.getTemplates();
    return mockStore.templates;
  },

  saveTemplate: async (template: { id?: string; name: string; sections: string[]; is_default?: boolean }): Promise<Template> => {
    if (isElectron) return window.electronAPI.saveTemplate(template);
    if (template.id) {
      const idx = mockStore.templates.findIndex(t => t.id === template.id);
      if (idx !== -1) {
        mockStore.templates[idx] = { ...mockStore.templates[idx], ...template } as Template;
        return mockStore.templates[idx];
      }
    }
    const t: Template = {
      id: mockId(),
      name: template.name,
      sections: template.sections,
      is_default: false,
      created_at: new Date().toISOString(),
    };
    mockStore.templates.push(t);
    return t;
  },

  deleteTemplate: async (id: string): Promise<void> => {
    if (isElectron) return window.electronAPI.deleteTemplate(id);
    mockStore.templates = mockStore.templates.filter(t => t.id !== id);
  },

  // Audio
  startRecording: async (deviceId?: string): Promise<{ audioPath: string }> => {
    if (isElectron) return window.electronAPI.startRecording(deviceId);
    return { audioPath: '/tmp/mock-recording.webm' };
  },

  stopRecording: async (): Promise<{ audioPath: string | null; duration: number }> => {
    if (isElectron) return window.electronAPI.stopRecording();
    return { audioPath: null, duration: 0 };
  },

  getAudioDevices: async (): Promise<MediaDeviceInfo[]> => {
    if (isElectron) return window.electronAPI.getAudioDevices();
    return [];
  },

  // AI
  transcribe: async (audioPath: string): Promise<string> => {
    if (isElectron) return window.electronAPI.transcribe(audioPath);
    return 'Mock transcript: This is a simulated meeting transcript for development purposes.';
  },

  enhanceNotes: async (rawNotes: string, transcript: string, templateSections?: string[]): Promise<string> => {
    if (isElectron) return window.electronAPI.enhanceNotes(rawNotes, transcript, templateSections);
    return `# Enhanced Meeting Notes\n\n## Summary\n${rawNotes || 'No notes taken'}\n\n## Transcript Summary\n${transcript || 'No transcript available'}`;
  },

  chat: async (meetingId: string, message: string, context: { transcript: string; enhancedNotes: string }): Promise<string> => {
    if (isElectron) return window.electronAPI.chat(meetingId, message, context);
    return `Mock AI response to: "${message}"`;
  },

  generateTitle: async (transcript: string): Promise<string> => {
    if (isElectron) return window.electronAPI.generateTitle(transcript);
    return 'Mock Meeting Title';
  },

  draftEmail: async (notes: string, transcript: string): Promise<string> => {
    if (isElectron) return window.electronAPI.draftEmail(notes, transcript);
    return `Subject: Follow-up from our meeting\n\nHi team,\n\nThank you for the meeting. Here are the key points:\n\n${notes}\n\nBest regards`;
  },

  // Settings
  getSettings: async (): Promise<AppSettings> => {
    if (isElectron) return window.electronAPI.getSettings();
    return mockStore.settings;
  },

  setSettings: async (settings: Partial<AppSettings>): Promise<AppSettings> => {
    if (isElectron) return window.electronAPI.setSettings(settings);
    mockStore.settings = { ...mockStore.settings, ...settings };
    return mockStore.settings;
  },

  // Export
  exportFile: async (content: string, defaultName: string): Promise<string | null> => {
    if (isElectron) return window.electronAPI.exportFile(content, defaultName);
    // In browser, trigger download
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultName;
    a.click();
    URL.revokeObjectURL(url);
    return defaultName;
  },

  // Event listeners
  onAudioStatus: (callback: (status: { isRecording: boolean; duration: number }) => void): (() => void) => {
    if (isElectron) return window.electronAPI.onAudioStatus(callback);
    return () => {};
  },

  onAIStreamChunk: (callback: (chunk: string) => void): (() => void) => {
    if (isElectron) return window.electronAPI.onAIStreamChunk(callback);
    return () => {};
  },

  onAIStreamDone: (callback: () => void): (() => void) => {
    if (isElectron) return window.electronAPI.onAIStreamDone(callback);
    return () => {};
  },

  // Zoom Integration
  zoomConnect: async (): Promise<{ success: boolean; error?: string }> => {
    if (isElectron) return window.electronAPI.zoomConnect();
    return { success: true };
  },

  zoomDisconnect: async (): Promise<{ success: boolean }> => {
    if (isElectron) return window.electronAPI.zoomDisconnect();
    return { success: true };
  },

  zoomGetStatus: async (): Promise<IntegrationStatus> => {
    if (isElectron) return window.electronAPI.zoomGetStatus();
    return { connected: false, provider: 'zoom' };
  },

  zoomGetCurrentMeeting: async (): Promise<ZoomMeeting | null> => {
    if (isElectron) return window.electronAPI.zoomGetCurrentMeeting();
    return null;
  },

  // Teams Integration
  teamsConnect: async (): Promise<{ success: boolean; error?: string }> => {
    if (isElectron) return window.electronAPI.teamsConnect();
    return { success: true };
  },

  teamsDisconnect: async (): Promise<{ success: boolean }> => {
    if (isElectron) return window.electronAPI.teamsDisconnect();
    return { success: true };
  },

  teamsGetStatus: async (): Promise<IntegrationStatus> => {
    if (isElectron) return window.electronAPI.teamsGetStatus();
    return { connected: false, provider: 'teams' };
  },

  teamsGetCurrentMeeting: async (): Promise<TeamsMeeting | null> => {
    if (isElectron) return window.electronAPI.teamsGetCurrentMeeting();
    return null;
  },

  // Integration polling
  integrationStartPolling: async (provider: 'zoom' | 'teams'): Promise<{ success: boolean }> => {
    if (isElectron) return window.electronAPI.integrationStartPolling(provider);
    return { success: true };
  },

  integrationStopPolling: async (provider: 'zoom' | 'teams'): Promise<{ success: boolean }> => {
    if (isElectron) return window.electronAPI.integrationStopPolling(provider);
    return { success: true };
  },

  onMeetingDetected: (callback: (data: { provider: string; meeting: unknown }) => void): (() => void) => {
    if (isElectron) return window.electronAPI.onMeetingDetected(callback);
    return () => {};
  },
};
