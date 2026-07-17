import { useEffect, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useVerifyEmail,
  getGetCurrentUserQueryKey,
} from "@workspace/api-client-react";
import { AmbientField, SiteNav } from "@/components/site-chrome";

type Status = "verifying" | "ok" | "error";

export default function VerifyEmail() {
  const search = useSearch();
  const token = new URLSearchParams(search).get("token") ?? "";
  const verify = useVerifyEmail();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>("verifying");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!token) {
      setStatus("error");
      return;
    }
    verify
      .mutateAsync({ data: { token } })
      .then(() => {
        setStatus("ok");
        queryClient.invalidateQueries({
          queryKey: getGetCurrentUserQueryKey(),
        });
      })
      .catch(() => setStatus("error"));
  }, [token, verify, queryClient]);

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <AmbientField />
      <SiteNav showWhy={false} />
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        {status === "verifying" && (
          <p className="font-body text-xl text-soft-ink animate-pulse">
            Confirming your email…
          </p>
        )}
        {status === "ok" && (
          <div>
            <h1 className="font-display text-4xl text-deep-brown mb-3">
              Your email is confirmed.
            </h1>
            <Link
              href="/today"
              className="font-sans text-sm text-accent-sepia hover:text-deep-brown underline underline-offset-2"
            >
              Go to Yadegar →
            </Link>
          </div>
        )}
        {status === "error" && (
          <div>
            <h1 className="font-display text-3xl text-deep-brown mb-3">
              That link didn't work.
            </h1>
            <p className="font-body text-soft-ink mb-5">
              It may have expired or already been used. You can ask for a fresh
              one from inside Yadegar.
            </p>
            <Link
              href="/today"
              className="font-sans text-sm text-accent-sepia hover:text-deep-brown underline underline-offset-2"
            >
              Go to Yadegar →
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
