import { Navigate, Outlet } from "react-router";
import { useAuthStore, hasRequiredRole } from "../../store/authStore";
import type { UserRole } from "../../types/auth";

type ProtectedRouteProps = {
  roles?: UserRole[];
};

export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const user = useAuthStore((state) => state.user);
  const bootstrapped = useAuthStore((state) => state.bootstrapped);

  if (!bootstrapped) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="text-muted-foreground">Загрузка...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !hasRequiredRole(user.role, roles)) {
    return <Navigate to="/access-denied" replace />;
  }

  return <Outlet />;
}
