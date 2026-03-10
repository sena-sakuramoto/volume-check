const mockGenerateContent = jest.fn();

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: mockGenerateContent,
    },
  })),
}));

import { POST } from '../route';

type RouteRequest = Parameters<typeof POST>[0];

describe('/api/analyze-site', () => {
  const originalApiKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key';
    mockGenerateContent.mockReset();
  });

  afterAll(() => {
    process.env.GEMINI_API_KEY = originalApiKey;
  });

  test('道路方向が日本語でも正規化して受け入れる', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        site: {
          vertices: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
          ],
          area: 100,
        },
        roads: [
          {
            direction: '南',
            width: 6,
            edgeVertexIndices: [0, 1],
          },
        ],
      }),
    });

    const formData = new FormData();
    formData.append('file', new File([new Uint8Array([1, 2, 3])], 'plan.png', { type: 'image/png' }));

    const req = new Request('http://localhost/api/analyze-site', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req as RouteRequest);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.roads[0].direction).toBe('south');
    expect(body.roads[0].sourceLabel).toBe('Gemini Vision OCR');
    expect(body.roads[0].confidence).toBe('low');
  });
});
