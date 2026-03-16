import { useState, useEffect, useRef } from 'react';
import type { ChatMessage } from '../../shared/types';
import { api } from '../lib/api';
import { simpleMarkdown } from '../lib/utils';

interface ChatPanelProps {
  meetingId: string;
  transcript: string;
  enhancedNotes: string;
  onClose: () => void;
}

const PROMPT_CHIPS = [
  { label: 'Write a follow-up email', prompt: 'Write a professional follow-up email based on this meeting.' },
  { label: 'List action items', prompt: 'List all action items from this meeting with owners if mentioned.' },
  { label: 'Summarize in 3 bullets', prompt: 'Summarize this meeting in exactly 3 bullet points.' },
  { label: 'What were their objections?', prompt: 'What objections or concerns were raised during this meeting?' },
  { label: 'Who was in the meeting?', prompt: 'Based on the transcript, who participated in this meeting?' },
];

export function ChatPanel({ meetingId, transcript, enhancedNotes, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getChatMessages(meetingId).then(setMessages);
  }, [meetingId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg = await api.saveChatMessage(meetingId, 'user', text.trim());
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await api.chat(meetingId, text.trim(), { transcript, enhancedNotes });
      const assistantMsg = await api.saveChatMessage(meetingId, 'assistant', response);
      setMessages(prev => [...prev, assistantMsg]);
    } catch (_err) {
      const errorMsg = await api.saveChatMessage(
        meetingId,
        'assistant',
        'Sorry, I encountered an error. Please check your API key in Settings.'
      );
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="w-80 border-l border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50 dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">AI Chat</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && !isLoading && (
          <div className="text-center py-4">
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-3">
              Ask anything about this meeting
            </p>
            {/* Prompt Chips */}
            <div className="flex flex-wrap gap-1.5 justify-center">
              {PROMPT_CHIPS.map((chip, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(chip.prompt)}
                  className="text-xs px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full text-gray-600 dark:text-gray-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div
                  className="markdown-content text-sm"
                  dangerouslySetInnerHTML={{ __html: simpleMarkdown(msg.content) }}
                />
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Prompt chips when there are messages */}
      {messages.length > 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1">
          {PROMPT_CHIPS.slice(0, 3).map((chip, i) => (
            <button
              key={i}
              onClick={() => sendMessage(chip.prompt)}
              disabled={isLoading}
              className="text-[10px] px-2 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50"
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about this meeting..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
