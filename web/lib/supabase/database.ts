// Row types for supabase/migrations/0001_init.sql. Change both together.

export type ProfileRow = {
  id: string;
  goal: string;
  level: string;
  equipment: string[];
  weight_kg: number;
  height_cm: number;
  voice_on: boolean;
  completed_at: string;
  updated_at: string;
};

export type SessionRow = {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_ms: number;
  calories: number;
  avg_form_score: number | null;
};

export type SetRow = {
  id: string;
  session_id: string;
  user_id: string;
  exercise: string;
  set_number: number;
  reps: number;
  hold_seconds: number;
  load_kg: number;
  duration_ms: number;
  avg_form_score: number | null;
  good_reps: number;
  scored_reps: number;
  missed: number;
  calories: number;
  form_issues: Record<string, number>;
  created_at: string;
};

export type CheckinRow = {
  id: string;
  user_id: string;
  session_id: string | null;
  sleep: number;
  energy: number;
  soreness: number;
  choice: string;
  created_at: string;
};

type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, "id" | "goal" | "level" | "weight_kg" | "height_cm">;
      workout_sessions: Table<SessionRow, "id" | "user_id" | "started_at">;
      exercise_sets: Table<SetRow, "id" | "session_id" | "user_id" | "exercise" | "set_number">;
      checkins: Table<CheckinRow, "id" | "user_id" | "sleep" | "energy" | "soreness" | "choice">;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
