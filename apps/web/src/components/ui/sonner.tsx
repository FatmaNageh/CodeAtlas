"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        style: {
          background: "var(--s0)",
          border: "1px solid var(--b2)",
          color: "var(--t0)",
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
          borderRadius: "10px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        },
      }}
      style={
        {
          "--normal-bg":     "var(--s0)",
          "--normal-text":   "var(--t0)",
          "--normal-border": "var(--b2)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };