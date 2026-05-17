import "./globals.css";
import MobileTabBar from "@/components/MobileTabBar";
import Sidebar from "@/components/Sidebar";

export const metadata = {
  title: "RidgeLine — MTB Training",
  description: "Mountain bike training plans, skills, and recovery.",
  themeColor: "#1a221b",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#1a221b",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Sidebar />
        {children}
        <MobileTabBar />
      </body>
    </html>
  );
}
