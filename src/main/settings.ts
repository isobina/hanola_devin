import { ipcMain } from 'electron';
import Store from 'electron-store';
import { IPC_CHANNELS, AppSettings } from '../shared/types';

const store = new Store<AppSettings>({
  defaults: {
    openaiApiKey: '',
    anthropicApiKey: '',
    geminiApiKey: '',
    defaultTemplateId: null,
    audioInputDevice: null,
    theme: 'system',
  },
});

export function getSettings(): AppSettings {
  return {
    openaiApiKey: store.get('openaiApiKey', ''),
    anthropicApiKey: store.get('anthropicApiKey', ''),
    geminiApiKey: store.get('geminiApiKey', ''),
    defaultTemplateId: store.get('defaultTemplateId', null),
    audioInputDevice: store.get('audioInputDevice', null),
    theme: store.get('theme', 'system'),
  };
}

export function setupSettingsHandlers() {
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
    return getSettings();
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_event, settings: Partial<AppSettings>) => {
    for (const [key, value] of Object.entries(settings)) {
      store.set(key as keyof AppSettings, value);
    }
    return getSettings();
  });
}
