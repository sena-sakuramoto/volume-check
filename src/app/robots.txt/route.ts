export const dynamic = 'force-static';

export function GET() {
  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    'Sitemap: /sitemap.xml',
    '',
  ].join('\n');
  return new Response(body, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
