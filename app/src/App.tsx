import * as React from "react";
import { SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarGroup, SidebarGroupLabel, SidebarGroupContent } from "@/components/ui/sidebar";

function App() {
  const items = [
    {
      title: "Home",
      url: "#",
    },
    {
      title: "Inbox",
      url: "#",
    },
    {
      title: "Calendar",
      url: "#",
    },
    {
      title: "Search",
      url: "#",
    },
    {
      title: "Settings",
      url: "#",
    },
  ]
  
  return (
    <div className="flex h-screen">
      <SidebarProvider defaultOpen={false}>
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Application</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <a href={item.url}>
                          {/* <item.icon /> */}
                          <span>{item.title}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>
    </div>
  );
}

export default App;
