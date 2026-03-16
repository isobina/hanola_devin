import { useRef, useEffect, useCallback, useState } from 'react';
import { simpleMarkdown } from '../lib/utils';

interface NoteEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder: string;
  isMarkdown: boolean;
}

export function NoteEditor({ content, onChange, placeholder, isMarkdown }: NoteEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const lastContentRef = useRef(content);

  // Set content when it changes externally
  useEffect(() => {
    if (!editorRef.current) return;
    if (isEditing) return; // Don't update while user is typing

    if (content !== lastContentRef.current) {
      lastContentRef.current = content;
      if (isMarkdown && !isEditing) {
        editorRef.current.innerHTML = simpleMarkdown(content);
      } else {
        editorRef.current.innerText = content;
      }
    }
  }, [content, isMarkdown, isEditing]);

  // Initialize content
  useEffect(() => {
    if (!editorRef.current) return;
    if (isMarkdown) {
      editorRef.current.innerHTML = simpleMarkdown(content);
    } else {
      editorRef.current.innerText = content;
    }
    lastContentRef.current = content;
  // Only run on mount and when switching between raw/enhanced
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMarkdown]);

  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    const text = isMarkdown
      ? editorRef.current.innerHTML
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
      : editorRef.current.innerText;

    lastContentRef.current = text;
    onChange(text);
  }, [onChange, isMarkdown]);

  return (
    <div className="max-w-3xl mx-auto px-8 py-6">
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={handleInput}
        onFocus={() => setIsEditing(true)}
        onBlur={() => setIsEditing(false)}
        className={`note-editor text-gray-800 dark:text-gray-200 leading-relaxed text-base outline-none min-h-[400px] ${
          isMarkdown ? 'markdown-content' : ''
        }`}
      />
    </div>
  );
}
