import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  FileText, 
  Settings, 
  ChevronRight, 
  Sparkles,
  Trash2,
  Clock,
  Edit3,
  ArrowLeft,
  Save,
  Send,
  Wand2
} from 'lucide-react';
import Markdown from 'react-markdown';
import { Post, NewPost } from './types';
import * as gemini from './services/gemini';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

const QuillIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="1.5" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="m14.5 12.5-8 8L3 21l.5-3.5 8-8L14.5 12.5Z" />
    <path d="m11.5 9.5 3-3 4.5 1.5 2-2-6-6-2 2 1.5 4.5-3 3" />
    <path d="M14.5 12.5 18 9" />
    <path d="m11.5 9.5-3.5 3.5" />
  </svg>
);

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

const AdSenseUnit = ({ side }: { side: 'left' | 'right' }) => {
  const clientId = (import.meta as any).env.VITE_ADSENSE_CLIENT_ID;
  const slot = side === 'left' ? (import.meta as any).env.VITE_ADSENSE_SLOT_LEFT : (import.meta as any).env.VITE_ADSENSE_SLOT_RIGHT;
  const isConfigured = clientId && clientId.indexOf('VITE_ADSENSE_CLIENT_ID') === -1;
  const hasSlot = slot && slot.indexOf('VITE_ADSENSE_SLOT') === -1;
  
  useEffect(() => {
    if (isConfigured && hasSlot) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        console.error("AdSense error:", e);
      }
    }
  }, [isConfigured, hasSlot]);

  if (!isConfigured) {
    return (
      <div className="bg-zinc-50 border border-black/5 rounded-2xl p-4 h-[600px] flex flex-col items-center justify-center text-center gap-4">
        <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-300">
          <Sparkles size={20} />
        </div>
        <div className="text-xs text-zinc-400 font-medium">
          AdSense Not Configured<br/>
          <span className="opacity-50 text-[10px]">Add VITE_ADSENSE_CLIENT_ID</span>
        </div>
      </div>
    );
  }

  if (!hasSlot) {
    return (
      <div className="bg-emerald-50/30 border border-emerald-500/10 rounded-2xl p-4 h-[600px] flex flex-col items-center justify-center text-center gap-4">
        <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
          <Clock size={20} />
        </div>
        <div className="text-xs text-emerald-700 font-medium">
          Verification Active<br/>
          <span className="opacity-60 text-[10px]">Waiting for Ad Units (Slots)</span>
        </div>
        <p className="text-[10px] text-emerald-600/70 px-4">
          Google is reviewing your site. Once approved, you can create "Display Ads" and add the Slot IDs.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-black/5 rounded-2xl overflow-hidden min-h-[600px]">
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={clientId}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
};

const AdColumn = ({ side }: { side: 'left' | 'right' }) => (
  <div className={cn(
    "hidden xl:flex flex-col gap-4 w-48 sticky top-24 h-fit",
    side === 'left' ? "mr-8" : "ml-8"
  )}>
    <div className="text-[10px] uppercase tracking-widest font-bold text-zinc-300 mb-2">Advertisement</div>
    <AdSenseUnit side={side} />
  </div>
);

export default function App() {
  console.log("Ink & Quill App Rendering");
  const [isEntered, setIsEntered] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [editingPost, setEditingPost] = useState<Post | NewPost | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const eligiblePublishedPosts = posts.filter((post) => {
    if (post.status !== 'published') return false;
    const contentLength = (post.content || '').trim().length;
    const excerptLength = (post.excerpt || '').trim().length;
    return contentLength >= 300 || excerptLength >= 120;
  });
  const shouldShowAds = view === 'list' && eligiblePublishedPosts.length >= 3;

  useEffect(() => {
    if (isEntered) {
      fetchCurrentUser().then(() => {
        fetchPosts();
      });
    }
  }, [isEntered]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const user = await res.json();
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    }
  };

  const fetchPosts = async () => {
    const res = await fetch('/api/posts', { credentials: 'include' });
    const data = await res.json();
    setPosts(data);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });
      if (!res.ok) {
        const raw = await res.text();
        let message = '';
        try {
          const parsed = JSON.parse(raw);
          message = parsed?.error || '';
        } catch {
          message = raw;
        }
        alert(`Authentication failed (${res.status})${message ? `: ${message}` : ''}`);
        return;
      }
      const user = await res.json();
      setCurrentUser(user);
      setAuthPassword('');
      await fetchPosts();
    } catch (e) {
      console.error(e);
      alert('Authentication error. Check console for details.');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setCurrentUser(null);
    setPosts([]);
    setEditingPost(null);
    setView('list');
  };

  const handleCreate = () => {
    const newPost: NewPost = {
      id: crypto.randomUUID(),
      title: '',
      content: '',
      excerpt: '',
      status: 'draft'
    };
    setEditingPost(newPost);
    setView('editor');
  };

  const handleEdit = (post: Post) => {
    setEditingPost(post);
    setView('editor');
  };

  const handleSave = async (statusOverride?: 'draft' | 'published') => {
    if (!editingPost) return;
    setIsSaving(true);
    try {
      const postToSave = {
        ...editingPost,
        status: statusOverride || editingPost.status
      };
      
      const method = posts.find(p => p.id === postToSave.id) ? 'PUT' : 'POST';
      const url = method === 'PUT' ? `/api/posts/${postToSave.id}` : '/api/posts';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(postToSave)
      });
      
      if (res.ok) {
        await fetchPosts();
        setView('list');
        setEditingPost(null);
      } else {
        const raw = await res.text();
        let message = '';
        try {
          const parsed = JSON.parse(raw);
          message = parsed?.error || '';
        } catch {
          message = raw;
        }
        const fallback = statusOverride === 'published' ? 'Failed to publish story.' : 'Failed to save story.';
        alert(`${fallback} (${res.status})${message ? `: ${message}` : ''}`);
        console.error("Save failed:", { status: res.status, message });
      }
    } catch (e) {
      console.error("Save request error:", e);
      alert("Could not reach server. Check your deployment/API setup.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    console.log("Deleting post:", id);
    if (!confirm('Are you sure you want to delete this post?')) return;
    try {
      const res = await fetch(`/api/posts/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        console.log("Post deleted successfully");
        await fetchPosts();
      } else {
        const error = await res.json();
        console.error("Failed to delete post:", error);
        alert("Failed to delete post: " + (error.error || "Unknown error"));
      }
    } catch (e) {
      console.error("Error deleting post:", e);
      alert("Error deleting post. Check console for details.");
    }
  };

  const handleAIOutline = async () => {
    if (!editingPost?.title) {
      alert('Please enter a title first');
      return;
    }
    setIsGenerating(true);
    try {
      const outline = await gemini.generateOutline(editingPost.title);
      setEditingPost(prev => prev ? { ...prev, content: prev.content + '\n\n' + outline } : null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePolish = async () => {
    if (!editingPost?.content) {
      alert('Add some content first to polish.');
      return;
    }
    setIsPolishing(true);
    try {
      const polished = await gemini.polishContent(editingPost.content);
      setEditingPost(prev => prev ? { ...prev, content: polished } : null);
    } catch (e) {
      console.error(e);
      alert('Failed to polish content.');
    } finally {
      setIsPolishing(false);
    }
  };

  if (!isEntered) {
    return (
      <div className="min-h-screen bg-[#FDFCFB] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl w-full text-center space-y-12"
        >
          <div className="space-y-6">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="w-20 h-20 bg-black rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-black/20"
            >
              <QuillIcon className="text-white w-10 h-10" />
            </motion.div>
            <h1 className="text-7xl font-serif font-bold tracking-tighter">Ink & Quill</h1>
            <p className="text-xl text-zinc-500 font-serif italic">Where thoughts find their form.</p>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-zinc-200 to-transparent w-full" />

          <div className="space-y-8">
            <p className="text-zinc-400 max-w-md mx-auto leading-relaxed">
              A minimalist space for writers to craft, refine, and publish their stories with the help of AI.
            </p>
            <button 
              onClick={() => setIsEntered(true)}
              className="group relative inline-flex items-center gap-3 bg-black text-white px-10 py-4 rounded-full text-lg font-medium hover:bg-zinc-800 transition-all hover:scale-105 active:scale-95"
            >
              Enter the Workspace
              <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <div className="pt-12 grid grid-cols-2 gap-12 opacity-40 grayscale max-w-sm mx-auto">
             <div className="flex flex-col items-center gap-2">
               <Sparkles size={20} />
               <span className="text-[10px] uppercase tracking-widest font-bold">AI Powered</span>
             </div>
             <div className="flex flex-col items-center gap-2">
               <Send size={20} />
               <span className="text-[10px] uppercase tracking-widest font-bold">One-Click Publish</span>
             </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-black/5 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('list')}>
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <QuillIcon className="text-white w-5 h-5" />
            </div>
            <span className="font-serif text-xl font-bold tracking-tight">Ink & Quill</span>
          </div>
          <div className="flex items-center gap-6">
            <form onSubmit={handleAuthSubmit} className="flex items-center gap-2 text-xs flex-wrap justify-end">
              <input
                type="email"
                placeholder="you@example.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="px-2 py-1 text-xs border border-black/10 rounded-md bg-zinc-50"
              />
              <input
                type="password"
                placeholder="Password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="px-2 py-1 text-xs border border-black/10 rounded-md bg-zinc-50"
              />
              <button
                type="submit"
                className="px-3 py-1 rounded-full bg-zinc-900 text-white text-[11px] font-semibold"
              >
                {authMode === 'login' ? 'Log In' : 'Sign Up'}
              </button>
              <button
                type="button"
                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                className="text-[11px] text-zinc-400 hover:text-zinc-700"
              >
                {authMode === 'login' ? 'New here?' : 'Have an account?'}
              </button>
              {currentUser && (
                <div className="flex items-center gap-2 ml-3">
                  <span className="text-[11px] text-zinc-500 max-w-[140px] truncate">
                    {currentUser.email}
                  </span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="text-[11px] text-zinc-400 hover:text-red-600"
                  >
                    Logout
                  </button>
                </div>
              )}
            </form>

            {view === 'list' ? (
              <button 
                onClick={handleCreate}
                className="bg-black text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 hover:bg-zinc-800 transition-colors"
              >
                <Plus size={16} />
                New Story
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setView('list')}
                  className="text-zinc-500 hover:text-black transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleSave('draft')}
                  disabled={isSaving}
                  className="bg-zinc-100 text-zinc-900 px-6 py-2 rounded-full text-sm font-medium flex items-center gap-2 hover:bg-zinc-200 transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Draft'}
                </button>
                <button 
                  onClick={() => handleSave('published')}
                  disabled={isSaving}
                  className="bg-black text-white px-6 py-2 rounded-full text-sm font-medium flex items-center gap-2 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  <Send size={16} />
                  {isSaving ? 'Publishing...' : 'Publish'}
                </button>
                {editingPost && posts.some(p => p.id === editingPost.id) && (
                  <button 
                    onClick={async () => {
                      await handleDelete(editingPost.id);
                      setView('list');
                    }}
                    className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
                    title="Delete Story"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-12 flex justify-center">
        {shouldShowAds && <AdColumn side="left" />}
        
        <div className="flex-1 max-w-3xl w-full">
          <AnimatePresence mode="wait">
            {view === 'list' ? (
              <motion.div
                key="list"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-12"
              >
                <div className="flex flex-col gap-2">
                  <h1 className="text-5xl font-serif font-bold tracking-tight">Your Stories</h1>
                  <p className="text-zinc-500">Manage and craft your thoughts.</p>
                </div>

                <div className="grid gap-6">
                  {posts.length === 0 ? (
                    <div className="border-2 border-dashed border-zinc-200 rounded-3xl p-20 text-center flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center text-zinc-400">
                        <FileText size={32} />
                      </div>
                      <div>
                        <h3 className="text-lg font-medium">No stories yet</h3>
                        <p className="text-zinc-500 text-sm">Start your writing journey today.</p>
                      </div>
                      <button 
                        onClick={handleCreate}
                        className="mt-4 bg-black text-white px-6 py-2 rounded-full text-sm font-medium"
                      >
                        Write your first story
                      </button>
                    </div>
                  ) : (
                    posts.map((post) => (
                      <motion.div
                        key={post.id}
                        layoutId={post.id}
                        onClick={() => handleEdit(post)}
                        className="group bg-white border border-black/5 rounded-3xl p-8 hover:shadow-xl hover:shadow-black/5 transition-all cursor-pointer relative overflow-hidden"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <span className={cn(
                              "text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-md",
                              post.status === 'published' ? "bg-emerald-50 text-emerald-600" : "bg-zinc-100 text-zinc-500"
                            )}>
                              {post.status}
                            </span>
                            <span className="text-xs text-zinc-400 flex items-center gap-1">
                              <Clock size={12} />
                              {new Date(post.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(post.id);
                            }}
                            className="opacity-40 group-hover:opacity-100 p-2 hover:bg-red-50 hover:text-red-600 rounded-full transition-all text-zinc-400"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <h2 className="text-2xl font-serif font-bold mb-3 group-hover:text-zinc-700 transition-colors">
                          {post.title || 'Untitled Story'}
                        </h2>
                        <p className="text-zinc-500 line-clamp-2 leading-relaxed">
                          {post.excerpt || post.content.substring(0, 150) || 'No content yet...'}
                        </p>
                        <div className="mt-6 flex items-center text-sm font-medium text-black opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0">
                          Read & Edit <ChevronRight size={16} />
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="editor"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full"
              >
                <div className="space-y-8">
                  <input
                    type="text"
                    placeholder="Title"
                    value={editingPost?.title || ''}
                    onChange={(e) => setEditingPost(prev => prev ? { ...prev, title: e.target.value } : null)}
                    className="w-full text-5xl font-serif font-bold bg-transparent border-none focus:ring-0 placeholder:text-zinc-200 outline-none"
                  />

                  <div className="flex items-center gap-2 border-y border-black/5 py-4">
                    <button 
                      onClick={handleAIOutline}
                      disabled={isGenerating}
                      className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-black transition-colors disabled:opacity-50"
                    >
                      <Sparkles size={14} className="text-violet-500" />
                      {isGenerating ? 'Generating Outline...' : 'Generate AI Outline'}
                    </button>
                    <div className="w-px h-4 bg-zinc-200 mx-2" />
                    <button 
                      type="button"
                      onClick={handlePolish}
                      disabled={isPolishing}
                      className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-black transition-colors disabled:opacity-50"
                    >
                      <Wand2 size={14} />
                      {isPolishing ? 'Polishing...' : 'Polish Content'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-8">
                    <textarea
                      placeholder="Start writing your story..."
                      value={editingPost?.content || ''}
                      onChange={(e) => setEditingPost(prev => prev ? { ...prev, content: e.target.value } : null)}
                      className="w-full min-h-[500px] text-lg leading-relaxed bg-transparent border-none focus:ring-0 placeholder:text-zinc-200 outline-none resize-none font-sans"
                    />
                    
                    {editingPost?.content && (
                      <div className="border-t border-black/5 pt-8">
                        <div className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-6">Preview</div>
                        <div className="markdown-body">
                          <Markdown>{editingPost.content}</Markdown>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {shouldShowAds && <AdColumn side="right" />}
      </main>

      <footer className="py-12 border-t border-black/5 bg-zinc-50/50">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-50">
            <Edit3 size={16} />
            <span className="font-serif font-bold">Ink & Quill</span>
          </div>
          <div className="text-xs text-zinc-400 font-medium uppercase tracking-widest">
            Crafted for writers, powered by AI.
          </div>
        </div>
      </footer>
    </div>
  );
}
