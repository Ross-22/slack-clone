"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useState, FormEvent } from "react";

export default function SignIn() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("flow", flow);
    try {
      await signIn("password", formData);
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: "var(--bg)",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          position: "fixed",
          top: "35%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(122,110,245,0.07) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          width: "100%",
          maxWidth: 380,
          display: "flex",
          flexDirection: "column",
          gap: 24,
          animation: "fadeSlideUp 0.3s ease-out",
        }}
      >
        <div
          style={{
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background:
                "linear-gradient(135deg, var(--accent) 0%, #a78bfa 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              fontWeight: 700,
              color: "#fff",
              boxShadow: "0 4px 20px var(--accent-glow)",
            }}
          >
            S
          </div>
          <div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "var(--text)",
                margin: 0,
                letterSpacing: "-0.03em",
              }}
            >
              Welcome to Slackr
            </h1>
            <p
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                margin: "6px 0 0",
              }}
            >
              {flow === "signIn"
                ? "Sign in to continue to your workspace"
                : "Create an account to get started"}
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            background: "var(--surface)",
            border: "1px solid var(--border-strong)",
            borderRadius: 14,
            padding: "24px",
          }}
        >
          <AuthInput
            type="email"
            name="email"
            placeholder="Email address"
            required
            autoComplete="email"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <AuthInput
              type="password"
              name="password"
              placeholder="Password"
              minLength={8}
              required
              autoComplete={
                flow === "signIn" ? "current-password" : "new-password"
              }
            />
            {flow === "signUp" && (
              <p
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  margin: "2px 0 0 2px",
                }}
              >
                At least 8 characters
              </p>
            )}
          </div>

          <SubmitButton loading={loading} flow={flow} />

          {error && (
            <div
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 13,
                color: "#f87171",
                animation: "fadeSlideUp 0.15s ease-out",
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 6,
              fontSize: 13,
              marginTop: 4,
            }}
          >
            <span style={{ color: "var(--text-muted)" }}>
              {flow === "signIn"
                ? "Don't have an account?"
                : "Already have an account?"}
            </span>
            <button
              type="button"
              onClick={() => {
                setFlow(flow === "signIn" ? "signUp" : "signIn");
                setError(null);
              }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--accent)",
                fontSize: 13,
                fontWeight: 500,
                fontFamily: "inherit",
                padding: 0,
              }}
            >
              {flow === "signIn" ? "Sign up" : "Sign in"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AuthInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...props}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      style={{
        background: "var(--surface-2)",
        border: `1px solid ${focused ? "rgba(122,110,245,0.5)" : "var(--border-strong)"}`,
        borderRadius: 8,
        padding: "10px 13px",
        fontSize: 14,
        color: "var(--text)",
        outline: "none",
        fontFamily: "inherit",
        width: "100%",
        transition: "border-color 0.15s",
      }}
    />
  );
}

function SubmitButton({
  loading,
  flow,
}: {
  loading: boolean;
  flow: "signIn" | "signUp";
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="submit"
      disabled={loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: loading
          ? "var(--surface-2)"
          : "linear-gradient(135deg, var(--accent) 0%, #9178f8 100%)",
        border: "none",
        borderRadius: 9,
        padding: "11px",
        fontSize: 14,
        fontWeight: 600,
        color: loading ? "var(--text-muted)" : "#fff",
        cursor: loading ? "not-allowed" : "pointer",
        transition: "transform 0.1s, box-shadow 0.15s",
        fontFamily: "inherit",
        marginTop: 4,
        boxShadow:
          !loading && hovered
            ? "0 4px 18px var(--accent-glow)"
            : loading
            ? "none"
            : "0 2px 12px var(--accent-glow)",
        transform: !loading && hovered ? "scale(1.02)" : "scale(1)",
      }}
    >
      {loading ? "Please wait…" : flow === "signIn" ? "Sign in" : "Create account"}
    </button>
  );
}
