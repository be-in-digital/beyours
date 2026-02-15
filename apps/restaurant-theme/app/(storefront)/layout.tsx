export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header will be added when UI components are ready */}
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <span className="font-bold text-xl">BeInDigital</span>
          <nav className="hidden md:flex items-center gap-6">
            <span className="text-sm text-muted-foreground">Menu</span>
            <span className="text-sm text-muted-foreground">Cart</span>
            <span className="text-sm text-muted-foreground">Account</span>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      {/* Footer will be added when UI components are ready */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Powered by BeInDigital Engine
        </div>
      </footer>
    </div>
  )
}
