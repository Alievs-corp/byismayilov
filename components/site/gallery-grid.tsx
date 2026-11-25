import Image from "next/image";

import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { PublicGalleryItem } from "@/lib/public/gallery";
import type { PublicImage } from "@/lib/public/images";

const sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";

function Photo({ image, label }: { image: PublicImage; label?: string }) {
  return (
    <figure className="bg-soft relative aspect-[4/5] overflow-clip">
      <Image
        src={image.src}
        alt={image.alt}
        fill
        sizes={sizes}
        placeholder={image.blurDataURL ? "blur" : "empty"}
        blurDataURL={image.blurDataURL ?? undefined}
        className="object-cover"
      />
      {label ? (
        <figcaption className="absolute top-3 left-3 bg-white px-2 py-1 text-small">
          {label}
        </figcaption>
      ) : null}
    </figure>
  );
}

export function GalleryGrid({ items, dict }: { items: PublicGalleryItem[]; dict: Dictionary }) {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.id} data-gallery-item="" className="flex flex-col gap-2">
          {item.video ? (
            <video
              controls
              muted
              playsInline
              preload="none"
              poster={item.video.poster?.src}
              aria-label={item.caption ?? undefined}
              className="bg-soft aspect-[4/5] w-full object-cover"
            >
              <source src={item.video.src} type={item.video.type} />
            </video>
          ) : item.image && item.before ? (
            <div className="grid grid-cols-2 gap-2">
              <Photo image={item.before} label={dict.gallery.before} />
              <Photo image={item.image} label={dict.gallery.after} />
            </div>
          ) : item.image ? (
            <Photo image={item.image} />
          ) : null}
          {item.caption ? <p className="text-small">{item.caption}</p> : null}
        </li>
      ))}
    </ul>
  );
}
