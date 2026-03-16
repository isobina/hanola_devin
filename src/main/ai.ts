import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS, AppSettings } from '../shared/types';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import fs from 'fs';

export function setupAIHandlers(getSettings: () => AppSettings) {
  ipcMain.handle(IPC_CHANNELS.AI_TRANSCRIBE, async (_event, audioPath: string) => {
    const settings = getSettings();
    if (!settings.openaiApiKey) {
      throw new Error('OpenAI API key is required for transcription. Please add it in Settings.');
    }

    const openai = new OpenAI({ apiKey: settings.openaiApiKey });

    if (!fs.existsSync(audioPath)) {
      throw new Error('Audio file not found');
    }

    const audioFile = fs.createReadStream(audioPath);

    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: audioFile,
      response_format: 'text',
    });

    return transcription;
  });

  ipcMain.handle(
    IPC_CHANNELS.AI_ENHANCE_NOTES,
    async (_event, rawNotes: string, transcript: string, templateSections?: string[]) => {
      const settings = getSettings();
      if (!settings.anthropicApiKey) {
        throw new Error('Anthropic API key is required for note enhancement. Please add it in Settings.');
      }

      const anthropic = new Anthropic({ apiKey: settings.anthropicApiKey });

      const templatePrompt = templateSections && templateSections.length > 0
        ? `\nMeeting template sections: ${templateSections.join(', ')}\nPlease structure the notes using these sections as headers.`
        : '\nAuto-detect the best structure for these meeting notes.';

      const windows = BrowserWindow.getAllWindows();
      const mainWindow = windows[0] || null;

      let fullResponse = '';

      const stream = anthropic.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: `You are an expert meeting notes assistant. Your job is to produce polished, structured meeting notes by combining the user's raw notes with the full transcript. Preserve all specific details, numbers, names, and quotes from the transcript. Use Markdown formatting.`,
        messages: [
          {
            role: 'user',
            content: `Here are my raw notes from a meeting:\n\n${rawNotes || '(No notes taken)'}\n\nHere is the full transcript:\n\n${transcript || '(No transcript available)'}\n${templatePrompt}\n\nPlease produce polished, structured meeting notes that combine both sources.`,
          },
        ],
      });

      stream.on('text', (text) => {
        fullResponse += text;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC_CHANNELS.AI_STREAM_CHUNK, text);
        }
      });

      const finalMessage = await stream.finalMessage();

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.AI_STREAM_DONE);
      }

      return finalMessage.content[0].type === 'text' ? finalMessage.content[0].text : fullResponse;
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.AI_CHAT,
    async (_event, _meetingId: string, message: string, context: { transcript: string; enhancedNotes: string }) => {
      const settings = getSettings();
      if (!settings.anthropicApiKey) {
        throw new Error('Anthropic API key is required for chat. Please add it in Settings.');
      }

      const anthropic = new Anthropic({ apiKey: settings.anthropicApiKey });

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: `You are a helpful meeting assistant. You have access to the full transcript and enhanced notes from a meeting. Answer questions about the meeting accurately and concisely.

Meeting Notes:
${context.enhancedNotes || '(No enhanced notes)'}

Meeting Transcript:
${context.transcript || '(No transcript available)'}`,
        messages: [
          {
            role: 'user',
            content: message,
          },
        ],
      });

      return response.content[0].type === 'text' ? response.content[0].text : '';
    }
  );

  ipcMain.handle(IPC_CHANNELS.AI_GENERATE_TITLE, async (_event, transcript: string) => {
    const settings = getSettings();
    if (!settings.anthropicApiKey) {
      return 'Untitled Meeting';
    }

    const anthropic = new Anthropic({ apiKey: settings.anthropicApiKey });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `Generate a short, descriptive title (max 8 words) for this meeting based on the transcript. Only return the title, nothing else.\n\nTranscript:\n${transcript.slice(0, 2000)}`,
        },
      ],
    });

    return response.content[0].type === 'text' ? response.content[0].text.trim() : 'Untitled Meeting';
  });

  ipcMain.handle(IPC_CHANNELS.AI_DRAFT_EMAIL, async (_event, notes: string, transcript: string) => {
    const settings = getSettings();
    if (!settings.anthropicApiKey) {
      throw new Error('Anthropic API key is required. Please add it in Settings.');
    }

    const anthropic = new Anthropic({ apiKey: settings.anthropicApiKey });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `Based on the following meeting notes and transcript, draft a professional follow-up email. Include key decisions, action items, and next steps.\n\nMeeting Notes:\n${notes}\n\nTranscript:\n${transcript?.slice(0, 3000) || '(No transcript)'}`,
        },
      ],
    });

    return response.content[0].type === 'text' ? response.content[0].text : '';
  });
}
