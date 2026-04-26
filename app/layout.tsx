import type { Metadata } from "next";
import { Lexend } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "BidBuzz | Own the Game. Win the Bid.",
  description:
    "BidBuzz is the ultimate sports auction platform where every bid is a battle and every win is glory. Build your dream squad, outsmart your rivals, and dominate the auction floor.",
  keywords: ["sports", "auction", "tournament", "team management", "live auction", "Live", "Bid", "Champions", "Arena", "Thrill", "Trophy", "Auction Platform", "Squad", "Dominate", "Glory", "Cricket Auction", "Football Auction", "Basketball Auction", "Hockey Auction", "Volleyball Auction"],
  icons: {
    icon: [
      { url: "/brand/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/brand/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${lexend.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
