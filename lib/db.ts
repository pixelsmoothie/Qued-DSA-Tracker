import Database from '@tauri-apps/plugin-sql';
import striversData from '../strivers_sde_sheet.json';

let dbInstance: Database | null = null;
let currentDbUserId: string | null = null;

export async function getDb(): Promise<Database> {
  const userId = typeof window !== 'undefined' ? (localStorage.getItem("duel_user_id") || "guest") : "guest";

  // If user changed or no instance, reload
  if (dbInstance && currentDbUserId === userId) return dbInstance;

  if (dbInstance) {
    try { await dbInstance.close(); } catch (e) { }
  }

  currentDbUserId = userId;
  dbInstance = await Database.load(`sqlite:qued_vault_${userId.substring(0, 8)}.db`);
  return dbInstance;
}

export async function initDb() {
  const db = await getDb();

  // Create tables
  await db.execute(`
    CREATE TABLE IF NOT EXISTS missions (
      id INTEGER PRIMARY KEY,
      topic TEXT,
      topic_id INTEGER,
      name TEXT,
      leetcode_url TEXT,
      youtube_url TEXT,
      difficulty TEXT,
      constraints TEXT,
      test_cases TEXT,
      cpp_main TEXT,
      description TEXT,
      status TEXT DEFAULT 'unsolved'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS daily_schedule (
      date TEXT PRIMARY KEY,
      q1_id INTEGER,
      q2_id INTEGER,
      q1_completed BOOLEAN DEFAULT 0,
      q2_completed BOOLEAN DEFAULT 0,
      notes TEXT
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS interviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mission_id INTEGER,
      date TEXT,
      status TEXT,
      score INTEGER,
      feedback TEXT,
      transcript TEXT,
      duration_seconds INTEGER
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT, -- 'report', 'note', 'resource'
      title TEXT,
      content TEXT,
      metadata TEXT, -- JSON for extra data
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS system_state (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS interview_drafts (
      mission_id INTEGER PRIMARY KEY,
      code TEXT,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Auto-migration: Add test_cases if missing
  await db.execute('ALTER TABLE missions ADD COLUMN test_cases TEXT').catch(() => { });
  await db.execute('ALTER TABLE missions ADD COLUMN cpp_main TEXT').catch(() => { });
  await db.execute('ALTER TABLE missions ADD COLUMN description TEXT').catch(() => { });

  // Check if missions are already loaded
  const countResult: any = await db.select('SELECT COUNT(*) as count FROM missions');
  const count = countResult[0].count;

  // Debug: check columns
  const tableInfo: any[] = await db.select('PRAGMA table_info(missions)');
  console.log('Missions table schema:', tableInfo.map(c => c.name));
  if (count === 0) {
    console.log('Populating missions database from JSON...');
    let currentTopicId = 1;
    for (const topicBlock of striversData.topics) {
      for (const question of topicBlock.questions) {
        await db.execute(
          `INSERT INTO missions (id, topic, topic_id, name, leetcode_url, youtube_url, difficulty, constraints, test_cases, cpp_main, description, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'unsolved')`,
          [
            question.id,
            topicBlock.topic,
            currentTopicId,
            question.name,
            question.leetcode_url || '',
            question.youtube_url || '',
            question.difficulty,
            JSON.stringify(question.constraints || []),
            JSON.stringify(question.test_cases || []),
            question.cpp_main || '',
            question.description || ''
          ]
        );
      }
      currentTopicId++;
    }
  } else {
    // Sync Metadata (links, test cases) for existing rows without resetting status
    console.log('Neural Sync: Verifying mission integrity from manifest...');
    for (const topicBlock of striversData.topics) {
      for (const question of topicBlock.questions) {
        await db.execute(
          `UPDATE missions SET 
            leetcode_url = $1, 
            youtube_url = $2, 
            constraints = $3, 
            test_cases = $4,
            cpp_main = $5,
            description = $6
           WHERE id = $7`,
          [
            question.leetcode_url || '',
            question.youtube_url || '',
            JSON.stringify(question.constraints || []),
            JSON.stringify(question.test_cases || []),
            question.cpp_main || '',  // Re-injecting unedited boilerplate
            question.description || '',
            Number(question.id)
          ]
        );
      }
    }
  }
  console.log('Database initialized and synced!');
}

export function getCurrentDayKey() {
  // Production: Standard 24h rotation
  return new Date().toISOString().split('T')[0];
}

export async function generateDailyMissions() {
  const db = await getDb();

  const today = getCurrentDayKey();
  const schedule: any[] = await db.select('SELECT * FROM daily_schedule WHERE date = $1', [today]);

  if (schedule.length > 0) {
    return schedule[0];
  }

  // Generate new missions based on schedule index to ensure NEW questions every day
  const scheduleCountRes: any[] = await db.select('SELECT COUNT(*) as count FROM daily_schedule');
  const offset = Number(scheduleCountRes[0].count) * 2;

  const questions: any[] = await db.select(`
    SELECT id FROM missions 
    ORDER BY 
      topic_id ASC, 
      CASE difficulty 
        WHEN 'Easy' THEN 1 
        WHEN 'Medium' THEN 2 
        WHEN 'Hard' THEN 3 
        ELSE 4 
      END ASC, 
      id ASC 
    LIMIT 2 OFFSET $1
  `, [offset]);

  if (questions.length < 2) {
    // Edge case: less than 2 left
    console.warn("Less than 2 unsolved missions left!");
    return null; // Handle this in UI (victory screen)
  }

  const q1_id = questions[0].id;
  const q2_id = questions[1].id;

  await db.execute(
    'INSERT INTO daily_schedule (date, q1_id, q2_id, q1_completed, q2_completed, notes) VALUES ($1, $2, $3, 0, 0, "")',
    [today, q1_id, q2_id]
  );

  return { date: today, q1_id, q2_id, q1_completed: 0, q2_completed: 0, notes: "" };
}

export async function getMissionDetails(id: number) {
  const db = await getDb();
  const result: any[] = await db.select('SELECT * FROM missions WHERE id = $1', [id]);
  if (result.length > 0) {
    if (typeof result[0].constraints === 'string') {
      result[0].constraints = JSON.parse(result[0].constraints);
    }
    if (typeof result[0].test_cases === 'string') {
      result[0].test_cases = JSON.parse(result[0].test_cases);
    }
    return result[0];
  }
  return null;
}

export async function markCompleted(date: string, q1: boolean, q2: boolean) {
  const db = await getDb();
  const q1Int = q1 ? 1 : 0;
  const q2Int = q2 ? 1 : 0;
  await db.execute('UPDATE daily_schedule SET q1_completed = $1, q2_completed = $2 WHERE date = $3', [q1Int, q2Int, date]);

  const res: any[] = await db.select('SELECT q1_id, q2_id FROM daily_schedule WHERE date = $1', [date]);
  if (res.length > 0) {
    await db.execute('UPDATE missions SET status = $1 WHERE id = $2', [q1 ? "solved" : "unsolved", res[0].q1_id]);
    await db.execute('UPDATE missions SET status = $1 WHERE id = $2', [q2 ? "solved" : "unsolved", res[0].q2_id]);
  }
}

export async function resetDatabase() {
  const db = await getDb();
  console.log("Deep Reset: Purging all user data...");
  await db.execute('DELETE FROM missions');
  await db.execute('DELETE FROM daily_schedule');
  await db.execute('DELETE FROM interviews');
  await db.execute('DELETE FROM inventory');
  await db.execute('DELETE FROM system_state');
  await db.execute('DELETE FROM interview_drafts');

  console.log('Re-injecting fresh missions from JSON...');
  let currentTopicId = 1;
  for (const topicBlock of striversData.topics) {
    for (const question of topicBlock.questions) {
      await db.execute(
        `INSERT INTO missions (id, topic, topic_id, name, leetcode_url, youtube_url, difficulty, constraints, test_cases, cpp_main, description, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'unsolved')`,
        [
          question.id,
          topicBlock.topic,
          currentTopicId,
          question.name,
          question.leetcode_url || '',
          question.youtube_url || '',
          question.difficulty,
          JSON.stringify(question.constraints || []),
          JSON.stringify(question.test_cases || []),
          question.cpp_main || '',
          question.description || ''
        ]
      );
    }
    currentTopicId++;
  }
  console.log("Neural Restoration Complete.");
}

export async function getProgressStats() {
  const db = await getDb();

  // Difficulty stats
  const diffStats: any[] = await db.select(`
      SELECT 
        difficulty, 
        COUNT(*) as total, 
        SUM(CASE WHEN status = 'solved' THEN 1 ELSE 0 END) as solved 
      FROM missions 
      GROUP BY difficulty
    `);

  // Topic stats
  let topicResults: any[] = [];
  try {
    topicResults = await db.select(`
        SELECT 
          topic, 
          COUNT(*) as total, 
          SUM(status == 'solved') as solved 
        FROM missions 
        GROUP BY topic
      `);
  } catch (e) {
    console.error("Topic query failed:", e);
  }

  let easyTotal = 0, easySolved = 0;
  let mediumTotal = 0, mediumSolved = 0;
  let hardTotal = 0, hardSolved = 0;

  diffStats.forEach((row) => {
    const t = Number(row.total);
    const s = Number(row.solved || 0);
    if (row.difficulty === 'Easy') { easyTotal = t; easySolved = s; }
    else if (row.difficulty === 'Medium') { mediumTotal = t; mediumSolved = s; }
    else if (row.difficulty === 'Hard') { hardTotal = t; hardSolved = s; }
  });

  const dayCountRes: any[] = await db.select(`SELECT COUNT(*) as count FROM daily_schedule`);
  const days_elapsed = Number(dayCountRes[0]?.count || 0);

  return {
    days_elapsed,
    total: easyTotal + mediumTotal + hardTotal,
    solved: easySolved + mediumSolved + hardSolved,
    easy: { total: easyTotal, solved: easySolved },
    medium: { total: mediumTotal, solved: mediumSolved },
    hard: { total: hardTotal, solved: hardSolved },
    topics: (topicResults || []).map(t => ({
      name: String(t.topic || "Unknown"),
      total: Number(t.total || 0),
      solved: Number(t.solved || 0)
    }))
  };
}

export async function getNotes(date: string) {
  const db = await getDb();
  const result: any[] = await db.select('SELECT notes FROM daily_schedule WHERE date = $1', [date]);
  if (result.length > 0) {
    return result[0].notes;
  }
  return "";
}

export async function saveNotes(date: string, notes: string) {
  const db = await getDb();
  await db.execute('UPDATE daily_schedule SET notes = $1 WHERE date = $2', [notes, date]);
}
export async function getWeeklyTestQuestions() {
  const db = await getDb();

  // Get the current day count to define the window
  const dayCountRes: any[] = await db.select(`SELECT COUNT(*) as count FROM daily_schedule`);
  const dayCount = Number(dayCountRes[0]?.count || 0);

  // Total questions in a 7-day period = 14
  // We want the questions from the most recent 'week' block.
  const results: any[] = await db.select(`
        SELECT id FROM (
            SELECT q1_id as id, ROWID FROM daily_schedule WHERE q1_completed = 1
            UNION ALL
            SELECT q2_id as id, ROWID FROM daily_schedule WHERE q2_completed = 1
        ) 
        ORDER BY ROWID DESC
        LIMIT 14
    `);

  if (results.length === 0) return [];

  // Shuffle and pick 5 random questions from this week's completions
  const shuffled = results.sort(() => 0.5 - Math.random());
  const selectedIds = shuffled.slice(0, 5).map(r => r.id);

  const questions = [];
  for (const id of selectedIds) {
    const detail = await getMissionDetails(id);
    if (detail) questions.push(detail);
  }
  return questions;
}

export async function getInterviewDraft(missionId: number) {
  const db = await getDb();
  const res: any[] = await db.select('SELECT code FROM interview_drafts WHERE mission_id = $1', [missionId]);
  return res.length > 0 ? res[0].code : null;
}

export async function saveInterviewDraft(missionId: number, code: string) {
  const db = await getDb();
  await db.execute(`
        INSERT INTO interview_drafts (mission_id, code) 
        VALUES ($1, $2)
        ON CONFLICT(mission_id) DO UPDATE SET code = $2, last_updated = CURRENT_TIMESTAMP
    `, [missionId, code]);
}

// ── Inventory Management ──────────────────────────────────────────────────

export async function addToInventory(type: 'report' | 'note' | 'resource', title: string, content: string, metadata: any = {}) {
  const db = await getDb();
  await db.execute(
    'INSERT INTO inventory (type, title, content, metadata) VALUES ($1, $2, $3, $4)',
    [type, title, content, JSON.stringify(metadata)]
  );
}

export async function getInventory(type?: string) {
  const db = await getDb();
  if (type) {
    return await db.select('SELECT * FROM inventory WHERE type = $1 ORDER BY created_at DESC', [type]);
  }
  return await db.select('SELECT * FROM inventory ORDER BY created_at DESC');
}

export async function deleteFromInventory(id: number) {
  const db = await getDb();
  await db.execute('DELETE FROM inventory WHERE id = $1', [id]);
}

// ── System State / Chill Zone ──────────────────────────────────────────────

export async function getSystemState(key: string) {
  const db = await getDb();
  const res: any[] = await db.select('SELECT value FROM system_state WHERE key = $1', [key]);
  return res.length > 0 ? res[0].value : null;
}

export async function setSystemState(key: string, value: string) {
  const db = await getDb();
  await db.execute(
    'INSERT INTO system_state (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2',
    [key, value]
  );
}
export async function hasUnfinishedDailyTasks() {
  const db = await getDb();
  const today = getCurrentDayKey();
  const schedule: any[] = await db.select('SELECT q1_completed, q2_completed FROM daily_schedule WHERE date = $1', [today]);
  
  if (schedule.length === 0) return true; // Day not started yet
  return (Number(schedule[0].q1_completed) === 0) || (Number(schedule[0].q2_completed) === 0);
}
