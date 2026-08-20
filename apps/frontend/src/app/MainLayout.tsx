import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import Sidebar from "@/shared/components/layout/Sidebar";
import { MobileBottomNav } from "@/shared/components/layout/MobileNav";
import "react-toastify/dist/ReactToastify.css";

export default function MainLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <ToastContainer style={{ zIndex: 99999 }} />
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4">
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </main>
        <MobileBottomNav />
      </div>
    </div>
  );
}
