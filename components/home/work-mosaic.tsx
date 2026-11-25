import Image from "next/image";

import type { PublicGalleryItem } from "@/lib/public/gallery";

const tiles = ["work-tile-a", "work-tile-b", "work-tile-c", "work-tile-d", "work-tile-e"];

export function WorkMosaic({ items }: { items: PublicGalleryItem[] }) {
  const photos = items.filter((item) => item.image || item.video?.poster).slice(0, tiles.length);
  return (
    <ul className="work-mosaic" data-count={photos.length}>
      {photos.map((item, index) => {
        const image = item.image ?? item.video?.poster ?? null;
        if (!image) return null;
        return (
          <li key={item.id} data-gallery-item="" className={`work-tile ${tiles[index]}`}>
            <figure className="rounded-card bg-soft relative h-full overflow-clip">
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes={
                  index === 0 ? "(min-width: 1024px) 40vw, 100vw" : "(min-width: 1024px) 25vw, 50vw"
                }
                placeholder={image.blurDataURL ? "blur" : "empty"}
                blurDataURL={image.blurDataURL ?? undefined}
                className="card-photo object-cover"
              />
              {item.caption ? (
                <figcaption className="rounded-pill text-micro text-ink absolute right-3 bottom-3 left-3 bg-white/90 px-3.5 py-2 backdrop-blur-sm">
                  {item.caption}
                </figcaption>
              ) : null}
            </figure>
          </li>
        );
      })}
    </ul>
  );
}
