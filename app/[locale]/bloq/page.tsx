import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { ArrowDownIcon, ArrowRightIcon } from "@/components/icons/iconsax";
import { button, buttonArrow, textLink } from "@/components/site/button";
import { EmptyState } from "@/components/site/empty-state";
import { PageHeading } from "@/components/site/page-heading";
import { localePath } from "@/lib/i18n/config";
import { fill } from "@/lib/i18n/format";
import { getRequestDictionary } from "@/lib/i18n/server";
import { formatPostDate, getPostPage, parsePageParam, postsPerPage } from "@/lib/public/content";
import { staticPaths } from "@/lib/public/slug";
import { routes } from "@/lib/routes";
import { blogIndexable } from "@/lib/seo/corpus";
import { pageMetadata, paginatedPaths } from "@/lib/seo/metadata";

export const instant = false;

export async function generateMetadata({
  searchParams,
}: PageProps<"/[locale]/bloq">): Promise<Metadata> {
  await connection();
  const [query, { locale, dict }] = await Promise.all([searchParams, getRequestDictionary()]);
  const page = parsePageParam(query.page);
  return pageMetadata({
    locale,
    title: dict.blog.title,
    description: dict.blog.description,
    paths: paginatedPaths(staticPaths(routes.blog()), page),
    og: { kind: "blog" },
    noIndex: !(await blogIndexable(locale)),
  });
}

export default async function BlogPage({ searchParams }: PageProps<"/[locale]/bloq">) {
  await connection();
  const [query, { locale, dict }] = await Promise.all([searchParams, getRequestDictionary()]);
  const page = parsePageParam(query.page);
  const { items, total } = await getPostPage(locale, page);
  if (page > 1 && (page - 1) * postsPerPage >= total) notFound();
  const path = localePath(locale, routes.blog());
  const [featured, ...rest] = items;

  return (
    <>
      <PageHeading
        title={dict.blog.title}
        lead={<p>{dict.blog.description}</p>}
        breadcrumbLabel={dict.common.breadcrumb}
        breadcrumbs={[
          { label: dict.common.home, href: localePath(locale) },
          { label: dict.blog.title, href: path },
        ]}
      />
      <div className="container-page py-section">
        {items.length ? (
          <>
            {featured ? (
              <article
                data-reveal=""
                className="group/card gap-x-column relative grid items-center gap-y-6 pb-14 lg:grid-cols-12 lg:pb-20"
              >
                {featured.image ? (
                  <div className="rounded-card bg-soft relative aspect-[4/3] overflow-clip lg:col-span-7">
                    <Image
                      src={featured.image.src}
                      alt={featured.image.alt}
                      fill
                      sizes="(min-width: 1024px) 56vw, 100vw"
                      loading="eager"
                      placeholder={featured.image.blurDataURL ? "blur" : "empty"}
                      blurDataURL={featured.image.blurDataURL ?? undefined}
                      className="card-photo object-cover"
                    />
                  </div>
                ) : null}
                <div
                  className={
                    featured.image
                      ? "flex flex-col gap-5 lg:col-span-5"
                      : "flex flex-col gap-5 lg:col-span-8"
                  }
                >
                  <time
                    dateTime={featured.publishedAt}
                    className="text-label text-caramel-ink tabular uppercase"
                  >
                    {formatPostDate(featured.publishedAt, locale)}
                  </time>
                  <h2 className="text-safe text-h2">
                    <Link
                      href={featured.href}
                      prefetch={false}
                      className="after:absolute after:inset-0"
                    >
                      {featured.title}
                    </Link>
                  </h2>
                  {featured.excerpt ? (
                    <p className="text-ink-muted max-w-xl text-lead">{featured.excerpt}</p>
                  ) : null}
                  <span className={`${textLink()} self-start`}>
                    {dict.blog.read}
                    <ArrowRightIcon size={20} className={buttonArrow} />
                  </span>
                </div>
              </article>
            ) : null}
            {rest.length ? (
              <ul
                data-reveal-group=""
                className="gap-x-column grid gap-y-14 border-t border-line pt-12 sm:grid-cols-2 lg:grid-cols-3"
              >
                {rest.map((post) => (
                  <li key={post.id} data-reveal="">
                    <article className="group/card relative flex h-full flex-col">
                      {post.image ? (
                        <div className="rounded-card bg-soft relative aspect-[4/3] overflow-clip">
                          <Image
                            src={post.image.src}
                            alt={post.image.alt}
                            fill
                            sizes="(min-width: 1024px) 31vw, (min-width: 640px) 46vw, 92vw"
                            placeholder={post.image.blurDataURL ? "blur" : "empty"}
                            blurDataURL={post.image.blurDataURL ?? undefined}
                            className="card-photo object-cover"
                          />
                        </div>
                      ) : null}
                      <time
                        dateTime={post.publishedAt}
                        className="text-label text-caramel-ink tabular mt-5 uppercase"
                      >
                        {formatPostDate(post.publishedAt, locale)}
                      </time>
                      <h2 className="text-safe mt-2 text-h4">
                        <Link
                          href={post.href}
                          prefetch={false}
                          className="decoration-1 underline-offset-4 group-hover/card:underline after:absolute after:inset-0"
                        >
                          {post.title}
                        </Link>
                      </h2>
                      {post.excerpt ? (
                        <p className="text-ink-muted mt-3 line-clamp-3 text-small">
                          {post.excerpt}
                        </p>
                      ) : null}
                    </article>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-16 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              {items.length < total ? (
                <Link
                  href={`${path}?page=${page + 1}`}
                  scroll={false}
                  className={button({ variant: "outline" })}
                >
                  {dict.blog.loadMore}
                  <ArrowDownIcon size={20} />
                </Link>
              ) : null}
              <p className="text-grey tabular text-small">
                {fill(dict.blog.shown, { shown: items.length, total })}
              </p>
            </div>
          </>
        ) : (
          <EmptyState
            title={dict.blog.empty}
            body={dict.blog.emptyBody}
            actions={[
              { label: dict.common.allServices, href: localePath(locale, routes.services()) },
            ]}
          />
        )}
      </div>
    </>
  );
}
