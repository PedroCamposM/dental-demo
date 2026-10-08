import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dental Demo",
  description: "Software clínico dental: historia clínica, plan de tratamiento y seguimiento del paciente",
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
