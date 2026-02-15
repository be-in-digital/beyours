export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex">
      {/* Sidebar - will be replaced by AdminLayout component */}
      <aside className="w-64 border-r bg-card hidden lg:block">
        <div className="p-6">
          <h2 className="font-bold text-lg">Admin</h2>
        </div>
        <nav className="px-3 space-y-1">
          {[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Orders", href: "/orders" },
            { label: "Products", href: "/products" },
            { label: "Categories", href: "/categories" },
            { label: "Kitchen", href: "/kitchen" },
            { label: "Team", href: "/team" },
            { label: "Stores", href: "/stores" },
            { label: "Payments", href: "/payments" },
            { label: "Languages", href: "/languages" },
            { label: "Design", href: "/design" },
            { label: "Games", href: "/games" },
            { label: "Settings", href: "/settings" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="block px-3 py-2 rounded-md text-sm hover:bg-accent"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>
      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <header className="h-16 border-b flex items-center px-6">
          <span className="text-sm text-muted-foreground">Admin Dashboard</span>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
