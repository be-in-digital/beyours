// Layout plein écran des démos de templates : volontairement dépouillé — pas
// de navbar ni de footer de la landing. Le storefront démo occupe tout l'écran.
export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
