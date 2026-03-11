export default async function CategoryMenuPage({
  params,
}: {
  params: Promise<{ categorySlug: string }>
}) {
  const { categorySlug } = await params
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">Category Menu</h1>
      <p className="text-muted-foreground mt-2">
        Viewing category: {categorySlug}
      </p>
    </div>
  )
}
