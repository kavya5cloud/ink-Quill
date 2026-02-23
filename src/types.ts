export interface Post {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
}

export type NewPost = Omit<Post, 'created_at' | 'updated_at'>;
