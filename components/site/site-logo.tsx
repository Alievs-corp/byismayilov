import Image from "next/image";

import type { SiteImage } from "@/lib/public/settings";

import { Wordmark } from "./wordmark";

export function SiteLogo({
  image,
  name,
  className,
}: {
  image: SiteImage | null;
  name: string;
  className?: string;
}) {
  if (image?.width && image.height) {
    return (
      <Image
        src={image.src}
        alt={name}
        width={image.width}
        height={image.height}
        sizes="200px"
        className="h-9 w-auto md:h-11"
      />
    );
  }
  return <Wordmark name={name} className={className} />;
}
