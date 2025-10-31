export interface Book {
  id: string;
  title: string;
  code: string;
  last_check_date: string;
  total_changes: number;
  created_at: string;
  updated_at: string;
  imported_at: string;
  language: string;
  book_code_api: string | null;
}

export interface Comment {
  id: string;
  chapter_id: string;
  paragraph_id: string | null;
  user_id: string;
  comment_text: string;
  created_at: string;
  updated_at: string;
}

export interface Chapter {
  id: string;
  book_id: string;
  number: number;
  title: string;
  change_count: number;
  created_at: string;
  updated_at: string;
}

export interface Paragraph {
  id: string;
  chapter_id: string;
  paragraph_number: number;
  base_text: string;
  latest_text: string;
  has_changed: boolean;
  change_history: ChangeHistoryEntry[];
  created_at: string;
  updated_at: string;
}

export interface ChangeHistoryEntry {
  date: string;
  old_text: string;
  new_text: string;
}
