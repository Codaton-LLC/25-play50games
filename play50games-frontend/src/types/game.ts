export interface Game {
  id: number;
  title: string;
  description: string;
  game_type: 'logic' | 'memory' | 'speed' | 'skill' | 'final';
  game_order: number;
  difficulty: number;
  time_limit: number;
  passing_score: number;
  game_config: Record<string, any>;
  unlock_requirement: number;
  is_unlocked: boolean;
}

export interface GameProgress {
  game_id: number;
  score: number;
  completed: boolean;
  completed_at: string | null;
  attempts: number;
  best_score: number;
  last_played: string;
}

export interface Certificate {
  certificate_id: string;
  user_id: number;
  player_name: string;
  completion_date: string;
  total_score: number;
  rank: string;
  pdf_path?: string;
}

export interface UnlockStatus {
  [gameId: number]: boolean;
}

