// frontend/src/features/community/pages/FeedPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../../components/layout/Navbar';
import useAuthStore from '../../../stores/authStore';
import {
  getPosts,
  createPost,
  reactToPost,
  getComments,
  addComment,
  deletePost,
} from '../api';
import { getDiscoverUsers, sendConnectionRequest } from '../../discover/api';

function formatPostTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.floor((now - date) / (1000 * 60));

  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Post Card ────────────────────────────────────────────────────────────────
function PostCard({ post, currentUserId, onReact, onDelete }) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [copied, setCopied] = useState(false);

  const authorName = post.author?.name || 'Campus Member';
  const authorInitial = authorName.charAt(0).toUpperCase();
  const isOwner = post.authorId === currentUserId;
  const isAlumni = post.author?.role === 'ALUMNI';

  // GET /api/posts hydrates authors as a flat object (company, designation,
  // department, graduationYear). The nested shapes are kept as a fallback for
  // any endpoint that returns a full Prisma user.
  const authorCompany = post.author?.company || post.author?.alumniProfile?.company?.name;
  const authorDesignation = post.author?.designation || post.author?.alumniProfile?.designation;
  const authorDepartment = post.author?.department
    || post.author?.academicProfile?.department?.code
    || post.author?.academicProfile?.department?.name;
  const authorGradYear = post.author?.graduationYear || post.author?.academicProfile?.graduationYear;

  const authorHeadline = isAlumni
    ? authorCompany
      ? `${authorDesignation || 'Alumnus'} at ${authorCompany}`
      : authorDesignation || 'Alumni Mentor'
    : authorDepartment
    ? `${authorDepartment}${authorGradYear ? ` • Class of ${authorGradYear}` : ''}`
    : 'Student';

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
    setShowComments((v) => !v);
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await addComment(post._id, commentText.trim());
      const newComment = res?.comment || res;
      if (newComment) {
        setComments((prev) => [...prev, newComment]);
        setCommentText('');
      }
    } catch (err) {
      console.error('Failed to add comment:', err);
      alert(err?.response?.data?.error?.message || 'Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const likeCount = post.reactions?.LIKE || 0;
  const helpfulCount = post.reactions?.HELPFUL || 0;
  const totalReactions = likeCount + helpfulCount;

  return (
    <article className="feed-card overflow-hidden">
      {/* Post Header */}
      <div className="p-4 pb-3 flex items-start justify-between gap-3">
        <Link to={`/profile/${post.authorId}`} className="flex items-start gap-3 group flex-1 min-w-0">
          <div className="w-11 h-11 rounded-full bg-[#0a66c2] text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs group-hover:ring-2 group-hover:ring-blue-300 transition-all">
            {authorInitial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 text-sm hover:text-[#0a66c2] transition-colors truncate">
                {authorName}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isAlumni
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}
              >
                {post.author?.role || 'STUDENT'}
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate mt-0.5">{authorHeadline}</p>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
              <span>{formatPostTime(post.createdAt)}</span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                {post.visibility === 'CONNECTIONS' ? '👥 Connections' : '🌐 Campus Public'}
              </span>
            </div>
          </div>
        </Link>

        {isOwner && (
          <button
            onClick={() => onDelete(post._id)}
            className="text-slate-400 hover:text-red-600 p-1.5 rounded-full hover:bg-red-50 transition-colors"
            title="Delete post"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2.5 py-0.5 rounded-full bg-[#eef5fc] text-[#0a66c2] font-semibold hover:bg-blue-100 transition-colors"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Reactions Count */}
      {(totalReactions > 0 || post.commentCount > 0 || comments.length > 0) && (
        <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            {likeCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#0a66c2] text-white flex items-center justify-center text-[9px]">
                👍
              </span>
            )}
            {helpfulCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[9px]">
                💡
              </span>
            )}
            <span>{totalReactions} reactions</span>
          </div>
          <button
            onClick={handleToggleComments}
            className="hover:text-[#0a66c2] hover:underline transition-colors"
          >
            {comments.length || post.commentCount || 0} comments
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-4 border-t border-slate-100 px-2 py-1 text-xs">
        <button
          onClick={() => onReact(post._id, 'LIKE')}
          className={`btn-feed-action ${post.userReaction === 'LIKE' ? 'active text-[#0a66c2]' : ''}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
          </svg>
          <span className="hidden sm:inline">Like</span>
        </button>

        <button
          onClick={() => onReact(post._id, 'HELPFUL')}
          className={`btn-feed-action ${post.userReaction === 'HELPFUL' ? 'active text-emerald-600' : ''}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span className="hidden sm:inline">Helpful</span>
        </button>

        <button onClick={handleToggleComments} className="btn-feed-action">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="hidden sm:inline">Comment</span>
        </button>

        <button onClick={handleShare} className="btn-feed-action">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          <span className="hidden sm:inline">{copied ? 'Copied!' : 'Share'}</span>
        </button>
      </div>

      {/* Inline Comments Thread */}
      {showComments && (
        <div className="border-t border-slate-100 bg-[#f8fafc] p-4 space-y-3">
          {loadingComments ? (
            <p className="text-xs text-slate-400 text-center py-2">Loading comments...</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-2">No comments yet. Join the conversation!</p>
          ) : (
            comments.map((c) => (
              <div key={c._id} className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#0a66c2] text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {(c.author?.name || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-900">{c.author?.name || 'Unknown'}</p>
                    <span className="text-[10px] text-slate-400">{formatPostTime(c.createdAt)}</span>
                  </div>
                  <p className="text-xs text-slate-700 mt-1 leading-relaxed">{c.content}</p>
                </div>
              </div>
            ))
          )}

          <form onSubmit={handleAddComment} className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-200">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add your comment..."
              className="flex-1 text-xs px-3.5 py-2 bg-white rounded-full border border-slate-300 focus:outline-none focus:border-[#0a66c2]"
            />
            <button
              type="submit"
              disabled={submittingComment || !commentText.trim()}
              className="btn-linkedin-primary text-xs py-1.5 px-3.5 disabled:opacity-50"
            >
              Post
            </button>
          </form>
        </div>
      )}
    </article>
  );
}

// ─── Composer ──────────────────────────────────────────────────────────────────
function PostComposer({ onPostCreated, user }) {
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [visibility, setVisibility] = useState('COLLEGE');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const initials = (user?.name || 'U').charAt(0).toUpperCase();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const tagList = tags
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);
      const data = await createPost({ content, tags: tagList, visibility });
      onPostCreated(data.post);
      setContent('');
      setTags('');
      setVisibility('COLLEGE');
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Failed to create post.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="feed-card p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-[#0a66c2] text-white flex items-center justify-center font-bold text-sm">
          {initials}
        </div>
        <div>
          <p className="text-xs font-bold text-slate-900">{user?.name || 'You'}</p>
          <p className="text-[11px] text-slate-500">Post to Campus Community Feed</p>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share an update, referral opportunity, or ask seniors for guidance..."
          rows={3}
          className="w-full text-xs text-slate-900 placeholder:text-slate-400 p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-[#0a66c2] resize-none"
        />
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags: interview, career, referral"
            className="flex-1 text-xs text-slate-900 px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-[#0a66c2]"
          />
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            className="text-xs text-slate-700 px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:outline-none"
          >
            <option value="COLLEGE">🌐 Whole College</option>
            <option value="CONNECTIONS">👥 Connections</option>
          </select>
          <button
            type="submit"
            disabled={submitting || !content.trim()}
            className="btn-linkedin-primary text-xs py-2 px-5 disabled:opacity-50"
          >
            {submitting ? 'Posting...' : 'Post'}
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
  const [recommendedUsers, setRecommendedUsers] = useState([]);
  const [connectingId, setConnectingId] = useState(null);

  const displayName = user?.name || 'there';
  const initials = displayName.charAt(0).toUpperCase();
  const isAlumni = user?.role === 'ALUMNI';

  const loadPosts = useCallback(async (pageNum = 1) => {
    setLoading(true);
    setError('');
    try {
      const data = await getPosts(pageNum);
      if (pageNum === 1) {
        setPosts(data.posts || []);
      } else {
        setPosts((prev) => [...prev, ...(data.posts || [])]);
      }
      setHasMore((data.posts || []).length >= (data.pageSize || 10));
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Could not load posts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts(1);
    getDiscoverUsers({ limit: 4 })
      .then((res) => setRecommendedUsers(res.users || []))
      .catch(() => {});
  }, [loadPosts]);

  const handlePostCreated = (newPost) => {
    setPosts((prev) => [newPost, ...prev]);
  };

  const handleReact = async (postId, type) => {
    try {
      const data = await reactToPost(postId, type);
      setPosts((prev) =>
        prev.map((p) => {
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
      setPosts((prev) => prev.filter((p) => p._id !== postId));
    } catch {
      alert('Could not delete post.');
    }
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadPosts(nextPage);
  };

  const handleConnect = async (targetUserId) => {
    setConnectingId(targetUserId);
    try {
      await sendConnectionRequest(targetUserId);
      setRecommendedUsers((prev) =>
        prev.map((u) => (u.id === targetUserId ? { ...u, connectionStatus: 'PENDING_SENT' } : u))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setConnectingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f2ee] flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* Left Column Profile Snapshot */}
          <aside className="lg:col-span-3 space-y-4">
            <div className="feed-card overflow-hidden">
              <div className="h-14 bg-gradient-to-r from-[#0a66c2] to-[#004182]" />
              <div className="px-4 pb-4 text-center -mt-7">
                <Link to="/profile">
                  <div className="w-14 h-14 rounded-full border-2 border-white bg-slate-900 text-white flex items-center justify-center font-bold text-xl shadow mx-auto hover:ring-2 hover:ring-blue-300">
                    {initials}
                  </div>
                </Link>
                <h3 className="mt-2 font-bold text-slate-900 text-sm">{displayName}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {isAlumni ? 'Alumni Mentor' : 'Verified Student'}
                </p>
                <div className="mt-3 pt-3 border-t border-slate-100 text-left text-xs space-y-2">
                  <Link to="/network" className="flex justify-between text-slate-600 hover:text-[#0a66c2]">
                    <span>Connections</span>
                    <span className="font-bold text-[#0a66c2]">View all</span>
                  </Link>
                  <Link to="/mentorship" className="flex justify-between text-slate-600 hover:text-[#0a66c2]">
                    <span>Mentorship</span>
                    <span className="font-bold text-[#0a66c2]">Active</span>
                  </Link>
                </div>
              </div>
            </div>
          </aside>

          {/* Center Column Posts */}
          <section className="lg:col-span-6 space-y-4">
            <PostComposer onPostCreated={handlePostCreated} user={user} />

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                {error}
              </div>
            )}

            {loading && posts.length === 0 ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="feed-card p-4 animate-pulse space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-200" />
                      <div className="space-y-1.5 flex-1">
                        <div className="h-3 bg-slate-200 rounded w-32" />
                        <div className="h-2 bg-slate-100 rounded w-20" />
                      </div>
                    </div>
                    <div className="h-3 bg-slate-200 rounded w-full" />
                  </div>
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="feed-card p-10 text-center text-slate-500">
                <p className="font-bold text-sm">No posts yet</p>
                <p className="text-xs mt-1">Be the first to share an update with the campus!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
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
                    className="w-full py-2.5 text-xs font-bold text-[#0a66c2] hover:bg-blue-50 rounded-lg border border-blue-200 bg-white transition-colors"
                  >
                    {loading ? 'Loading...' : 'Load more updates'}
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Right Column Recommendations */}
          <aside className="lg:col-span-3 space-y-4">
            {recommendedUsers.length > 0 && (
              <div className="feed-card p-4">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3">
                  People to Connect With
                </h3>
                <div className="space-y-3">
                  {recommendedUsers.map((m) => (
                    <div key={m.id} className="flex items-start gap-2.5 text-xs">
                      <Link to={`/profile/${m.id}`}>
                        <div className="w-9 h-9 rounded-full bg-[#0a66c2] text-white flex items-center justify-center font-bold text-xs shrink-0">
                          {(m.name || 'M').charAt(0).toUpperCase()}
                        </div>
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link to={`/profile/${m.id}`} className="font-bold text-slate-900 hover:text-[#0a66c2] block truncate">
                          {m.name}
                        </Link>
                        <p className="text-[11px] text-slate-500 truncate">{m.role}</p>
                        <button
                          type="button"
                          onClick={() => handleConnect(m.id)}
                          disabled={connectingId === m.id || m.connectionStatus === 'PENDING_SENT'}
                          className="btn-linkedin-secondary text-[10px] py-0.5 px-2.5 mt-1"
                        >
                          {m.connectionStatus === 'PENDING_SENT' ? 'Pending' : '+ Connect'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>

        </div>
      </main>
    </div>
  );
}
