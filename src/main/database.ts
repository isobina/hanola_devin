import BetterSqlite3 from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type { Meeting, Note, ChatMessage, Template } from '../shared/types';

export class Database {
  private db: BetterSqlite3.Database;

  constructor(dbPath: string) {
    this.db = new BetterSqlite3(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meetings (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        ended_at TEXT,
        duration_seconds INTEGER,
        attendees TEXT NOT NULL DEFAULT '[]',
        template_id TEXT,
        tags TEXT NOT NULL DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        meeting_id TEXT NOT NULL UNIQUE,
        raw_content TEXT NOT NULL DEFAULT '',
        enhanced_content TEXT NOT NULL DEFAULT '',
        transcript TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        meeting_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sections TEXT NOT NULL DEFAULT '[]',
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    this.seedDefaultTemplates();
  }

  private seedDefaultTemplates() {
    const count = this.db.prepare('SELECT COUNT(*) as cnt FROM templates WHERE is_default = 1').get() as { cnt: number };
    if (count.cnt > 0) return;

    const defaults: Array<{ name: string; sections: string[] }> = [
      { name: 'Default', sections: ['Summary', 'Key Points', 'Action Items', 'Notes'] },
      { name: 'Customer Discovery', sections: ['About Them', 'Key Takeaways', 'Decision-Making Insights', 'Budget & Timeline', 'Next Steps'] },
      { name: '1-on-1', sections: ['Check-in', 'Discussion Points', 'Action Items', 'Feedback'] },
      { name: 'User Interview', sections: ['Background', 'Tasks Observed', 'Key Quotes', 'Insights', 'Follow-ups'] },
      { name: 'Standup', sections: ['Yesterday', 'Today', 'Blockers'] },
      { name: 'Pitch', sections: ['Company Overview', 'Problem/Solution', 'Traction', 'Ask', 'Questions Asked'] },
    ];

    const insert = this.db.prepare(
      'INSERT INTO templates (id, name, sections, is_default) VALUES (?, ?, ?, 1)'
    );

    const insertMany = this.db.transaction(() => {
      for (const t of defaults) {
        insert.run(uuidv4(), t.name, JSON.stringify(t.sections));
      }
    });

    insertMany();
  }

  // Meetings
  getMeetings(search?: string): Meeting[] {
    let query = 'SELECT * FROM meetings';
    const params: string[] = [];

    if (search && search.trim()) {
      query += ' WHERE title LIKE ? OR attendees LIKE ? OR tags LIKE ?';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY created_at DESC';

    const rows = this.db.prepare(query).all(...params) as Array<Record<string, unknown>>;
    return rows.map(this.parseMeeting);
  }

  getMeeting(id: string): Meeting | null {
    const row = this.db.prepare('SELECT * FROM meetings WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.parseMeeting(row) : null;
  }

  createMeeting(data: {
    title: string;
    template_id?: string;
    attendees?: string[];
    tags?: string[];
  }): Meeting {
    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.prepare(
      'INSERT INTO meetings (id, title, created_at, attendees, template_id, tags) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      id,
      data.title,
      now,
      JSON.stringify(data.attendees || []),
      data.template_id || null,
      JSON.stringify(data.tags || [])
    );

    // Create associated note
    this.db.prepare(
      'INSERT INTO notes (id, meeting_id, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), id, now, now);

    return this.getMeeting(id)!;
  }

  updateMeeting(id: string, data: Record<string, unknown>): Meeting | null {
    const allowed = ['title', 'ended_at', 'duration_seconds', 'attendees', 'template_id', 'tags'];
    const sets: string[] = [];
    const values: unknown[] = [];

    for (const key of allowed) {
      if (key in data) {
        sets.push(`${key} = ?`);
        const val = data[key];
        if (key === 'attendees' || key === 'tags') {
          values.push(JSON.stringify(val));
        } else {
          values.push(val);
        }
      }
    }

    if (sets.length === 0) return this.getMeeting(id);

    values.push(id);
    this.db.prepare(`UPDATE meetings SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return this.getMeeting(id);
  }

  deleteMeeting(id: string): void {
    this.db.prepare('DELETE FROM chat_messages WHERE meeting_id = ?').run(id);
    this.db.prepare('DELETE FROM notes WHERE meeting_id = ?').run(id);
    this.db.prepare('DELETE FROM meetings WHERE id = ?').run(id);
  }

  // Notes
  getNote(meetingId: string): Note | null {
    const row = this.db.prepare('SELECT * FROM notes WHERE meeting_id = ?').get(meetingId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: row.id as string,
      meeting_id: row.meeting_id as string,
      raw_content: row.raw_content as string,
      enhanced_content: row.enhanced_content as string,
      transcript: row.transcript as string,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  }

  saveNote(meetingId: string, data: {
    raw_content?: string;
    enhanced_content?: string;
    transcript?: string;
  }): Note | null {
    const existing = this.getNote(meetingId);
    const now = new Date().toISOString();

    if (!existing) {
      this.db.prepare(
        'INSERT INTO notes (id, meeting_id, raw_content, enhanced_content, transcript, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(
        uuidv4(),
        meetingId,
        data.raw_content || '',
        data.enhanced_content || '',
        data.transcript || '',
        now,
        now
      );
    } else {
      const sets: string[] = ['updated_at = ?'];
      const values: unknown[] = [now];

      if (data.raw_content !== undefined) {
        sets.push('raw_content = ?');
        values.push(data.raw_content);
      }
      if (data.enhanced_content !== undefined) {
        sets.push('enhanced_content = ?');
        values.push(data.enhanced_content);
      }
      if (data.transcript !== undefined) {
        sets.push('transcript = ?');
        values.push(data.transcript);
      }

      values.push(meetingId);
      this.db.prepare(`UPDATE notes SET ${sets.join(', ')} WHERE meeting_id = ?`).run(...values);
    }

    return this.getNote(meetingId);
  }

  // Chat Messages
  getChatMessages(meetingId: string): ChatMessage[] {
    const rows = this.db.prepare(
      'SELECT * FROM chat_messages WHERE meeting_id = ? ORDER BY created_at ASC'
    ).all(meetingId) as Array<Record<string, unknown>>;

    return rows.map(row => ({
      id: row.id as string,
      meeting_id: row.meeting_id as string,
      role: row.role as 'user' | 'assistant',
      content: row.content as string,
      created_at: row.created_at as string,
    }));
  }

  saveChatMessage(meetingId: string, role: string, content: string): ChatMessage {
    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.prepare(
      'INSERT INTO chat_messages (id, meeting_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, meetingId, role, content, now);

    return { id, meeting_id: meetingId, role: role as 'user' | 'assistant', content, created_at: now };
  }

  // Templates
  getTemplates(): Template[] {
    const rows = this.db.prepare('SELECT * FROM templates ORDER BY is_default DESC, name ASC').all() as Array<Record<string, unknown>>;
    return rows.map(row => ({
      id: row.id as string,
      name: row.name as string,
      sections: JSON.parse(row.sections as string) as string[],
      is_default: (row.is_default as number) === 1,
      created_at: row.created_at as string,
    }));
  }

  saveTemplate(data: {
    id?: string;
    name: string;
    sections: string[];
    is_default?: boolean;
  }): Template {
    const id = data.id || uuidv4();
    const now = new Date().toISOString();

    if (data.id) {
      this.db.prepare(
        'UPDATE templates SET name = ?, sections = ? WHERE id = ? AND is_default = 0'
      ).run(data.name, JSON.stringify(data.sections), data.id);
    } else {
      this.db.prepare(
        'INSERT INTO templates (id, name, sections, is_default, created_at) VALUES (?, ?, ?, 0, ?)'
      ).run(id, data.name, JSON.stringify(data.sections), now);
    }

    const row = this.db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as Record<string, unknown>;
    return {
      id: row.id as string,
      name: row.name as string,
      sections: JSON.parse(row.sections as string) as string[],
      is_default: (row.is_default as number) === 1,
      created_at: row.created_at as string,
    };
  }

  deleteTemplate(id: string): void {
    this.db.prepare('DELETE FROM templates WHERE id = ? AND is_default = 0').run(id);
  }

  private parseMeeting(row: Record<string, unknown>): Meeting {
    return {
      id: row.id as string,
      title: row.title as string,
      created_at: row.created_at as string,
      ended_at: (row.ended_at as string) || null,
      duration_seconds: (row.duration_seconds as number) || null,
      attendees: JSON.parse((row.attendees as string) || '[]') as string[],
      template_id: (row.template_id as string) || null,
      tags: JSON.parse((row.tags as string) || '[]') as string[],
    };
  }
}
