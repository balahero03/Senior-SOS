// frontend/src/features/dashboard/pages/DashboardPage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import useAuthStore from '../../../stores/authStore';
import Navbar from '../../../components/layout/Navbar';
import {
  getPosts,
  createPost,
  reactToPost,
  getComments,
  addComment,
  deletePost,
} from '../../community/api';
import { getDiscoverUsers, getPeerMatches, sendConnectionRequest } from '../../discover/api';

// ─── Format Time Helper ───────────────────────────────────────────────────────
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

// ─── People Like You (sidebar preview) ────────────────────────────────────────
// Top few peer matches with the strongest reason for each; the full, filterable
// list lives at /connect. Renders nothing while loading or when there is no one
// to suggest, so an empty account does not get a hollow card.
function PeersPreview() {
  const [peers, setPeers] = useState([]);

  useEffect(() => {
    let cancelled = false;
    getPeerMatches({ limit: 3 })
      .then((res) => { if (!cancelled) setPeers(res?.recommendations || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (peers.length === 0) return null;

  return (
    <div className="feed-card p-4">
      <h3 className="font-bold text-slate-900 text-sm mb-3">People like you</h3>
      <div className="space-y-3.5">
        {peers.map(({ user: peer, score, reasons }) => (
          <div key={peer.id} className="flex items-start gap-3">
            <Link to={`/profile/${peer.id}`} className="shrink-0">
              <div className="w-10 h-10 rounded-full bg-[#0a66c2] text-white flex items-center justify-center font-bold text-xs hover:ring-2 hover:ring-blue-300 transition-all">
                {(peer.name || '?').charAt(0).toUpperCase()}
              </div>
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <Link
                  to={`/profile/${peer.id}`}
                  className="font-bold text-slate-900 text-xs hover:text-[#0a66c2] transition-colors truncate"
                >
                  {peer.name}
                </Link>
                <span className="text-[11px] font-black text-[#0a66c2] shrink-0">{score}%</span>
              </div>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                {reasons[0]?.label || (peer.role === 'ALUMNI' ? 'Alumnus' : 'Student')}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-slate-100 text-center">
        <Link to="/connect" className="text-xs font-bold text-[#0a66c2] hover:underline">
          See all matches →
        </Link>
      </div>
    </div>
  );
}

// ─── LinkedIn-style Post Card ─────────────────────────────────────────────────
function LinkedInPostCard({ post, currentUserId, onReact, onDelete }) {
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
    setShowComments((prev) => !prev);
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
          <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#0a66c2] to-[#004182] text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs group-hover:ring-2 group-hover:ring-blue-300 transition-all">
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
                {post.visibility === 'CONNECTIONS' ? (
                  <>
                    <svg className="w-3 h-3 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                    </svg>
                    Connections
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v.183a2 2 0 00.183.817 6.002 6.002 0 01-8.768-5.973z" clipRule="evenodd" />
                    </svg>
                    Campus Public
                  </>
                )}
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

      {/* Post Content */}
      <div className="px-4 pb-3">
        <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2.5 py-0.5 rounded-full bg-[#eef5fc] text-[#0a66c2] font-semibold hover:bg-blue-100 transition-colors cursor-pointer"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Reactions Count Bar */}
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

      {/* Action Bar (LinkedIn Like / Comment / Share) */}
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

      {/* Inline Comments Section */}
      {showComments && (
        <div className="border-t border-slate-100 bg-[#f8fafc] p-4 space-y-3">
          {loadingComments ? (
            <p className="text-xs text-slate-400 text-center py-2">Loading discussions...</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-2">
              No comments yet. Start the conversation!
            </p>
          ) : (
            comments.map((c) => (
              <div key={c._id} className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#0a66c2] text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {(c.author?.name || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-900">{c.author?.name || 'Unknown'}</p>
                    <span className="text-[10px] text-slate-400">
                      {formatPostTime(c.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 mt-1 leading-relaxed">{c.content}</p>
                </div>
              </div>
            ))
          )}

          {/* Comment composer */}
          <form onSubmit={handleAddComment} className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-200">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment or question..."
              className="flex-1 text-xs px-3.5 py-2 bg-white rounded-full border border-slate-300 focus:outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2]"
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

// ─── Post Composer Card ────────────────────────────────────────────────────────
function LinkedInPostComposer({ user, onPostCreated }) {
  const [isOpen, setIsOpen] = useState(false);
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
      setIsOpen(false);
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Failed to create post. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="feed-card p-4">
      {/* Trigger Bar */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-[#0a66c2] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
          {initials}
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex-1 text-left px-4 py-3 bg-[#f8fafc] hover:bg-[#eef3f8] text-slate-500 font-medium text-xs sm:text-sm rounded-full border border-slate-300/80 transition-colors"
        >
          Start a post, ask alumni for advice, or share an opportunity...
        </button>
      </div>

      {/* Quick Action Badges */}
      <div className="flex items-center justify-around sm:justify-between pt-3 mt-3 border-t border-slate-100 text-xs">
        <button
          type="button"
          onClick={() => {
            setTags('Project, Career');
            setIsOpen(true);
          }}
          className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:text-[#0a66c2] hover:bg-slate-50 rounded-lg font-semibold transition-colors"
        >
          <span className="text-[#378fe9] text-base">💼</span>
          <span className="hidden sm:inline">Job / Referral</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setTags('Guidance, Advice');
            setIsOpen(true);
          }}
          className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:text-emerald-600 hover:bg-slate-50 rounded-lg font-semibold transition-colors"
        >
          <span className="text-[#5f9b41] text-base">🎓</span>
          <span className="hidden sm:inline">Ask Campus</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setTags('InterviewPrep, Tech');
            setIsOpen(true);
          }}
          className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:text-amber-600 hover:bg-slate-50 rounded-lg font-semibold transition-colors"
        >
          <span className="text-[#e06800] text-base">💡</span>
          <span className="hidden sm:inline">Alumni Insights</span>
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:text-purple-600 hover:bg-slate-50 rounded-lg font-semibold transition-colors"
        >
          <span className="text-[#9b51e0] text-base">✍️</span>
          <span className="hidden sm:inline">Write Post</span>
        </button>
      </div>

      {/* Composer Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-dropdown border border-slate-200 overflow-hidden animate-slide-up">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#0a66c2] text-white flex items-center justify-center font-bold text-sm">
                  {initials}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{user?.name}</h3>
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value)}
                    className="text-[11px] font-semibold text-slate-600 bg-slate-100 rounded-full px-2 py-0.5 border border-slate-200 focus:outline-none mt-0.5"
                  >
                    <option value="COLLEGE">🌐 Anyone in College Network</option>
                    <option value="CONNECTIONS">👥 Connections Only</option>
                  </select>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-100 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mx-5 mt-4 p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <textarea
                rows={5}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What do you want to talk about? Share guidance, ask for alumni advice, or post an internship update..."
                className="w-full text-sm text-slate-800 placeholder:text-slate-400 border-0 focus:ring-0 p-0 resize-none focus:outline-none"
                autoFocus
              />

              <div className="pt-2 border-t border-slate-100">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="e.g. Placements2026, Referral, OffCampus, ResumeReview"
                  className="w-full text-xs px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:border-[#0a66c2]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !content.trim()}
                  className="btn-linkedin-primary text-xs py-2 px-5 disabled:opacity-50"
                >
                  {submitting ? 'Posting...' : 'Post to Network'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard Page ───────────────────────────────────────────────────────
// How many posts load per slot as the reader scrolls.
const POSTS_PER_PAGE = 5;

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  // The observer is created once, so it cannot close over state.
  const loadingRef = useRef(false);
  const sentinelRef = useRef(null);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const [recommendedAlumni, setRecommendedAlumni] = useState([]);
  const [connectingId, setConnectingId] = useState(null);
  const [activeTab, setActiveTab] = useState('ALL');

  const displayName = user?.name || 'there';
  const initials = displayName.charAt(0).toUpperCase();
  const isAlumni = user?.role === 'ALUMNI';

  // Load feed posts one slot at a time, appending as the reader scrolls.
  const loadPosts = useCallback(async (pageNum = 1) => {
    // Guard with a ref, not state: the observer callback runs before React
    // re-renders and would otherwise request the same page twice.
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoadingPosts(pageNum === 1);
    setLoadingMore(pageNum > 1);
    try {
      const data = await getPosts(pageNum, undefined, POSTS_PER_PAGE);
      const batch = data.posts || [];

      setPosts((prev) => {
        if (pageNum === 1) return batch;
        // A post created or deleted between fetches shifts the server-side
        // offset, so the same _id can arrive in two batches.
        const seen = new Set(prev.map((p) => p._id));
        return [...prev, ...batch.filter((p) => !seen.has(p._id))];
      });

      const { page: current, totalPages } = data.pagination || {};
      const more = totalPages != null && current != null
        ? current < totalPages
        : batch.length === POSTS_PER_PAGE;

      pageRef.current = pageNum;
      hasMoreRef.current = more;
      setHasMore(more);
    } catch (err) {
      console.error('Failed to load posts:', err);
      // Stop the observer retrying a failing request on every scroll tick.
      hasMoreRef.current = false;
      setHasMore(false);
    } finally {
      loadingRef.current = false;
      setLoadingPosts(false);
      setLoadingMore(false);
    }
  }, []);

  // Load recommended alumni for right sidebar
  const loadRecommendations = useCallback(async () => {
    try {
      const res = await getDiscoverUsers({ limit: 4, role: isAlumni ? 'STUDENT' : 'ALUMNI' });
      setRecommendedAlumni(res.users || []);
    } catch {
      // silently fail
    }
  }, [isAlumni]);

  useEffect(() => {
    loadPosts(1);
    loadRecommendations();
  }, [loadPosts, loadRecommendations]);

  // Filter posts based on active pill
  const filteredPosts = posts.filter((p) => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'ALUMNI') return p.author?.role === 'ALUMNI';
    if (activeTab === 'STUDENTS') return p.author?.role === 'STUDENT';
    if (activeTab === 'OPPORTUNITIES') {
      return (
        p.tags?.some((t) => ['career', 'job', 'referral', 'internship'].includes(t.toLowerCase())) ||
        p.content?.toLowerCase().includes('referral') ||
        p.content?.toLowerCase().includes('hiring')
      );
    }
    return true;
  });

  // Load the next slot as the sentinel below the last post comes into view.
  // Created once and reading live values from refs: rebuilding the observer
  // on every load leaves it armed but silent when the sentinel is already
  // inside the margin, which stalls the feed.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        if (loadingRef.current || !hasMoreRef.current) return;
        loadPosts(pageRef.current + 1);
      },
      { rootMargin: '600px 0px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadPosts]);

  // A slot is often shorter than the viewport, and the active filter can hide
  // most of a batch, so the sentinel may still be on screen after rendering.
  // An observer only fires on a crossing, so top up explicitly.
  useEffect(() => {
    if (loadingPosts || loadingMore || !hasMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const { top } = sentinel.getBoundingClientRect();
    if (top <= window.innerHeight + 600) {
      loadPosts(pageRef.current + 1);
    }
  }, [posts, filteredPosts.length, loadingPosts, loadingMore, hasMore, loadPosts]);

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

  const handleConnect = async (targetUserId) => {
    setConnectingId(targetUserId);
    try {
      await sendConnectionRequest(targetUserId);
      setRecommendedAlumni((prev) =>
        prev.map((u) => (u.id === targetUserId ? { ...u, connectionStatus: 'PENDING_SENT' } : u))
      );
    } catch (err) {
      console.error('Failed to send connect request:', err);
    } finally {
      setConnectingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f2ee] flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* ═════════ LEFT COLUMN: LinkedIn Profile Snapshot & Shortcuts (col-span-3) ═════════ */}
          <aside className="lg:col-span-3 space-y-4">
            {/* Identity Card */}
            <div className="feed-card overflow-hidden">
              {/* Cover Banner */}
              <div className="h-16 bg-gradient-to-r from-[#0a66c2] via-[#004182] to-[#1e293b]" />

              {/* Avatar + Identity */}
              <div className="px-4 pb-4 text-center -mt-9">
                <Link to="/profile" className="inline-block relative group">
                  <div className="w-18 h-18 rounded-full border-2 border-white bg-slate-900 text-white flex items-center justify-center font-extrabold text-2xl shadow-md mx-auto group-hover:ring-2 group-hover:ring-blue-400 transition-all">
                    {initials}
                  </div>
                </Link>

                <h2 className="mt-2 font-bold text-slate-900 text-base leading-tight hover:text-[#0a66c2] transition-colors">
                  <Link to="/profile">{displayName}</Link>
                </h2>

                <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-snug">
                  {isAlumni
                    ? user?.alumniProfile?.company?.name
                      ? `${user?.alumniProfile?.designation || 'Alumnus'} @ ${user.alumniProfile.company.name}`
                      : 'Verified Alumni Mentor'
                    : user?.academicProfile?.department?.name
                    ? `${user.academicProfile.department.name} • Class of ${user.academicProfile.graduationYear || '2028'}`
                    : 'Verified Student • SSN College of Engineering'}
                </p>

                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                  <span className={`w-2 h-2 rounded-full ${isAlumni ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  {user?.role}
                </div>

                {/* Quick Profile Stats */}
                <div className="mt-4 pt-3 border-t border-slate-100 text-left text-xs space-y-2">
                  <Link
                    to="/network"
                    className="flex items-center justify-between py-1 text-slate-600 hover:text-[#0a66c2] transition-colors group"
                  >
                    <span>Connections</span>
                    <span className="font-bold text-[#0a66c2] group-hover:underline">Manage</span>
                  </Link>
                </div>

                {/* Saved Items */}
                <div className="mt-3 pt-3 border-t border-slate-100 text-left">
                  <Link
                    to="/profile"
                    className="flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-[#0a66c2] transition-colors"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                    </svg>
                    <span>My Campus Profile</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Quick Access Card */}
            <div className="feed-card p-4 space-y-2 text-xs">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">
                Quick Shortcuts
              </h3>
              <Link
                to="/discover"
                className="flex items-center gap-2.5 p-2 rounded-lg text-slate-700 hover:bg-slate-50 hover:text-[#0a66c2] transition-colors font-medium"
              >
                <span className="text-base">🔍</span>
                <span>Alumni Directory</span>
              </Link>
              <Link
                to="/network"
                className="flex items-center gap-2.5 p-2 rounded-lg text-slate-700 hover:bg-slate-50 hover:text-[#0a66c2] transition-colors font-medium"
              >
                <span className="text-base">🤝</span>
                <span>Network Graph</span>
              </Link>
              <Link
                to="/messages"
                className="flex items-center gap-2.5 p-2 rounded-lg text-slate-700 hover:bg-slate-50 hover:text-[#0a66c2] transition-colors font-medium"
              >
                <span className="text-base">💬</span>
                <span>Direct Chats</span>
              </Link>
            </div>
          </aside>

          {/* ═════════ CENTER COLUMN: Main Feed (col-span-6) ═════════ */}
          <section className="lg:col-span-6 space-y-4">
            {/* Post Composer */}
            <LinkedInPostComposer user={user} onPostCreated={handlePostCreated} />

            {/* Feed Filter Bar */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 text-xs">
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200/90 shadow-2xs">
                {[
                  { id: 'ALL', label: 'All Updates' },
                  { id: 'ALUMNI', label: 'Alumni Insights' },
                  { id: 'OPPORTUNITIES', label: 'Opportunities' },
                  { id: 'STUDENTS', label: 'Campus Peers' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'bg-[#0a66c2] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Posts Stream */}
            {loadingPosts ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="feed-card p-4 animate-pulse space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-200" />
                      <div className="space-y-1.5 flex-1">
                        <div className="h-3 bg-slate-200 rounded w-36" />
                        <div className="h-2 bg-slate-100 rounded w-24" />
                      </div>
                    </div>
                    <div className="h-3 bg-slate-200 rounded w-full" />
                    <div className="h-3 bg-slate-100 rounded w-4/5" />
                  </div>
                ))}
              </div>
            ) : filteredPosts.length === 0 && !hasMore ? (
              // Only a real empty state once everything has been fetched: an
              // active filter can hide a whole slot while more pages remain,
              // and showing this instead would unmount the sentinel and stop
              // the scroll for good.
              <div className="feed-card p-10 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-[#0a66c2] flex items-center justify-center text-xl mx-auto">
                  📝
                </div>
                <h3 className="font-bold text-slate-800 text-sm">No posts yet in this feed</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Be the first to share an update, ask alumni for interview tips, or announce a campus event!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPosts.map((post) => (
                  <LinkedInPostCard
                    key={post._id}
                    post={post}
                    currentUserId={user?.id}
                    onReact={handleReact}
                    onDelete={handleDelete}
                  />
                ))}

                {/* Scroll target: crossing this loads the next slot. */}
                <div ref={sentinelRef} aria-hidden="true" className="h-px" />

                {hasMore ? (
                  loadingMore ? (
                    <div className="space-y-4" aria-live="polite">
                      {[1, 2].map((i) => (
                        <div key={i} className="feed-card p-4 animate-pulse space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-200" />
                            <div className="space-y-1.5 flex-1">
                              <div className="h-3 bg-slate-200 rounded w-36" />
                              <div className="h-2 bg-slate-100 rounded w-24" />
                            </div>
                          </div>
                          <div className="h-3 bg-slate-200 rounded w-full" />
                          <div className="h-3 bg-slate-100 rounded w-4/5" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Fallback for when the observer cannot fire.
                    <button
                      onClick={() => loadPosts(pageRef.current + 1)}
                      className="w-full py-2.5 text-xs font-bold text-[#0a66c2] hover:bg-blue-50 rounded-lg border border-blue-200 bg-white transition-colors"
                    >
                      Load more updates
                    </button>
                  )
                ) : (
                  <p className="py-4 text-center text-xs text-slate-400">
                    You&apos;re all caught up.
                  </p>
                )}
              </div>
            )}
          </section>

          {/* ═════════ RIGHT COLUMN: Campus Pulse & Suggested Mentors (col-span-3) ═════════ */}
          <aside className="lg:col-span-3 space-y-4">
            {/* Campus Pulse / Trending News (LinkedIn News) */}
            <div className="feed-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <span>Campus & Career Pulse</span>
                </h3>
                <span className="text-[10px] bg-blue-50 text-[#0a66c2] font-bold px-1.5 py-0.5 rounded">
                  Live
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <Link to="/dashboard" className="font-bold text-slate-800 hover:text-[#0a66c2] transition-colors block leading-snug">
                    • 2026 Campus Placement Trends
                  </Link>
                  <p className="text-[11px] text-slate-400 mt-0.5">3h ago • 1,420 readers</p>
                </div>
                <div>
                  <Link to="/dashboard" className="font-bold text-slate-800 hover:text-[#0a66c2] transition-colors block leading-snug">
                    • Amazon & Google Referral Drive
                  </Link>
                  <p className="text-[11px] text-slate-400 mt-0.5">6h ago • 2,890 readers</p>
                </div>
                <div>
                  <Link to="/discover" className="font-bold text-slate-800 hover:text-[#0a66c2] transition-colors block leading-snug">
                    • Alumni AMA: Transitioning to AI/ML
                  </Link>
                  <p className="text-[11px] text-slate-400 mt-0.5">1d ago • 980 readers</p>
                </div>
                <div>
                  <Link to="/discover" className="font-bold text-slate-800 hover:text-[#0a66c2] transition-colors block leading-snug">
                    • Off-Campus Internship Shortlists
                  </Link>
                  <p className="text-[11px] text-slate-400 mt-0.5">2d ago • 3,210 readers</p>
                </div>
              </div>
            </div>

            {/* People You May Know / Suggested Connections */}
            {/* Students get a route into scored matching, not just a list of
                names they have no basis to choose between. */}
            {!isAlumni && user?.role === 'STUDENT' && (
              <Link
                to="/best-fit"
                className="feed-card p-4 block hover:shadow-md transition-shadow group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎯</span>
                  <h3 className="font-bold text-slate-900 text-sm group-hover:text-[#0a66c2] transition-colors">
                    Find your best matches
                  </h3>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Alumni ranked against your skills, interests and network — with
                  the reasons behind every suggestion.
                </p>
              </Link>
            )}

            {(user?.role === 'STUDENT' || isAlumni) && <PeersPreview />}

            {recommendedAlumni.length > 0 && (
              <div className="feed-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-900 text-sm">
                    {isAlumni ? 'Students You May Know' : 'Alumni You May Know'}
                  </h3>
                </div>

                <div className="space-y-3.5">
                  {recommendedAlumni.map((member) => {
                    const mInitials = (member.name || 'M').charAt(0).toUpperCase();
                    const isMAlumni = member.role === 'ALUMNI';
                    return (
                      <div key={member.id} className="flex items-start gap-3">
                        <Link to={`/profile/${member.id}`} className="shrink-0">
                          <div className="w-10 h-10 rounded-full bg-[#0a66c2] text-white flex items-center justify-center font-bold text-xs hover:ring-2 hover:ring-blue-300 transition-all">
                            {mInitials}
                          </div>
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link
                            to={`/profile/${member.id}`}
                            className="font-bold text-slate-900 text-xs hover:text-[#0a66c2] transition-colors block truncate"
                          >
                            {member.name}
                          </Link>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {isMAlumni
                              ? member.designation && member.company
                                ? `${member.designation} at ${member.company}`
                                : 'Alumnus'
                              : member.departmentName || 'Student'}
                          </p>

                          <div className="mt-1.5">
                            {member.connectionStatus === 'CONNECTED' ? (
                              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                                Connected
                              </span>
                            ) : member.connectionStatus === 'PENDING_SENT' ? (
                              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                Pending
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleConnect(member.id)}
                                disabled={connectingId === member.id}
                                className="btn-linkedin-secondary text-[11px] py-1 px-3"
                              >
                                {connectingId === member.id ? '...' : '+ Connect'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 text-center">
                  <Link
                    to="/discover"
                    className="text-xs font-bold text-[#0a66c2] hover:underline"
                  >
                    View all recommendations →
                  </Link>
                </div>
              </div>
            )}

            {/* Platform Footer */}
            <footer className="text-center text-[11px] text-slate-500 space-y-1.5 px-2">
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
                <Link to="/dashboard" className="hover:text-[#0a66c2] hover:underline">About</Link>
                <Link to="/dashboard" className="hover:text-[#0a66c2] hover:underline">Accessibility</Link>
                <Link to="/dashboard" className="hover:text-[#0a66c2] hover:underline">Help Center</Link>
                <Link to="/dashboard" className="hover:text-[#0a66c2] hover:underline">Privacy & Terms</Link>
              </div>
              <p className="text-slate-400">SeniorSOS Corporation © 2026</p>
            </footer>
          </aside>

        </div>
      </main>
    </div>
  );
}
