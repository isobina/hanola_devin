import { useState } from 'react';
import type { Meeting } from '../../shared/types';
import { formatDate, formatDuration } from '../lib/utils';

interface MeetingDetailsProps {
  meeting: Meeting;
  onUpdate: (data: Record<string, unknown>) => void;
  onClose: () => void;
}

export function MeetingDetails({ meeting, onUpdate, onClose }: MeetingDetailsProps) {
  const [title, setTitle] = useState(meeting.title);
  const [attendees, setAttendees] = useState(meeting.attendees.join(', '));
  const [tags, setTags] = useState(meeting.tags.join(', '));

  const handleSave = () => {
    onUpdate({
      title,
      attendees: attendees.split(',').map(a => a.trim()).filter(Boolean),
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    });
    onClose();
  };

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
      <div className="max-w-3xl mx-auto space-y-3">
        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Attendees */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Attendees (comma-separated)
            </label>
            <input
              type="text"
              value={attendees}
              onChange={e => setAttendees(e.target.value)}
              placeholder="John, Jane, Bob..."
              className="w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="Sales, Internal, Customer..."
              className="w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400"
            />
          </div>
        </div>

        {/* Info row */}
        <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
          <span>Created: {formatDate(meeting.created_at)}</span>
          {meeting.ended_at && <span>Ended: {formatDate(meeting.ended_at)}</span>}
          {meeting.duration_seconds && <span>Duration: {formatDuration(meeting.duration_seconds)}</span>}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="text-xs px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Save Details
          </button>
        </div>
      </div>
    </div>
  );
}
