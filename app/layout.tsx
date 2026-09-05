import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MedLens | Clinical information, organized for review",
  description: "A synthetic-demo tool for organizing medical information for review.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
