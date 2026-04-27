import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Workout Program Editor — CS372 Final Project",
  description:
    "Browse, edit, and coach strength-training programs. Turn your constraints and history into an adjusted week plan, then log sessions and iterate.",
  generator: "v0.app",
};

export const viewport: Viewport = {
  themeColor: "#FAF7F2",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="bg-background">
      <body
        className={`${inter.variable} ${fraunces.variable} font-sans antialiased`}
      >
        <WorkspaceProvider>
          <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
        </WorkspaceProvider>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  );
}
