import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { Template } from '../../shared/types';

interface NewMeetingDialogProps {
  onClose: () => void;
  onCreate: (title: string, templateId?: string) => void;
}

export function NewMeetingDialog({ onClose, onCreate }: NewMeetingDialogProps) {
  const [title, setTitle] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>();

  useEffect(() => {
    api.getTemplates().then(t => {
      setTemplates(t);
      const defaultTemplate = t.find(tmpl => tmpl.name === 'Default');
      if (defaultTemplate) {
        setSelectedTemplateId(defaultTemplate.id);
      }
    });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(title || 'Untitled Meeting', selectedTemplateId);
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
