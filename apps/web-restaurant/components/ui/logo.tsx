import Image from "next/image";
import Link from "next/link";

interface LogoProps {
  width?: number;
  height?: number;
  priority?: boolean;
  className?: string;
  linked?: boolean;
}

export function Logo({
  width = 140,
  height = 46,
  priority = false,
  className,
  linked = true,
}: LogoProps) {
  const img = (
    <Image
      src="/logo.png"
      alt="Be in Digital"
      width={width}
      height={height}
      priority={priority}
      className={className}
      style={{ width: "auto", height: "auto" }}
    />
  );

  if (!linked) return img;

  return (
    <Link href="/" className="shrink-0">
      {img}
    </Link>
  );
}
