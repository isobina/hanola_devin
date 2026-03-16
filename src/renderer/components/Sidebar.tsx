import { useState } from 'react';
import type { Meeting } from '../../shared/types';
import { formatDate, formatDuration } from '../lib/utils';
import { NewMeetingDialog } from './NewMeetingDialog';

interface SidebarProps {
  meetings: Meeting[];
  selectedMeetingId: string | null;
  activeMeetingId: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectMeeting: (id: string) => void;
  onNewMeeting: (title: string, templateId?: string, attendees?: string[]) => void;
  onDeleteMeeting: (id: string) => void;
  onOpenSettings: () => void;
}

export function Sidebar({
  meetings,
  selectedMeetingId,
  activeMeetingId,
  searchQuery,
  onSearchChange,
  onSelectMeeting,
  onNewMeeting,
  onDeleteMeeting,
  onOpenSettings,
}: SidebarProps) {
  const [showNewMeeting, setShowNewMeeting] = useState(false);
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);

  return (
    <>
      <div className="w-72 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
        {/* Drag region + app name */}
        <div className="drag-region h-8 flex items-center px-4">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 select-none">Notes</span>
        </div>

        {/* New Meeting Button */}
        <div className="px-3 py-2">
          <button
            onClick={() => setShowNewMeeting(true)}
            className="no-drag w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Meeting
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pb-2">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search meetings..."
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              className="no-drag w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400"
            />
          </div>
        </div>

        {/* Meeting List */}
        <div className="flex-1 overflow-y-auto px-2">
          {meetings.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
              {searchQuery ? 'No meetings found' : 'No meetings yet'}
            </div>
          ) : (
            meetings.map(meeting => (
              <div
                key={meeting.id}
                onClick={() => onSelectMeeting(meeting.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenuId(contextMenuId === meeting.id ? null : meeting.id);
                }}
                className={`no-drag relative group px-3 py-2.5 rounded-lg cursor-pointer mb-0.5 transition-colors ${
                  selectedMeetingId === meeting.id
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {activeMeetingId === meeting.id && (
                        <span className="recording-dot w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
                      )}
                      <h3 className="text-sm font-medium truncate">
                        {meeting.title || 'Untitled Meeting'}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {formatDate(meeting.created_at)}
                      </span>
                      {meeting.duration_seconds && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {formatDuration(meeting.duration_seconds)}
                        </span>
                      )}
                    </div>
                    {meeting.attendees.length > 0 && (
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                        {meeting.attendees.length} attendee{meeting.attendees.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>

                  {/* Delete button on hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Delete this meeting?')) {
                        onDeleteMeeting(meeting.id);
                      }
                    }}
                    className="no-drag opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {/* Tags */}
                {meeting.tags.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {meeting.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Settings button */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onOpenSettings}
            className="no-drag w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>
        </div>
      </div>

      {showNewMeeting && (
        <NewMeetingDialog
          onClose={() => setShowNewMeeting(false)}
          onCreate={(title, templateId, attendees) => {
            onNewMeeting(title, templateId, attendees);
            setShowNewMeeting(false);
          }}
        />
      )}
    </>
  );
}
