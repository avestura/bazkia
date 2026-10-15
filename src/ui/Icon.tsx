export type IconName =
  | "info" | "success" | "warning" | "error" | "copy" | "edit" | "trash" | "share" | "download" | "upload"
  | "plus" | "minus" | "x" | "check" | "refresh" | "send" | "clip" | "link" | "search" | "filter" | "sort"
  | "pin" | "star" | "eye" | "pipette" | "down" | "up" | "left" | "right" | "more" | "grip" | "folder"
  | "file" | "cal" | "archive" | "user" | "gear" | "grid" | "list" | "columns" | "term" | "lock" | "bolt"
  | "chart" | "globe" | "book" | "branch" | "bell" | "inbox" | "mail" | "comment"

/** References the Boxy sprite in /boxy-icons.svg (served from public/). */
export function Icon({ name, size = "md", className = "" }: { name: IconName; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const s = size === "md" ? "" : ` bx-icon--${size}`
  return (
    <svg className={`bx-icon${s} ${className}`} aria-hidden="true">
      <use href={`${import.meta.env.BASE_URL}boxy-icons.svg#i-${name}`} />
    </svg>
  )
}

/** Category glyphs. */
export const CATEGORY_ICON: Record<string, IconName> = {
  Input: "download",
  Output: "eye",
  "Data format": "columns",
  Encoding: "link",
  Hashing: "lock",
  Crypto: "lock",
  Arithmetic: "chart",
  Bitwise: "grid",
  Text: "list",
  Regex: "search",
  Networking: "globe",
  "Date & time": "cal",
  Extractors: "filter",
  Compression: "archive",
  Code: "term",
  Analysis: "chart",
  Generators: "bolt",
}
