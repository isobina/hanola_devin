import type { Meeting, Note } from '../../shared/types';
import { api } from '../lib/api';
import { notesToMarkdown, notesToSlack } from '../lib/utils';

interface ExportMenuProps {
  meeting: Meeting;
  note: Note | null;
  onClose: () => void;
}

export function ExportMenu({ meeting, note, onClose }: ExportMenuProps) {
  const content = note?.enhanced_content || note?.raw_content || '';

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    alert(`${label} copied to clipboard!`);
    onClose();
  };

  const handleCopyMarkdown = () => {
    const md = notesToMarkdown(content, meeting);
    copyToClipboard(md, 'Markdown');
  };

  const handleCopyPlainText = () => {
    // Strip markdown formatting
    const plain = content
      .replace(/^#{1,3}\s+/gm, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^- /gm, '• ');
    copyToClipboard(plain, 'Plain text');
  };

  const handleCopySlack = () => {
    const slack = notesToSlack(content, meeting);
    copyToClipboard(slack, 'Slack format');
  };

  const handleExportFile = async () => {
    const md = notesToMarkdown(content, meeting);
    const fileName = `${(meeting.title || 'meeting-notes').replace(/[^a-zA-Z0-9]/g, '-')}.md`;
    await api.exportFile(md, fileName);
    onClose();
  };

  const handleCopyEmail = async () => {
    try {
      const email = await api.draftEmail(content, note?.transcript || '');
      await navigator.clipboard.writeText(email);
      alert('Follow-up email copied to clipboard!');
    } catch (_err) {
      alert('Failed to generate email. Please check your API key in Settings.');
    }
    onClose();
  };

  return (
    <div className="absolute right-4 top-20 z-50 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1">
      <button
        onClick={handleCopyMarkdown}
        className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        Copy as Markdown
      </button>
      <button
        onClick={handleCopyPlainText}
        className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Copy as plain text
      </button>
      <button
        onClick={handleExportFile}
        className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Export to .md file
      </button>
      <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
      <button
        onClick={handleCopySlack}
        className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
        </svg>
        Copy for Slack
      </button>
      <button
        onClick={handleCopyEmail}
        className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        Copy follow-up email
      </button>

      {/* Backdrop to close */}
      <div className="fixed inset-0 -z-10" onClick={onClose} />
    </div>
  );
}
