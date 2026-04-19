export const dynamic = 'force-static';

const ROUTES = ['/', '/sky', '/m', '/m/input', '/m/compare', '/m/ai', '/m/report', '/m/3d'];

export function GET() {
  const now = new Date().toISOString();
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    ROUTES.map(
      (r) =>
        `  <url>\n    <loc>${r}</loc>\n    <lastmod>${now}</lastmod>\n  </url>`,
    ).join('\n') +
    '\n</urlset>\n';
  return new Response(body, {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
}
