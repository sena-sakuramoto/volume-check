import { POST } from '../route';

type RouteRequest = Parameters<typeof POST>[0];

describe('/api/geocode', () => {
  const originalFetch = global.fetch;
  const successPayload = [
    {
      geometry: { coordinates: [139.710785, 35.633438] },
      properties: { title: '東京都目黒区下目黒二丁目１９番１号' },
    },
  ];

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('郵便番号付き住所でもジオコーディングできる', async () => {
    const rawAddress = '〒153-0064 東京都目黒区下目黒２丁目１９−１';
    const expectedQuery = '東京都目黒区下目黒２丁目１９−１';

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      const query = new URL(url).searchParams.get('q');

      if (query === expectedQuery) {
        return new Response(
          JSON.stringify(successPayload),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const req = new Request('http://localhost/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: rawAddress }),
    });

    const res = await POST(req as RouteRequest);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({
      lat: 35.633438,
      lng: 139.710785,
      address: '東京都目黒区下目黒二丁目１９番１号',
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('クエリ揺れで1回目が0件でも正規化クエリにフォールバックして成功する', async () => {
    const rawAddress = '東京都目黒区 下目黒2丁目19−1';
    const successQuery = '東京都目黒区下目黒2丁目19-1';

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      const query = new URL(url).searchParams.get('q');
      const payload = query === successQuery ? successPayload : [];
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const req = new Request('http://localhost/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: rawAddress }),
    });

    const res = await POST(req as RouteRequest);
    expect(res.status).toBe(200);

    const calls = (global.fetch as jest.Mock).mock.calls.map((args) =>
      new URL(String(args[0])).searchParams.get('q'),
    );
    expect(calls).toEqual([
      '東京都目黒区 下目黒2丁目19−1',
      '東京都目黒区下目黒2丁目19−1',
      '東京都目黒区 下目黒2丁目19-1',
      '東京都目黒区下目黒2丁目19-1',
    ]);
  });

  test('丁目・番・号の表記揺れをハイフン形式へ正規化してフォールバックできる', async () => {
    const rawAddress = '東京都目黒区下目黒2丁目19番1号';
    const successQuery = '東京都目黒区下目黒2-19-1';

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      const query = new URL(url).searchParams.get('q');
      const payload = query === successQuery ? successPayload : [];
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const req = new Request('http://localhost/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: rawAddress }),
    });

    const res = await POST(req as RouteRequest);
    expect(res.status).toBe(200);

    const calls = (global.fetch as jest.Mock).mock.calls.map((args) =>
      new URL(String(args[0])).searchParams.get('q'),
    );
    expect(calls[0]).toBe(rawAddress);
    expect(calls).toContain(successQuery);
  });

  test('建物名・号室付き住所でも住所本体へ段階的にフォールバックして成功する', async () => {
    const rawAddress = '東京都目黒区下目黒2-19-1 目黒マンション 101号室';
    const successQuery = '東京都目黒区下目黒2-19-1';

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      const query = new URL(url).searchParams.get('q');
      const payload = query === successQuery ? successPayload : [];
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const req = new Request('http://localhost/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: rawAddress }),
    });

    const res = await POST(req as RouteRequest);
    expect(res.status).toBe(200);

    const calls = (global.fetch as jest.Mock).mock.calls.map((args) =>
      new URL(String(args[0])).searchParams.get('q'),
    );
    expect(calls[0]).toBe(rawAddress);
    expect(calls.length).toBeGreaterThan(1);
    expect(calls).toContain(successQuery);
  });

  test('候補クエリの途中でJSONが壊れたレスポンスが返っても次候補で継続する', async () => {
    const rawAddress = '東京都目黒区 下目黒2丁目19−1';
    let callCount = 0;

    global.fetch = jest.fn(async () => {
      callCount += 1;
      if (callCount === 1) {
        return new Response('', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(successPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const req = new Request('http://localhost/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: rawAddress }),
    });

    const res = await POST(req as RouteRequest);
    expect(res.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('全候補が0件なら404を返す', async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as typeof fetch;

    const req = new Request('http://localhost/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: '〒000-0000 存在しない住所' }),
    });

    const res = await POST(req as RouteRequest);
    expect(res.status).toBe(404);
  });
});
