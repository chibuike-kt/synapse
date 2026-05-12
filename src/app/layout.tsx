import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Synapse",
  description: "Ambient intelligence system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ margin: 0, background: "#03040a", overflow: "hidden" }}>
        {children}
      </body>
    </html>
  );
}
