// Full-screen layout for the template demos: deliberately stripped down — none
// of the landing navbar or footer. The demo storefront fills the whole screen.
export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
