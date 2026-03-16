import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { Template, ZoomMeeting, TeamsMeeting } from '../../shared/types';

interface DetectedMeetingInfo {
  provider: 'zoom' | 'teams';
  title: string;
  participants: string[];
}

interface NewMeetingDialogProps {
  onClose: () => void;
  onCreate: (title: string, templateId?: string, attendees?: string[]) => void;
}

export function NewMeetingDialog({ onClose, onCreate }: NewMeetingDialogProps) {
  const [title, setTitle] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>();
  const [detectedMeetings, setDetectedMeetings] = useState<DetectedMeetingInfo[]>([]);
  const [selectedDetectedMeeting, setSelectedDetectedMeeting] = useState<DetectedMeetingInfo | null>(null);
  const [loadingMeetings, setLoadingMeetings] = useState(false);

  useEffect(() => {
    api.getTemplates().then(t => {
      setTemplates(t);
      const defaultTemplate = t.find(tmpl => tmpl.name === 'Default');
      if (defaultTemplate) {
        setSelectedTemplateId(defaultTemplate.id);
      }
    });

    // Check for active meetings from integrations
    setLoadingMeetings(true);
    Promise.all([
      api.zoomGetCurrentMeeting().catch(() => null),
      api.teamsGetCurrentMeeting().catch(() => null),
    ]).then(([zoomMeeting, teamsMeeting]) => {
      const detected: DetectedMeetingInfo[] = [];
      if (zoomMeeting) {
        const zm = zoomMeeting as ZoomMeeting;
        detected.push({
          provider: 'zoom',
          title: zm.topic,
          participants: zm.participants || [],
        });
      }
      if (teamsMeeting) {
        const tm = teamsMeeting as TeamsMeeting;
        detected.push({
          provider: 'teams',
          title: tm.subject,
          participants: tm.attendees || [],
        });
      }
      setDetectedMeetings(detected);
      setLoadingMeetings(false);
    });
  }, []);

  const handleSelectDetectedMeeting = (meeting: DetectedMeetingInfo) => {
    setSelectedDetectedMeeting(meeting);
    setTitle(meeting.title);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const attendees = selectedDetectedMeeting?.participants || [];
    onCreate(title || 'Untitled Meeting', selectedTemplateId, attendees.length > 0 ? attendees : undefined);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          New Meeting
        </h2>

        <form onSubmit={handleSubmit}>
          {/* Detected Meetings */}
          {(detectedMeetings.length > 0 || loadingMeetings) && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Detected Meetings
              </label>
              {loadingMeetings ? (
                <div className="text-xs text-gray-400 animate-pulse">Checking for active meetings...</div>
              ) : (
                <div className="space-y-2">
                  {detectedMeetings.map((meeting, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectDetectedMeeting(meeting)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                        selectedDetectedMeeting === meeting
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          meeting.provider === 'zoom'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                            : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                        }`}>
                          {meeting.provider === 'zoom' ? 'Zoom' : 'Teams'}
                        </span>
                        <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {meeting.title}
                        </span>
                      </div>
                      {meeting.participants.length > 0 && (
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {meeting.participants.slice(0, 3).join(', ')}
                          {meeting.participants.length > 3 && ` +${meeting.participants.length - 3} more`}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Meeting Title
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Weekly Standup, Client Discovery..."
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
            />
          </div>

          {/* Show auto-populated attendees */}
          {selectedDetectedMeeting && selectedDetectedMeeting.participants.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Attendees (auto-populated)
              </label>
              <div className="flex flex-wrap gap-1">
                {selectedDetectedMeeting.participants.map((p, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-full"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Template
            </label>
            <div className="grid grid-cols-2 gap-2">
              {templates.map(template => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(template.id)}
                  className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                    selectedTemplateId === template.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div className="font-medium">{template.name}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                    {template.sections.slice(0, 3).join(', ')}
                    {template.sections.length > 3 && '...'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Start Meeting
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
