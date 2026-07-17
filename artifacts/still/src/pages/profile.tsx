import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { AppNav } from "@/components/app-nav";
import { useAuth } from "@/lib/auth";
import { useUpdateProfile, useChangePassword } from "@/lib/use-profile";
import { Avatar } from "@/components/avatar";
import { AVATAR_COLORS, avatarColorFor } from "@/lib/avatar";

// Center-crop a chosen file to a square and shrink it to a small JPEG data URL,
// so an avatar stays tiny (no object storage needed, it lives on the user row).
function fileToAvatarDataUrl(file: File, max = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = max;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no canvas"));
        ctx.drawImage(img, sx, sy, side, side, 0, 0, max, max);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// Change-password, its own little form (separate save from the profile fields).
// Hidden for Google-only accounts, which have no password.
function ChangePasswordSection({ hasPassword }: { hasPassword: boolean }) {
  const change = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  if (!hasPassword) {
    return (
      <section className="mt-12 pt-8 border-t border-border/40">
        <p className="block font-sans text-xs uppercase tracking-[0.18em] text-faint-ink mb-2">
          Password
        </p>
        <p className="font-body text-soft-ink">
          You sign in with Google, there's no password to change.
        </p>
      </section>
    );
  }

  async function submit() {
    setErr("");
    setDone(false);
    if (next.length < 8) {
      setErr("Your new password must be at least 8 characters.");
      return;
    }
    try {
      await change.mutateAsync({ currentPassword: current, newPassword: next });
      setCurrent("");
      setNext("");
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch {
      setErr("Couldn't change it, check that your current password is right.");
    }
  }

  const inputCls =
    "w-full bg-surface border border-border rounded-xl px-4 py-3 font-body text-ink placeholder:text-faint-ink focus:outline-none focus:border-accent-sepia transition-colors";

  return (
    <section className="mt-12 pt-8 border-t border-border/40">
      <p className="block font-sans text-xs uppercase tracking-[0.18em] text-faint-ink mb-3">
        Password
      </p>
      <div className="space-y-3 max-w-sm">
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Current password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className={inputCls}
          data-testid="input-current-password"
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="New password (8+ characters)"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className={inputCls}
          data-testid="input-new-password"
        />
      </div>
      <div className="flex items-center gap-4 mt-4">
        <button
          onClick={submit}
          disabled={!current || !next || change.isPending}
          className="rounded-full border border-border hover:border-accent-sepia text-soft-ink hover:text-ink px-5 py-2 font-sans text-sm disabled:opacity-40 disabled:cursor-default transition-colors"
          data-testid="button-change-password"
        >
          {change.isPending ? "Saving…" : "Change password"}
        </button>
        {done && (
          <span className="font-sans text-sm text-soft-ink">
            Password changed ✓
          </span>
        )}
        {err && <span className="font-sans text-sm text-soft-ink">{err}</span>}
      </div>
    </section>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const update = useUpdateProfile();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Seed the form once the user loads.
  useEffect(() => {
    setName(user?.name ?? "");
    setColor(user?.avatarColor ?? null);
    setAvatarUrl(user?.avatarUrl ?? null);
  }, [user?.name, user?.avatarColor, user?.avatarUrl]);

  const preview = { name, email: user?.email, avatarColor: color, avatarUrl };
  const effectiveColor = color ?? avatarColorFor(preview);

  const dirty =
    (user?.name ?? "") !== name.trim() ||
    (user?.avatarColor ?? null) !== color ||
    (user?.avatarUrl ?? null) !== avatarUrl;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    try {
      setAvatarUrl(await fileToAvatarDataUrl(file));
    } catch {
      /* ignore a bad image */
    }
  }

  async function save() {
    setSaved(false);
    await update.mutateAsync({
      name: name.trim(),
      avatarColor: color,
      avatarUrl,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <AppNav />
      <main className="flex-1 w-full max-w-[680px] mx-auto px-6 py-12 md:py-16">
        <Link
          href="/settings"
          className="font-sans text-sm text-soft-ink hover:text-ink transition-colors"
        >
          ← Settings
        </Link>

        <h1 className="font-display text-4xl text-deep-brown mt-6 mb-8">
          Your profile
        </h1>

        {/* Avatar + photo controls */}
        <div className="flex items-center gap-5 mb-8">
          <Avatar user={preview} size={84} colorOverride={effectiveColor} />
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => fileRef.current?.click()}
              className="text-left font-sans text-sm text-soft-ink hover:text-ink transition-colors"
              data-testid="button-upload-avatar"
            >
              {avatarUrl ? "Change photo" : "Upload a photo"}
            </button>
            {avatarUrl && (
              <button
                onClick={() => setAvatarUrl(null)}
                className="text-left font-sans text-sm text-faint-ink hover:text-soft-ink transition-colors"
              >
                Remove photo
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={onPick}
              className="hidden"
            />
          </div>
        </div>

        {/* Colour, used for the initial when there's no photo. */}
        <div className="mb-8">
          <p className="block font-sans text-xs uppercase tracking-[0.18em] text-faint-ink mb-3">
            Choose a colour
          </p>
          <div className="flex items-center gap-3">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{ background: c }}
                className={
                  "w-9 h-9 rounded-full transition-transform " +
                  (color === c
                    ? "ring-2 ring-offset-2 ring-deep-brown scale-105"
                    : "hover:scale-105")
                }
                aria-label={`avatar colour ${c}`}
                data-testid={`avatar-color-${c}`}
              />
            ))}
          </div>
          {avatarUrl && (
            <p className="font-body text-sm text-faint-ink mt-2">
              Your photo is shown instead of the colour, remove it to use a
              colour.
            </p>
          )}
        </div>

        {/* Display name */}
        <div className="mb-8">
          <label
            htmlFor="display-name"
            className="block font-sans text-xs uppercase tracking-[0.18em] text-faint-ink mb-2"
          >
            Display name
          </label>
          <input
            id="display-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="What should we call you?"
            className="w-full bg-surface border border-border rounded-xl px-4 py-3 font-body text-lg text-ink placeholder:text-faint-ink focus:outline-none focus:border-accent-sepia transition-colors"
            data-testid="input-display-name"
          />
          <p className="font-body text-sm text-faint-ink mt-2">
            Shown in the top bar and on your pages. Leave it blank to use your
            email.
          </p>
        </div>

        {/* Email (read-only) */}
        <div className="mb-10">
          <p className="block font-sans text-xs uppercase tracking-[0.18em] text-faint-ink mb-2">
            Email
          </p>
          <p className="font-body text-lg text-soft-ink">{user?.email}</p>
          <p className="font-body text-sm text-faint-ink mt-1">
            Your sign-in identity, it can't be changed here.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={save}
            disabled={!dirty || update.isPending}
            className="rounded-full bg-deep-brown text-background px-6 py-2.5 font-sans text-sm hover:bg-ink disabled:opacity-40 disabled:cursor-default transition-colors"
            data-testid="button-save-profile"
          >
            {update.isPending ? "Saving…" : "Save changes"}
          </button>
          {saved && (
            <span className="font-sans text-sm text-soft-ink">Saved ✓</span>
          )}
          {update.isError && (
            <span className="font-sans text-sm text-soft-ink">
              Couldn't save, try again.
            </span>
          )}
        </div>

        <ChangePasswordSection hasPassword={!!user?.hasPassword} />
      </main>
    </div>
  );
}
