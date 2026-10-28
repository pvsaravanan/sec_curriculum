import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SEC Learners - UG Curriculum & Progress Dashboard",
  description: "Saveetha Engineering College (Autonomous) Undergraduate Curriculum (R19 & R24) Student Progress Tracker",
  icons: {
    icon: "/saveetha_logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/png" href="/saveetha_logo.png" />
      </head>
      <body className="bg-[#FAF7F0] text-[#18181B] min-h-screen font-sans flex flex-col selection:bg-[#FF5A5F] selection:text-white antialiased">
        {children}
      </body>
    </html>
  );
}
