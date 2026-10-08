import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dental Demo – Dinero en riesgo",
  description: "Demo de software dental centrado en el plan de tratamiento",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-PE">
      <body className="antialiased">{children}</body>
    </html>
  );
}
