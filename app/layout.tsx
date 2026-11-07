import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Cure · Ballot operations", template: "%s · Cure" },
  description:
    "Coordinate ballot curing, organize volunteer batches, and track every conversation.",
  robots: { index: false, follow: false },
  referrer: "same-origin",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
