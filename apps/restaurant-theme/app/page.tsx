export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-bold tracking-tight">
          Welcome to Our Restaurant
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Discover our menu, order online, and enjoy the best dining experience.
        </p>
        <div className="flex gap-4 justify-center pt-4">
          <a
            href="/menu"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            View Menu
          </a>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md border px-6 py-3 text-sm font-medium hover:bg-accent"
          >
            Admin Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
