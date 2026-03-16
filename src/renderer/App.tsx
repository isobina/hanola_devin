import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { MeetingView } from './components/MeetingView';
import { SettingsPanel } from './components/SettingsPanel';
import { api } from './lib/api';
import type { Meeting, AppSettings } from '../shared/types';

type View = 'meeting' | 'settings';

export function App() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<View>('meeting');
  const [searchQuery, setSearchQuery] = useState('');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);

  // Apply theme
  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else if (settings.theme === 'light') {
      root.classList.remove('dark');
    } else {
      // system
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [settings]);

  const loadMeetings = useCallback(async () => {
    const data = await api.getMeetings(searchQuery || undefined);
    setMeetings(data);
  }, [searchQuery]);

  const loadSettings = useCallback(async () => {
    const s = await api.getSettings();
    setSettings(s);
  }, []);

  useEffect(() => {
    loadMeetings();
    loadSettings();
  }, [loadMeetings, loadSettings]);

  const handleNewMeeting = async (title: string, templateId?: string, attendees?: string[]) => {
    const meeting = await api.createMeeting({ title, template_id: templateId, attendees });
    await loadMeetings();
    setSelectedMeetingId(meeting.id);
    setActiveMeetingId(meeting.id);
    setCurrentView('meeting');
  };

  const handleSelectMeeting = (id: string) => {
    setSelectedMeetingId(id);
    setCurrentView('meeting');
  };

  const handleDeleteMeeting = async (id: string) => {
    await api.deleteMeeting(id);
    if (selectedMeetingId === id) {
      setSelectedMeetingId(null);
    }
    if (activeMeetingId === id) {
      setActiveMeetingId(null);
    }
    await loadMeetings();
  };

  const handleMeetingUpdated = async () => {
    await loadMeetings();
  };

  const handleMeetingEnded = () => {
    setActiveMeetingId(null);
    loadMeetings();
  };

  const handleSaveSettings = async (newSettings: Partial<AppSettings>) => {
    const updated = await api.setSettings(newSettings);
    setSettings(updated);
  };

  const selectedMeeting = meetings.find(m => m.id === selectedMeetingId) || null;

  return (
    <div className="flex h-screen w-screen bg-white dark:bg-gray-900">
      {/* Sidebar */}
      <Sidebar
        meetings={meetings}
        selectedMeetingId={selectedMeetingId}
        activeMeetingId={activeMeetingId}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSelectMeeting={handleSelectMeeting}
        onNewMeeting={handleNewMeeting}
        onDeleteMeeting={handleDeleteMeeting}
        onOpenSettings={() => setCurrentView('settings')}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Title bar drag region */}
        <div className="drag-region h-8 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-center">
          <span className="text-xs text-gray-400 dark:text-gray-500 select-none">Meeting Notes</span>
        </div>

        {currentView === 'settings' ? (
          <SettingsPanel
            settings={settings}
            onSave={handleSaveSettings}
            onBack={() => setCurrentView('meeting')}
          />
        ) : selectedMeeting ? (
          <MeetingView
            meeting={selectedMeeting}
            isActive={activeMeetingId === selectedMeeting.id}
            onMeetingUpdated={handleMeetingUpdated}
            onMeetingEnded={handleMeetingEnded}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">📝</div>
              <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">
                No meeting selected
              </h2>
              <p className="text-gray-400 dark:text-gray-500">
                Select a meeting from the sidebar or start a new one
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
