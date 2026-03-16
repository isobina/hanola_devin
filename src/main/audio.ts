import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../shared/types';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

let recordingInterval: NodeJS.Timeout | null = null;
let recordingStartTime: number | null = null;
let currentAudioPath: string | null = null;

export function setupAudioHandlers(mainWindow: BrowserWindow | null) {
  ipcMain.handle(IPC_CHANNELS.AUDIO_START_RECORDING, async (_event, _deviceId?: string) => {
    const tempDir = path.join(app.getPath('userData'), 'recordings');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    currentAudioPath = path.join(tempDir, `recording-${Date.now()}.webm`);
    recordingStartTime = Date.now();

    // Send periodic status updates
    recordingInterval = setInterval(() => {
      if (mainWindow && !mainWindow.isDestroyed() && recordingStartTime) {
        const duration = Math.floor((Date.now() - recordingStartTime) / 1000);
        mainWindow.webContents.send(IPC_CHANNELS.AUDIO_STATUS, {
          isRecording: true,
          duration,
        });
      }
    }, 1000);

    // Audio capture is initiated from the renderer using desktopCapturer
    // The main process just manages state and file paths
    return { audioPath: currentAudioPath };
  });

  ipcMain.handle(IPC_CHANNELS.AUDIO_STOP_RECORDING, async () => {
    if (recordingInterval) {
      clearInterval(recordingInterval);
      recordingInterval = null;
    }

    const audioPath = currentAudioPath;
    const startTime = recordingStartTime;

    recordingStartTime = null;
    currentAudioPath = null;

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.AUDIO_STATUS, {
        isRecording: false,
        duration: 0,
      });
    }

    return {
      audioPath,
      duration: startTime ? Math.floor((Date.now() - startTime) / 1000) : 0,
    };
  });

  ipcMain.handle(IPC_CHANNELS.AUDIO_GET_DEVICES, async () => {
    // Audio devices are enumerated from the renderer process
    // This is a placeholder - the renderer will use navigator.mediaDevices
    return [];
  });
}
