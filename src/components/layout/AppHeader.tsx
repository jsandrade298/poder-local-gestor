import { NotificationsDropdown } from "@/components/layout/NotificationsDropdown";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export function AppHeader() {
  return (
    <header className="flex h-16 items-center gap-4 border-b bg-background px-6">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />
      
      <div className="flex-1" />
      
      {/* Notificações */}
      <NotificationsDropdown />
    </header>
  );
}