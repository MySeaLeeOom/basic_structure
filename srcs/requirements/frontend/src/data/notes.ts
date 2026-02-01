export interface Note {
  id: number;        // Matches PostgreSQL SERIAL type
  title: string;
  content: string;
}
