"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";

interface MobileCarouselProps {
  children: React.ReactNode;
  /** Carousel item basis class (default: basis-[85%]) */
  itemClassName?: string;
  /** Show dot indicators (default: true) */
  dots?: boolean;
  className?: string;
}

/**
 * A horizontal carousel with dot indicators.
 * Designed to be used inside a `md:hidden` or `lg:hidden` wrapper
 * so it only renders on mobile breakpoints.
 */
export function MobileCarousel({
  children,
  itemClassName,
  dots = true,
  className,
}: MobileCarouselProps) {
  const items = React.Children.toArray(children);
  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState(0);
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    if (!api) return;

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap());

    const onSelect = () => setCurrent(api.selectedScrollSnap());
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  return (
    <Carousel
      setApi={setApi}
      opts={{ align: "start", loop: false }}
      className={cn("w-full", className)}
    >
      <CarouselContent className="-ml-3">
        {items.map((child, i) => (
          <CarouselItem
            key={i}
            className={cn("pl-3 basis-[85%]", itemClassName)}
          >
            {child}
          </CarouselItem>
        ))}
      </CarouselContent>

      {dots && count > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {Array.from({ length: count }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Aller au slide ${i + 1}`}
              aria-current={current === i}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                current === i
                  ? "w-7 bg-primary"
                  : "w-2 bg-foreground/25 hover:bg-foreground/40"
              )}
              onClick={() => api?.scrollTo(i)}
            />
          ))}
        </div>
      )}
    </Carousel>
  );
}
