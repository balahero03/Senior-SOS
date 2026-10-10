// frontend/src/features/community/pages/FeedPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../../../components/layout/Navbar';
import useAuthStore from '../../../stores/authStore';
import { getPosts, createPost, reactToPost, getComments, addComment, deletePost } from '../api';

// ─── Post Card ────────────────────────────────────────────────────────────────
function PostCard({ post, currentUserId, onReact, onDelete }) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  const authorInitial = (post.author?.name || 'U').charAt(0).toUpperCase();
  const isOwner = post.authorId === currentUserId;

  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const data = await getComments(post._id);
      setComments(data.comments || []);
    } catch {
      // silently fail
    } finally {
      setLoadingComments(false);
    }
  }, [post._id]);

  const handleToggleComments = () => {
    if (!showComments) loadComments();
    setShowComments(v => !v);
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await addComment(post._id, commentText.trim());
      const newComment = res?.comment || res;
      if (newComment) {
        setComments(prev => [...prev, newComment]);
        setCommentText('');
      }
    } catch (err) {
      console.error('Failed to add comment:', err);
      alert(err?.response?.data?.error?.message || 'Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Post Header */}
      <div className="flex items-start justify-between p-5 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm">
            {authorInitial}
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">{post.author?.name || 'Unknown'}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                post.author?.role === 'ALUMNI' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {post.author?.role}
              </span>
              <span className="text-xs text-slate-400">
                {new Date(post.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </span>
              {post.visibility === 'CONNECTIONS' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">Connections only</span>
              )}
            </div>
          </div>
        </div>
        {isOwner && (
          <button
            onClick={() => onDelete(post._id)}
            className="text-slate-400 hover:text-red-500 transition-colors text-lg leading-none"
            title="Delete post"
          >
            ×
          </button>
        )}
      </div>

      {/* Content */}
      <div className="px-5 pb-4">
        <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {post.tags.map(tag => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 px-5 py-3 border-t border-slate-100">
        <button
          onClick={() => onReact(post._id, 'LIKE')}
          className={`flex items-center gap-1.5 text-sm transition-colors group ${
            post.userReaction === 'LIKE'
              ? 'text-blue-600 font-semibold'
              : 'text-slate-500 hover:text-blue-600'
          }`}
        >
          <span className="text-base group-hover:scale-110 transition-transform">👍</span>
          <span>Like</span>
          {post.reactions?.LIKE > 0 && (
            <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full font-bold ml-0.5">
              {post.reactions.LIKE}
            </span>
          )}
        </button>
        <button
          onClick={() => onReact(post._id, 'HELPFUL')}
          className={`flex items-center gap-1.5 text-sm transition-colors group ${
            post.userReaction === 'HELPFUL'
              ? 'text-emerald-600 font-semibold'
              : 'text-slate-500 hover:text-emerald-600'
          }`}
        >
          <span className="text-base group-hover:scale-110 transition-transform">💡</span>
          <span>Helpful</span>
          {post.reactions?.HELPFUL > 0 && (
            <span className="text-xs bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold ml-0.5">
              {post.reactions.HELPFUL}
            </span>
          )}
        </button>
        <button
          onClick={handleToggleComments}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors group"
        >
          <span className="text-base group-hover:scale-110 transition-transform">💬</span>
          <span>{showComments ? 'Hide' : 'Comments'}</span>
          {(comments.length > 0 || post.commentCount > 0) && (
            <span className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full font-bold ml-0.5">
              {comments.length || post.commentCount}
            </span>
          )}
        </button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 space-y-3">
          {loadingComments ? (
            <p className="text-xs text-slate-400 text-center py-2">Loading comments…</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-2">No comments yet. Be the first!</p>
          ) : (
            comments.map(c => (
              <div key={c._id} className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {(c.author?.name || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 bg-white rounded-xl px-3 py-2 border border-slate-200">
                  <p className="text-xs font-semibold text-slate-700">{c.author?.name || 'Unknown'}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{c.content}</p>
                </div>
              </div>
            ))
          )}

          <form onSubmit={handleAddComment} className="flex gap-2 mt-2">
            <input
              type="text"
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Write a comment…"
              className="flex-1 text-sm text-slate-900 placeholder:text-slate-400 px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
            />
            <button
              type="submit"
              disabled={submittingComment || !commentText.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// ─── Post Composer ─────────────────────────────────────────────────────────────
function PostComposer({ onPostCreated, user }) {
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [visibility, setVisibility] = useState('COLLEGE');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
      const data = await createPost({ content, tags: tagList, visibility });
      onPostCreated(data.post);
      setContent('');
      setTags('');
      setVisibility('COLLEGE');
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Failed to create post. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm">
          {(user?.name || 'U').charAt(0).toUpperCase()}
        </div>
        <p className="text-sm font-semibold text-slate-700">Share something with the community</p>
      </div>

      {error && (
        <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="What's on your mind? Share an update, career tip, opportunity…"
          rows={3}
          className="w-full text-sm text-slate-900 placeholder:text-slate-400 px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-medium"
        />
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="Tags (comma-separated): career, internship, tips"
            className="flex-1 text-sm text-slate-900 placeholder:text-slate-400 px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
          />
          <select
            value={visibility}
            onChange={e => setVisibility(e.target.value)}
            className="text-sm text-slate-900 px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          >
            <option value="COLLEGE">🏫 Whole College</option>
            <option value="CONNECTIONS">🔗 Connections Only</option>
          </select>
          <button
            type="submit"
            disabled={submitting || !content.trim()}
            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {submitting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Main FeedPage ─────────────────────────────────────────────────────────────
export default function FeedPage() {
  const { user } = useAuthStore();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadPosts = useCallback(async (pageNum = 1) => {
    setLoading(true);
    setError('');
    try {
      const data = await getPosts(pageNum);
      if (pageNum === 1) {
        setPosts(data.posts || []);
      } else {
        setPosts(prev => [...prev, ...(data.posts || [])]);
      }
      setHasMore((data.posts || []).length >= data.pageSize);
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Could not load posts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts(1);
  }, [loadPosts]);

  const handlePostCreated = (newPost) => {
    setPosts(prev => [newPost, ...prev]);
  };

  const handleReact = async (postId, type) => {
    try {
      const data = await reactToPost(postId, type);
      // data: { action, userReaction, reactionCounts }
      setPosts(prev =>
        prev.map(p => {
          if (p._id !== postId) return p;
          return {
            ...p,
            userReaction: data.userReaction,
            reactions: data.reactionCounts || p.reactions,
          };
        })
      );
    } catch {
      // silently fail
    }
  };

  const handleDelete = async (postId) => {
    if (!window.confirm('Delete this post?')) return;
    try {
      await deletePost(postId);
      setPosts(prev => prev.filter(p => p._id !== postId));
    } catch {
      alert('Could not delete post.');
    }
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadPosts(nextPage);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-slate-900">Community Feed</h1>
          <p className="text-sm text-slate-500 mt-1">Posts, updates, and opportunities from students and alumni.</p>
        </div>

        <PostComposer onPostCreated={handlePostCreated} user={user} />

        {error && (
          <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {loading && posts.length === 0 ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-slate-200" />
                  <div className="space-y-2">
                    <div className="h-3 bg-slate-200 rounded w-32" />
                    <div className="h-2 bg-slate-100 rounded w-20" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-slate-200 rounded w-full" />
                  <div className="h-3 bg-slate-100 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <div className="text-5xl mb-4">📋</div>
            <p className="font-semibold text-slate-600">No posts yet</p>
            <p className="text-sm mt-1">Be the first to share something with the community!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map(post => (
              <PostCard
                key={post._id}
                post={post}
                currentUserId={user?.id}
                onReact={handleReact}
                onDelete={handleDelete}
              />
            ))}

            {hasMore && (
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="w-full py-3 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-xl border border-blue-200 transition-colors disabled:opacity-50"
              >
                {loading ? 'Loading…' : 'Load more posts'}
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
