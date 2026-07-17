import { avatarColorFor, avatarInitial } from "@/lib/avatar";

type AvatarUserLike = {
  name?: string | null;
  email?: string | null;
  avatarColor?: string | null;
  avatarUrl?: string | null;
} | null | undefined;

// A round avatar: the uploaded photo if there is one, else the writer's initial
// on their chosen (or name-derived) colour. `colorOverride` lets the profile
// editor preview a colour before it's saved.
export function Avatar({
  user,
  size = 40,
  colorOverride,
  className = "",
}: {
  user: AvatarUserLike;
  size?: number;
  colorOverride?: string;
  className?: string;
}) {
  if (user?.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        style={{ width: size, height: size }}
        className={"rounded-full object-cover shrink-0 " + className}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        background: colorOverride ?? avatarColorFor(user),
        fontSize: Math.round(size * 0.42),
      }}
      className={
        "rounded-full shrink-0 flex items-center justify-center text-background font-display leading-none " +
        className
      }
      aria-hidden="true"
    >
      {avatarInitial(user)}
    </div>
  );
}
