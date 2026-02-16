import { DashboardContent } from "@/components/admin/dashboard"

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tableau de bord</h1>
        <p className="text-muted-foreground mt-2">
          Vue d'ensemble de vos métriques et analyses du restaurant.
        </p>
      </div>
      <DashboardContent />
    </div>
  )
}
