import type { Metadata } from "next";
import "./globals.css";
import "../ui/uikit.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Interview Trainer",
  description: "Тренажёр задач для подготовки к техническим собеседованиям",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" data-theme="dark">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
