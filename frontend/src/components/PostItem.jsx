import { formatCompactNumber, formatRelativeDate, formatFullDate } from '../lib/format'

const EyeIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
const HeartIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
  </svg>
)
const CommentIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
  </svg>
)

/**
 * One post/video row. Always renders as a real <a> so it's keyboard
 * accessible and works with "open in new tab" gestures natively.
 */
export default function PostItem({ post, accent }) {
  return (
    <a
      href={post.permalink}
      target="_blank"
      rel="noopener noreferrer"
      title={post.title}
      className="group flex gap-3 rounded-xl p-2 -mx-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/60 focus-visible:bg-slate-100 dark:focus-visible:bg-slate-800/60"
    >
      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-slate-200 dark:bg-slate-800">
        {post.thumbnail_url ? (
          <img
            src={post.thumbnail_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
            No image
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium text-slate-800 dark:text-slate-100 group-hover:underline decoration-1 underline-offset-2">
          {post.title || 'Untitled post'}
        </p>
        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500" title={formatFullDate(post.published_at)}>
          {formatRelativeDate(post.published_at)}
        </p>
        <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1">
            <EyeIcon className="h-3.5 w-3.5" /> {formatCompactNumber(post.view_count)}
          </span>
          <span className="inline-flex items-center gap-1">
            <HeartIcon className="h-3.5 w-3.5" /> {formatCompactNumber(post.like_count)}
          </span>
          <span className="inline-flex items-center gap-1">
            <CommentIcon className="h-3.5 w-3.5" /> {formatCompactNumber(post.comment_count)}
          </span>
        </div>
      </div>
    </a>
  )
}
