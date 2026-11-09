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

export type NutritionProfileRow = {
  user_id: string;
  age: number;
  sex: string;
  activity: string;
  diet_type: string;
  allergies: string[];
  cuisine: string;
  target_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  updated_at: string;
};

export type MealRow = {
  id: string;
  user_id: string;
  eaten_at: string;
  meal_type: string;
  source: string;
  created_at: string;
};

export type MealItemRow = {
  id: string;
  meal_id: string;
  user_id: string;
  name: string;
  food_id: string | null;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  data_source: string;
};

export type DietPlanRow = { user_id: string; plan: unknown; created_at: string };

export type CoachMessageRow = { id: string; user_id: string; role: string; content: string; created_at: string };

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
      nutrition_profiles: Table<
        NutritionProfileRow,
        "age" | "sex" | "activity" | "diet_type" | "target_kcal" | "protein_g" | "carbs_g" | "fat_g"
      >;
      meals: Table<MealRow, "meal_type" | "source">;
      meal_items: Table<
        MealItemRow,
        "meal_id" | "user_id" | "name" | "grams" | "kcal" | "protein" | "carbs" | "fat" | "data_source"
      >;
      diet_plans: Table<DietPlanRow, "plan">;
      coach_messages: Table<CoachMessageRow, "role" | "content">;
    };
    Views: Record<string, never>;
    Functions: {
      consume_ai_quota: { Args: { request_kind: string }; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
