import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/types';

const electronAPI = {
  // Database - Meetings
  getMeetings: (search?: string) => ipcRenderer.invoke(IPC_CHANNELS.DB_GET_MEETINGS, search),
  getMeeting: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DB_GET_MEETING, id),
  createMeeting: (data: { title: string; template_id?: string; attendees?: string[]; tags?: string[] }) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_CREATE_MEETING, data),
  updateMeeting: (id: string, data: Record<string, unknown>) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_UPDATE_MEETING, id, data),
  deleteMeeting: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DB_DELETE_MEETING, id),

  // Database - Notes
  getNote: (meetingId: string) => ipcRenderer.invoke(IPC_CHANNELS.DB_GET_NOTE, meetingId),
  saveNote: (meetingId: string, data: { raw_content?: string; enhanced_content?: string; transcript?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_SAVE_NOTE, meetingId, data),

  // Database - Chat
  getChatMessages: (meetingId: string) => ipcRenderer.invoke(IPC_CHANNELS.DB_GET_CHAT_MESSAGES, meetingId),
  saveChatMessage: (meetingId: string, role: string, content: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_SAVE_CHAT_MESSAGE, meetingId, role, content),

  // Database - Templates
  getTemplates: () => ipcRenderer.invoke(IPC_CHANNELS.DB_GET_TEMPLATES),
  saveTemplate: (template: { id?: string; name: string; sections: string[]; is_default?: boolean }) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_SAVE_TEMPLATE, template),
  deleteTemplate: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DB_DELETE_TEMPLATE, id),

  // Audio
  startRecording: (deviceId?: string) => ipcRenderer.invoke(IPC_CHANNELS.AUDIO_START_RECORDING, deviceId),
  stopRecording: () => ipcRenderer.invoke(IPC_CHANNELS.AUDIO_STOP_RECORDING),
  getAudioDevices: () => ipcRenderer.invoke(IPC_CHANNELS.AUDIO_GET_DEVICES),
  onAudioStatus: (callback: (status: { isRecording: boolean; duration: number }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: { isRecording: boolean; duration: number }) => callback(status);
    ipcRenderer.on(IPC_CHANNELS.AUDIO_STATUS, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AUDIO_STATUS, handler);
  },

  // AI
  transcribe: (audioPath: string) => ipcRenderer.invoke(IPC_CHANNELS.AI_TRANSCRIBE, audioPath),
  enhanceNotes: (rawNotes: string, transcript: string, templateSections?: string[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_ENHANCE_NOTES, rawNotes, transcript, templateSections),
  chat: (meetingId: string, message: string, context: { transcript: string; enhancedNotes: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_CHAT, meetingId, message, context),
  generateTitle: (transcript: string) => ipcRenderer.invoke(IPC_CHANNELS.AI_GENERATE_TITLE, transcript),
  draftEmail: (notes: string, transcript: string) => ipcRenderer.invoke(IPC_CHANNELS.AI_DRAFT_EMAIL, notes, transcript),
  onAIStreamChunk: (callback: (chunk: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, chunk: string) => callback(chunk);
    ipcRenderer.on(IPC_CHANNELS.AI_STREAM_CHUNK, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AI_STREAM_CHUNK, handler);
  },
  onAIStreamDone: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(IPC_CHANNELS.AI_STREAM_DONE, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AI_STREAM_DONE, handler);
  },

  // Settings
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  setSettings: (settings: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, settings),

  // Export
  exportFile: (content: string, defaultName: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_FILE, content, defaultName),

  // Zoom Integration
  zoomConnect: () => ipcRenderer.invoke(IPC_CHANNELS.ZOOM_CONNECT),
  zoomDisconnect: () => ipcRenderer.invoke(IPC_CHANNELS.ZOOM_DISCONNECT),
  zoomGetStatus: () => ipcRenderer.invoke(IPC_CHANNELS.ZOOM_GET_STATUS),
  zoomGetCurrentMeeting: () => ipcRenderer.invoke(IPC_CHANNELS.ZOOM_GET_CURRENT_MEETING),

  // Teams Integration
  teamsConnect: () => ipcRenderer.invoke(IPC_CHANNELS.TEAMS_CONNECT),
  teamsDisconnect: () => ipcRenderer.invoke(IPC_CHANNELS.TEAMS_DISCONNECT),
  teamsGetStatus: () => ipcRenderer.invoke(IPC_CHANNELS.TEAMS_GET_STATUS),
  teamsGetCurrentMeeting: () => ipcRenderer.invoke(IPC_CHANNELS.TEAMS_GET_CURRENT_MEETING),

  // Integration polling
  integrationStartPolling: (provider: 'zoom' | 'teams') =>
    ipcRenderer.invoke(IPC_CHANNELS.INTEGRATION_START_POLLING, provider),
  integrationStopPolling: (provider: 'zoom' | 'teams') =>
    ipcRenderer.invoke(IPC_CHANNELS.INTEGRATION_STOP_POLLING, provider),
  onMeetingDetected: (callback: (data: { provider: string; meeting: unknown }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { provider: string; meeting: unknown }) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.INTEGRATION_MEETING_DETECTED, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.INTEGRATION_MEETING_DETECTED, handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
