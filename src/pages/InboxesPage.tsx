import { useSession } from "@/lib/auth-client";
import { Navigate } from "react-router-dom";
import AdminInboxTable from "@/components/AdminInboxTable";

export default function InboxesPage() {
  const { data: session } = useSession();
  if (session?.user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }
  return (
    <div className="flex-1 overflow-auto p-6">
      <h1 className="text-lg font-semibold text-text-primary mb-2">Inboxes</h1>
      <p className="mb-6 text-sm text-text-secondary">
        Set display names and control which members can access each inbox.
      </p>
      <AdminInboxTable />
    </div>
  );
}
