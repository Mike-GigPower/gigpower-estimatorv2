import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GigPower Quote Estimator",
  description: "Online quote estimation tool (labour + non-labour).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
