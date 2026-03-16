import { useState, useEffect, useCallback, useRef } from 'react';
import type { Meeting, Note, Template } from '../../shared/types';
import { api } from '../lib/api';
import { NoteEditor } from './NoteEditor';
import { ChatPanel } from './ChatPanel';
import { MeetingDetails } from './MeetingDetails';
import { ExportMenu } from './ExportMenu';
import { formatDuration } from '../lib/utils';

interface MeetingViewProps {
  meeting: Meeting;
  isActive: boolean;
  onMeetingUpdated: () => void;
  onMeetingEnded: () => void;
}

export function MeetingView({ meeting, isActive, onMeetingUpdated, onMeetingEnded }: MeetingViewProps) {
  const [note, setNote] = useState<Note | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [transcriptionStatus, setTranscriptionStatus] = useState<'idle' | 'recording' | 'transcribing' | 'done' | 'error'>('idle');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [showEnhanced, setShowEnhanced] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);
  const rawContentRef = useRef('');

  // Load note and template
  useEffect(() => {
    const loadData = async () => {
      const n = await api.getNote(meeting.id);
      setNote(n);
      if (n && n.enhanced_content) {
        setShowEnhanced(true);
      }

      if (meeting.template_id) {
        const templates = await api.getTemplates();
        const t = templates.find(tmpl => tmpl.id === meeting.template_id);
        setTemplate(t || null);
      }
    };
    loadData();
  }, [meeting.id, meeting.template_id]);

  // Audio status listener
  useEffect(() => {
    if (!isActive) return;
    setTranscriptionStatus('recording');

    const cleanup = api.onAudioStatus((status) => {
      setRecordingDuration(status.duration);
    });

    return cleanup;
  }, [isActive]);

  // Stream listener for AI enhancement
  useEffect(() => {
    const chunkCleanup = api.onAIStreamChunk((chunk) => {
      setStreamedContent(prev => prev + chunk);
    });

    const doneCleanup = api.onAIStreamDone(() => {
      setIsEnhancing(false);
      setShowEnhanced(true);
    });

    return () => {
      chunkCleanup();
      doneCleanup();
    };
  }, []);

  // Auto-save raw notes every 5 seconds
  const handleNoteChange = useCallback((content: string) => {
    rawContentRef.current = content;

    if (autoSaveRef.current) {
      clearTimeout(autoSaveRef.current);
    }

    autoSaveRef.current = setTimeout(async () => {
      await api.saveNote(meeting.id, { raw_content: content });
    }, 5000);
  }, [meeting.id]);

  // Cleanup auto-save on unmount
  useEffect(() => {
    return () => {
      if (autoSaveRef.current) {
        clearTimeout(autoSaveRef.current);
        // Save immediately on unmount
        if (rawContentRef.current) {
          api.saveNote(meeting.id, { raw_content: rawContentRef.current });
        }
      }
    };
  }, [meeting.id]);

  const handleStartRecording = async () => {
    try {
      await api.startRecording();
      setTranscriptionStatus('recording');
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  };

  const handleEndMeeting = async () => {
    // Save current notes immediately
    if (rawContentRef.current) {
      await api.saveNote(meeting.id, { raw_content: rawContentRef.current });
    }

    setTranscriptionStatus('transcribing');

    try {
      // Stop recording
      const { audioPath, duration } = await api.stopRecording();

      // Update meeting with end time and duration
      await api.updateMeeting(meeting.id, {
        ended_at: new Date().toISOString(),
        duration_seconds: duration,
      });

      let transcript = '';

      // Transcribe if we have audio
      if (audioPath) {
        try {
          transcript = await api.transcribe(audioPath);
          await api.saveNote(meeting.id, { transcript });
        } catch (err) {
          console.error('Transcription failed:', err);
        }
      }

      setTranscriptionStatus('done');

      // Auto-generate title if blank
      if (!meeting.title && transcript) {
        try {
          const title = await api.generateTitle(transcript);
          await api.updateMeeting(meeting.id, { title });
        } catch (err) {
          console.error('Title generation failed:', err);
        }
      }

      // Enhance notes with AI
      if (rawContentRef.current || transcript) {
        setIsEnhancing(true);
        setStreamedContent('');
        try {
          const enhanced = await api.enhanceNotes(
            rawContentRef.current,
            transcript,
            template?.sections
          );
          await api.saveNote(meeting.id, { enhanced_content: enhanced });
          setStreamedContent(enhanced);

          // Reload note
          const updatedNote = await api.getNote(meeting.id);
          setNote(updatedNote);
        } catch (err) {
          console.error('Enhancement failed:', err);
          setIsEnhancing(false);
        }
      }

      onMeetingEnded();
      onMeetingUpdated();
    } catch (err) {
      console.error('Failed to end meeting:', err);
      setTranscriptionStatus('error');
    }
  };

  const handleSaveEnhanced = async (content: string) => {
    await api.saveNote(meeting.id, { enhanced_content: content });
    const updated = await api.getNote(meeting.id);
    setNote(updated);
  };

  const isEnded = !!meeting.ended_at;

  return (
    <div className="flex-1 flex min-h-0">
      {/* Main editor area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              <span className="font-medium">{meeting.title || 'Untitled Meeting'}</span>
              <svg className="w-3 h-3 ml-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {meeting.tags.length > 0 && (
              <div className="flex gap-1">
                {meeting.tags.map((tag, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isEnded && (
              <>
                {showEnhanced && note?.raw_content && (
                  <button
                    onClick={() => setShowEnhanced(!showEnhanced)}
                    className="text-xs px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    {showEnhanced ? 'View Raw Notes' : 'View Enhanced'}
                  </button>
                )}
                <button
                  onClick={() => setShowExport(!showExport)}
                  className="relative text-xs px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowChat(!showChat)}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                    showChat
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </button>
              </>
            )}

            {isActive && !isEnded && (
              <button
                onClick={handleEndMeeting}
                className="text-xs px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                End Meeting
              </button>
            )}

            {!isActive && !isEnded && (
              <button
                onClick={handleStartRecording}
                className="text-xs px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Start Recording
              </button>
            )}
          </div>
        </div>

        {/* Export Menu */}
        {showExport && (
          <ExportMenu
            meeting={meeting}
            note={note}
            onClose={() => setShowExport(false)}
          />
        )}

        {/* Meeting Details Panel */}
        {showDetails && (
          <MeetingDetails
            meeting={meeting}
            onUpdate={async (data) => {
              await api.updateMeeting(meeting.id, data);
              onMeetingUpdated();
            }}
            onClose={() => setShowDetails(false)}
          />
        )}

        {/* Editor */}
        <div className="flex-1 overflow-y-auto">
          {isEnhancing ? (
            <div className="max-w-3xl mx-auto px-8 py-6">
              <div className="flex items-center gap-2 mb-4 text-sm text-blue-600 dark:text-blue-400">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Enhancing your notes with AI...
              </div>
              <div className="markdown-content text-gray-800 dark:text-gray-200 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(streamedContent) }}
              />
            </div>
          ) : showEnhanced && (note?.enhanced_content || streamedContent) ? (
            <NoteEditor
              content={note?.enhanced_content || streamedContent}
              onChange={handleSaveEnhanced}
              placeholder="Enhanced notes will appear here..."
              isMarkdown={true}
            />
          ) : (
            <NoteEditor
              content={note?.raw_content || ''}
              onChange={handleNoteChange}
              placeholder={isActive ? "Start typing your notes..." : "No notes yet. Start a recording to begin."}
              isMarkdown={false}
            />
          )}
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between px-4 py-1.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-4">
            {isActive && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="recording-dot w-2 h-2 bg-red-500 rounded-full" />
                  <span>Recording</span>
                </div>
                <span>{formatDuration(recordingDuration)}</span>
              </>
            )}
            {transcriptionStatus === 'transcribing' && (
              <span className="text-blue-500">Transcribing...</span>
            )}
            {transcriptionStatus === 'done' && (
              <span className="text-green-500">Transcription complete</span>
            )}
            {transcriptionStatus === 'error' && (
              <span className="text-red-500">Transcription failed</span>
            )}
          </div>
          <div>
            {meeting.duration_seconds && (
              <span>Duration: {formatDuration(meeting.duration_seconds)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Chat Panel */}
      {showChat && note && (
        <ChatPanel
          meetingId={meeting.id}
          transcript={note.transcript}
          enhancedNotes={note.enhanced_content}
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
  );
}

function simpleMarkdownToHtml(text: string): string {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/\n/g, '<br/>');

  return html;
}
