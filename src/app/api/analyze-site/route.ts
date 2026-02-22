import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

/**
 * Analyze a survey map (測量図) or property summary (概要書) image
 * using Gemini Vision to extract site boundary and zoning data.
 *
 * POST body: FormData with 'file' field (image or PDF)
 * Response: { vertices, area, roads?, zoning? }
 */

const EXTRACTION_PROMPT = `あなたは建築士向けの敷地分析AIです。
アップロードされた画像（測量図、公図、物件概要書、配置図など）から以下の情報をJSON形式で抽出してください。

必須出力:
{
  "type": "survey" | "summary" | "unknown",
  "site": {
    "vertices": [
      {"x": 0, "y": 0},
      {"x": 間口(m), "y": 0},
      ...
    ],
    "area": 敷地面積(m²),
    "frontageWidth": 間口(m),
    "depth": 奥行(m)
  },
  "roads": [
    {
      "direction": "south" | "north" | "east" | "west",
      "width": 道路幅員(m)
    }
  ],
  "zoning": {
    "district": "用途地域名（13種類のいずれか）" | null,
    "coverageRatio": 建ぺい率(0-1) | null,
    "floorAreaRatio": 容積率(0-1) | null,
    "fireDistrict": "防火地域" | "準防火地域" | "指定なし" | null
  },
  "confidence": "high" | "medium" | "low",
  "notes": "読み取れた追加情報や注意事項"
}

ルール:
- 座標は道路側を下(y=0)に、左下を原点(0,0)とする
- 矩形に近い敷地は矩形として近似してOK
- 不整形の場合は各頂点の座標を計算（辺の長さと角度から）
- 単位はメートル
- 読み取れない項目はnullにする
- 面積の単位が坪の場合は m² に変換（1坪 = 3.30579 m²）
- 13種類の用途地域: 第一種低層住居専用地域、第二種低層住居専用地域、第一種中高層住居専用地域、第二種中高層住居専用地域、第一種住居地域、第二種住居地域、準住居地域、田園住居地域、近隣商業地域、商業地域、準工業地域、工業地域、工業専用地域
- 建ぺい率・容積率は小数（60%なら0.6）で返す

JSONのみ出力し、他のテキストは含めないでください。`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY が設定されていません。.env.local に設定してください。' },
      { status: 500 },
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'ファイルが必要です' }, { status: 400 });
    }

    // Validate file type
    const validTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'application/pdf',
    ];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: '対応形式: JPEG, PNG, WebP, HEIC, PDF' },
        { status: 400 },
      );
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'ファイルサイズは10MB以下にしてください' },
        { status: 400 },
      );
    }

    // Convert to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    const genai = new GoogleGenAI({ apiKey });

    const response = await genai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: file.type,
                data: base64,
              },
            },
            { text: EXTRACTION_PROMPT },
          ],
        },
      ],
    });

    const text = response.text || '';

    // Extract JSON from response (might be wrapped in ```json ... ```)
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    try {
      const parsed = JSON.parse(jsonStr.trim());
      return NextResponse.json(parsed);
    } catch {
      console.error('Failed to parse Gemini response as JSON:', text);
      return NextResponse.json(
        {
          error: '画像の解析結果をパースできませんでした。より鮮明な画像をお試しください。',
          raw: text,
        },
        { status: 422 },
      );
    }
  } catch (error) {
    console.error('Analyze site error:', error);
    const message =
      error instanceof Error && error.message.includes('API key')
        ? 'Gemini APIキーが無効です'
        : '画像の解析に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
