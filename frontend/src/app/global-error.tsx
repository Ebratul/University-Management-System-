"use client";

import { useEffect } from "react";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

/**
 * Last-resort boundary for errors in the root layout itself. The layout (and
 * therefore the providers and fonts) may not have rendered, so this file
 * uses plain elements and no app components.
 */
export default function GlobalError({ error, retry }: GlobalErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          fontFamily: "system-ui, sans-serif",
          background: "#f5f6ff",
          color: "#1d1b3a",
        }}
      >
        <main style={{ maxWidth: 420, textAlign: "center", display: "grid", gap: 16 }}>
          <h1 style={{ fontSize: 24, margin: 0 }}>Something went wrong</h1>
          <p style={{ margin: 0, color: "#5b5878" }}>
            The application failed to load. Please try again.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              justifySelf: "center",
              border: 0,
              borderRadius: 10,
              padding: "10px 18px",
              fontWeight: 600,
              color: "#ffffff",
              background: "linear-gradient(120deg, #4a48d6, #8a3ddb 55%, #e0457a)",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
