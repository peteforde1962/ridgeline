import "./globals.css";

export const metadata = {
  title: "RidgeLine — MTB Training",
  description: "Mountain bike training plans, skills, and recovery.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
