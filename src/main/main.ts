import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { Database } from './database';
import { setupAudioHandlers } from './audio';
import { setupAIHandlers } from './ai';
import { setupSettingsHandlers, getSettings } from './settings';
import { IPC_CHANNELS } from '../shared/types';
import fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let database: Database;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  const userDataPath = app.getPath('userData');
  database = new Database(path.join(userDataPath, 'meetings.db'));

  setupDatabaseHandlers(database);
  setupAudioHandlers(mainWindow);
  setupAIHandlers(() => getSettings());
  setupSettingsHandlers();
  setupExportHandlers();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function setupDatabaseHandlers(db: Database) {
  ipcMain.handle(IPC_CHANNELS.DB_GET_MEETINGS, (_event, search?: string) => {
    return db.getMeetings(search);
  });

  ipcMain.handle(IPC_CHANNELS.DB_GET_MEETING, (_event, id: string) => {
    return db.getMeeting(id);
  });

  ipcMain.handle(IPC_CHANNELS.DB_CREATE_MEETING, (_event, meeting: {
    title: string;
    template_id?: string;
    attendees?: string[];
    tags?: string[];
  }) => {
    return db.createMeeting(meeting);
  });

  ipcMain.handle(IPC_CHANNELS.DB_UPDATE_MEETING, (_event, id: string, data: Record<string, unknown>) => {
    return db.updateMeeting(id, data);
  });

  ipcMain.handle(IPC_CHANNELS.DB_DELETE_MEETING, (_event, id: string) => {
    return db.deleteMeeting(id);
  });

  ipcMain.handle(IPC_CHANNELS.DB_GET_NOTE, (_event, meetingId: string) => {
    return db.getNote(meetingId);
  });

  ipcMain.handle(IPC_CHANNELS.DB_SAVE_NOTE, (_event, meetingId: string, data: {
    raw_content?: string;
    enhanced_content?: string;
    transcript?: string;
  }) => {
    return db.saveNote(meetingId, data);
  });

  ipcMain.handle(IPC_CHANNELS.DB_GET_CHAT_MESSAGES, (_event, meetingId: string) => {
    return db.getChatMessages(meetingId);
  });

  ipcMain.handle(IPC_CHANNELS.DB_SAVE_CHAT_MESSAGE, (_event, meetingId: string, role: string, content: string) => {
    return db.saveChatMessage(meetingId, role, content);
  });

  ipcMain.handle(IPC_CHANNELS.DB_GET_TEMPLATES, () => {
    return db.getTemplates();
  });

  ipcMain.handle(IPC_CHANNELS.DB_SAVE_TEMPLATE, (_event, template: {
    id?: string;
    name: string;
    sections: string[];
    is_default?: boolean;
  }) => {
    return db.saveTemplate(template);
  });

  ipcMain.handle(IPC_CHANNELS.DB_DELETE_TEMPLATE, (_event, id: string) => {
    return db.deleteTemplate(id);
  });
}

function setupExportHandlers() {
  ipcMain.handle(IPC_CHANNELS.EXPORT_FILE, async (_event, content: string, defaultName: string) => {
    if (!mainWindow) return null;
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName,
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'Text', extensions: ['txt'] },
      ],
    });
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, content, 'utf-8');
      return result.filePath;
    }
    return null;
  });
}
