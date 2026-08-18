import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/context/AuthContext";
import { PermissionProvider } from "@/shared/services/permissions/PermissionContext";
import { PageTitleProvider } from "@/shared/context/PageTitleContext";
import { SidebarProvider } from "@/shared/context/SidebarContext";

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PermissionProvider>
          <PageTitleProvider>
            <SidebarProvider>
              {children}
            </SidebarProvider>
          </PageTitleProvider>
        </PermissionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
