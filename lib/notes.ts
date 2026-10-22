import type { Note } from '@/lib/types';

// A private (blurred) note is marked by its department, so no database change is needed.
export const PRIVATE = 'Private';
export const isPrivate = (n: Pick<Note, 'department'>) => n.department === PRIVATE;
