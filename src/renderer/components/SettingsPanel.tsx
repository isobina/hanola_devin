import { useState, useEffect } from 'react';
import type { AppSettings, Template, IntegrationStatus } from '../../shared/types';
import { api } from '../lib/api';

interface SettingsPanelProps {
  settings: AppSettings | null;
  onSave: (settings: Partial<AppSettings>) => void;
  onBack: () => void;
}

export function SettingsPanel({ settings, onSave, onBack }: SettingsPanelProps) {
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [defaultTemplateId, setDefaultTemplateId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<{ name: string; sections: string } | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [zoomClientId, setZoomClientId] = useState('');
  const [zoomClientSecret, setZoomClientSecret] = useState('');
  const [teamsClientId, setTeamsClientId] = useState('');
  const [teamsClientSecret, setTeamsClientSecret] = useState('');
  const [zoomStatus, setZoomStatus] = useState<IntegrationStatus>({ connected: false, provider: 'zoom' });
  const [teamsStatus, setTeamsStatus] = useState<IntegrationStatus>({ connected: false, provider: 'teams' });
  const [connectingZoom, setConnectingZoom] = useState(false);
  const [connectingTeams, setConnectingTeams] = useState(false);

  useEffect(() => {
    if (settings) {
      setOpenaiKey(settings.openaiApiKey);
      setAnthropicKey(settings.anthropicApiKey);
      setGeminiKey(settings.geminiApiKey);
      setTheme(settings.theme);
      setDefaultTemplateId(settings.defaultTemplateId);
      setZoomClientId(settings.zoomClientId);
      setZoomClientSecret(settings.zoomClientSecret);
      setTeamsClientId(settings.teamsClientId);
      setTeamsClientSecret(settings.teamsClientSecret);
    }
    api.getTemplates().then(setTemplates);
    api.zoomGetStatus().then(setZoomStatus);
    api.teamsGetStatus().then(setTeamsStatus);
  }, [settings]);

  const handleSave = () => {
    onSave({
      openaiApiKey: openaiKey,
      anthropicApiKey: anthropicKey,
      geminiApiKey: geminiKey,
      theme,
      defaultTemplateId,
      zoomClientId,
      zoomClientSecret,
      teamsClientId,
      teamsClientSecret,
    });
  };

  const handleZoomConnect = async () => {
    setConnectingZoom(true);
    try {
      const result = await api.zoomConnect();
      if (result.success) {
        setZoomStatus({ connected: true, provider: 'zoom' });
      }
    } finally {
      setConnectingZoom(false);
    }
  };

  const handleZoomDisconnect = async () => {
    await api.zoomDisconnect();
    setZoomStatus({ connected: false, provider: 'zoom' });
  };

  const handleTeamsConnect = async () => {
    setConnectingTeams(true);
    try {
      const result = await api.teamsConnect();
      if (result.success) {
        setTeamsStatus({ connected: true, provider: 'teams' });
      }
    } finally {
      setConnectingTeams(false);
    }
  };

  const handleTeamsDisconnect = async () => {
    await api.teamsDisconnect();
    setTeamsStatus({ connected: false, provider: 'teams' });
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    const sections = editingTemplate.sections.split('\n').map(s => s.trim()).filter(Boolean);
    if (!editingTemplate.name || sections.length === 0) return;

    await api.saveTemplate({
      id: editingTemplateId || undefined,
      name: editingTemplate.name,
      sections,
    });

    setTemplates(await api.getTemplates());
    setShowTemplateEditor(false);
    setEditingTemplate(null);
    setEditingTemplateId(null);
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    await api.deleteTemplate(id);
    setTemplates(await api.getTemplates());
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onBack}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Settings</h1>
        </div>

        {/* API Keys */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 uppercase tracking-wider">
            API Keys
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                OpenAI API Key
                <span className="text-xs text-gray-400 ml-1">(for Whisper transcription)</span>
              </label>
              <input
                type="password"
                value={openaiKey}
                onChange={e => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Anthropic API Key
                <span className="text-xs text-gray-400 ml-1">(for Claude note enhancement & chat)</span>
              </label>
              <input
                type="password"
                value={anthropicKey}
                onChange={e => setAnthropicKey(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Google Gemini API Key
                <span className="text-xs text-gray-400 ml-1">(optional)</span>
              </label>
              <input
                type="password"
                value={geminiKey}
                onChange={e => setGeminiKey(e.target.value)}
                placeholder="AIza..."
                className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400"
              />
            </div>
          </div>
        </section>

        {/* Theme */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 uppercase tracking-wider">
            Appearance
          </h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Theme
            </label>
            <div className="flex gap-2">
              {(['light', 'dark', 'system'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                    theme === t
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}
                >
                  {t === 'light' && '☀️ '}
                  {t === 'dark' && '🌙 '}
                  {t === 'system' && '💻 '}
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Default Template */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 uppercase tracking-wider">
            Default Template
          </h2>
          <select
            value={defaultTemplateId || ''}
            onChange={e => setDefaultTemplateId(e.target.value || null)}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
          >
            <option value="">None (ask each time)</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </section>

        {/* Integrations */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 uppercase tracking-wider">
            Integrations
          </h2>
          <div className="space-y-4">
            {/* Zoom */}
            <div className="p-4 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M4 4h10a4 4 0 014 4v8a4 4 0 01-4 4H4a2 2 0 01-2-2V6a2 2 0 012-2zm16 4l-4 3v2l4 3V8z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Zoom</span>
                  {zoomStatus.connected && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded font-medium">
                      Connected
                    </span>
                  )}
                </div>
                {zoomStatus.connected ? (
                  <button
                    onClick={handleZoomDisconnect}
                    className="text-xs px-3 py-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={handleZoomConnect}
                    disabled={connectingZoom || !zoomClientId}
                    className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                  >
                    {connectingZoom ? 'Connecting...' : 'Connect'}
                  </button>
                )}
              </div>
              <div className="space-y-2">
                <input
                  type="text"
                  value={zoomClientId}
                  onChange={e => setZoomClientId(e.target.value)}
                  placeholder="Zoom Client ID"
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400"
                />
                <input
                  type="password"
                  value={zoomClientSecret}
                  onChange={e => setZoomClientSecret(e.target.value)}
                  placeholder="Zoom Client Secret"
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-2">
                Create a Zoom OAuth app at marketplace.zoom.us to get credentials. Set redirect URI to http://localhost:28465/callback
              </p>
            </div>

            {/* Teams */}
            <div className="p-4 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.5 5h-3V3.5A1.5 1.5 0 0015 2H9a1.5 1.5 0 00-1.5 1.5V5h-3A1.5 1.5 0 003 6.5v11A1.5 1.5 0 004.5 19h15a1.5 1.5 0 001.5-1.5v-11A1.5 1.5 0 0019.5 5zM9 3.5h6V5H9V3.5zM12 15a3 3 0 110-6 3 3 0 010 6z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Microsoft Teams</span>
                  {teamsStatus.connected && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded font-medium">
                      Connected
                    </span>
                  )}
                </div>
                {teamsStatus.connected ? (
                  <button
                    onClick={handleTeamsDisconnect}
                    className="text-xs px-3 py-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={handleTeamsConnect}
                    disabled={connectingTeams || !teamsClientId}
                    className="text-xs px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                  >
                    {connectingTeams ? 'Connecting...' : 'Connect'}
                  </button>
                )}
              </div>
              <div className="space-y-2">
                <input
                  type="text"
                  value={teamsClientId}
                  onChange={e => setTeamsClientId(e.target.value)}
                  placeholder="Azure AD Application (Client) ID"
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-gray-100 placeholder-gray-400"
                />
                <input
                  type="password"
                  value={teamsClientSecret}
                  onChange={e => setTeamsClientSecret(e.target.value)}
                  placeholder="Azure AD Client Secret"
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-gray-100 placeholder-gray-400"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-2">
                Register an app in Azure AD portal. Set redirect URI to http://localhost:28465/callback. Required permissions: OnlineMeetings.Read, Calendars.Read, User.Read
              </p>
            </div>
          </div>
        </section>

        {/* Templates */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
              Meeting Templates
            </h2>
            <button
              onClick={() => {
                setEditingTemplate({ name: '', sections: '' });
                setEditingTemplateId(null);
                setShowTemplateEditor(true);
              }}
              className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              + New Template
            </button>
          </div>

          <div className="space-y-2">
            {templates.map(t => (
              <div
                key={t.id}
                className="flex items-center justify-between px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    {t.name}
                    {t.is_default && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 rounded">
                        Built-in
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {t.sections.join(' · ')}
                  </div>
                </div>
                {!t.is_default && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditingTemplate({ name: t.name, sections: t.sections.join('\n') });
                        setEditingTemplateId(t.id);
                        setShowTemplateEditor(true);
                      }}
                      className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(t.id)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Save Button */}
        <div className="flex justify-end pb-8">
          <button
            onClick={handleSave}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>

      {/* Template Editor Modal */}
      {showTemplateEditor && editingTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {editingTemplateId ? 'Edit Template' : 'New Template'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Template Name
                </label>
                <input
                  type="text"
                  value={editingTemplate.name}
                  onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                  placeholder="e.g., Sprint Planning"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sections (one per line)
                </label>
                <textarea
                  value={editingTemplate.sections}
                  onChange={e => setEditingTemplate({ ...editingTemplate, sections: e.target.value })}
                  placeholder={"Summary\nDiscussion Points\nAction Items\nNext Steps"}
                  rows={6}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setShowTemplateEditor(false);
                  setEditingTemplate(null);
                  setEditingTemplateId(null);
                }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
