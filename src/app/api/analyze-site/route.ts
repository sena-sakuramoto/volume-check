import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

/**
 * Analyze a survey map (測量図) or property summary (概要書) image
 * using Gemini Vision to extract site boundary and zoning data.
 *
 * POST body: FormData with 'file' field (image or PDF)
 * Response: { vertices, area, roads?, zoning? }
 */

const EXTRACTION_PROMPT = `あなたは建築士向けの敷地分析AIです。
アップロードされた画像（測量図、公図、物件概要書、配置図など）から敷地形状と道路情報を正確に読み取り、JSON形式で出力してください。

━━━━━━━━━━━━━━━━━━━━
【A】敷地形状の頂点座標
━━━━━━━━━━━━━━━━━━━━
測量図の場合：各辺の長さ(m)と角度が記載されています。それらを使って各頂点の(x, y)座標をメートル単位で正確に計算してください。

頂点座標の計算手順：
1. 道路に接する辺の左端を原点(0,0)とする
2. 道路に接する辺をx軸正方向に配置する
3. 各辺の長さと角度（内角・方位角）を読み取る
4. 1辺ずつ順番に、三角関数で次の頂点座標を算出する
5. 時計回り(CW)で全頂点を列挙する
6. 必ず3頂点以上を返す（矩形でも4頂点すべて返す）

【厳守】敷地形状の近似・単純化は一切禁止：
- 矩形への近似は絶対にしないこと
- 4辺の敷地でも各辺の長さ・角度が異なれば台形等として正確に返す
- 旗竿地（路地状敷地）は路地部分含め全頂点を返す
- 測量図に記載された辺長・角度をそのまま使い、丸めない

━━━━━━━━━━━━━━━━━━━━
【B】道路の認識（最重要）
━━━━━━━━━━━━━━━━━━━━
道路は斜線制限の計算に直結するため、正確に読み取ること。

道路の見つけ方：
- 「道路」「道」「市道」「区道」「都道」「県道」「私道」「通路」等のラベル
- 「W=○m」「幅員○m」「○m道路」等の幅員表記
- ハッチング（斜線模様）で塗られた領域
- 敷地に隣接する空白の帯状領域で寸法が記載されているもの
- 方位記号と道路の位置関係から方角を判断

道路の出力ルール：
- 敷地に接する道路をすべて列挙する（角地なら2本以上）
- widthは「幅員」の数値をそのまま使う（m単位）
- edgeVertexIndices: verticesの中で道路に接している辺の[始点index, 終点index]を正確に指定
  例: vertices[0]→vertices[1]が道路に面していれば [0, 1]
- direction: 道路が敷地のどちら側にあるかを方位記号から判断
  - 図面に方位記号（↑N 等）があれば、それに基づく
  - 方位記号がなければ、図面の上方向をNorthと仮定
- 道路幅員が読み取れない場合でもwidthをnullにせず、一般的な幅(4m)を仮定してnotes欄に明記

角地の判定：
- 2辺以上が道路に接していれば角地
- 角地の場合、roads配列に全ての道路を含める

━━━━━━━━━━━━━━━━━━━━
【C】出力JSON
━━━━━━━━━━━━━━━━━━━━
{
  "type": "survey" | "summary" | "unknown",
  "site": {
    "vertices": [
      {"x": 0, "y": 0},
      {"x": ..., "y": ...},
      ...全頂点を時計回りで
    ],
    "area": 敷地面積(m²),
    "frontageWidth": 道路に接する辺の長さ(m),
    "depth": おおよその奥行(m)
  },
  "roads": [
    {
      "direction": "south" | "north" | "east" | "west",
      "width": 道路幅員(m),
      "edgeVertexIndices": [始点index, 終点index]
    }
  ],
  "zoning": {
    "district": "用途地域名（13種類のいずれか）" | null,
    "coverageRatio": 建ぺい率(0-1) | null,
    "floorAreaRatio": 容積率(0-1) | null,
    "fireDistrict": "防火地域" | "準防火地域" | "指定なし" | null
  },
  "confidence": "high" | "medium" | "low",
  "notes": "道路の認識根拠（何を手がかりに道路と判断したか）を含めて記載"
}

ルール:
- 単位はメートル
- 読み取れない項目はnullにする
- 面積の単位が坪の場合は m² に変換（1坪 = 3.30579 m²）
- 13種類の用途地域: 第一種低層住居専用地域、第二種低層住居専用地域、第一種中高層住居専用地域、第二種中高層住居専用地域、第一種住居地域、第二種住居地域、準住居地域、田園住居地域、近隣商業地域、商業地域、準工業地域、工業地域、工業専用地域
- 建ぺい率・容積率は小数（60%なら0.6）で返す

JSONのみ出力し、他のテキストは含めないでください。`;

export const maxDuration = 300; // Allow up to 5 minutes for Gemini response

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

    // Try models in order of preference, falling back if unavailable
    const MODELS = [
      'gemini-3.1-pro-preview',
      'gemini-2.5-pro',
      'gemini-2.5-flash',
    ];

    let response;
    let lastError: unknown;
    for (const model of MODELS) {
      try {
        response = await genai.models.generateContent({
          model,
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
        break; // success
      } catch (e) {
        lastError = e;
        console.warn(`Model ${model} failed, trying next...`, e instanceof Error ? e.message : e);
        continue;
      }
    }

    if (!response) {
      throw lastError ?? new Error('All models failed');
    }

    const text = response.text || '';

    // Extract JSON from response (might be wrapped in ```json ... ```)
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // Zod schema for Gemini OCR output validation
    const GeminiOutputSchema = z.object({
      type: z.enum(['survey', 'summary', 'unknown']).optional(),
      site: z.object({
        vertices: z.array(z.object({ x: z.number(), y: z.number() })).min(3),
        area: z.number().positive(),
        frontageWidth: z.number().positive().optional(),
        depth: z.number().positive().optional(),
      }),
      roads: z.array(z.object({
        direction: z.enum(['south', 'north', 'east', 'west']),
        width: z.number().positive(),
        edgeVertexIndices: z.array(z.number().int().min(0)).length(2),
      })).optional(),
      zoning: z.object({
        district: z.string().nullable().optional(),
        coverageRatio: z.number().min(0).max(1).nullable().optional(),
        floorAreaRatio: z.number().min(0).nullable().optional(),
        fireDistrict: z.string().nullable().optional(),
      }).optional(),
      confidence: z.enum(['high', 'medium', 'low']).optional(),
      notes: z.string().optional(),
    });

    try {
      const parsed = JSON.parse(jsonStr.trim());

      // Validate with Zod
      const validated = GeminiOutputSchema.safeParse(parsed);
      if (!validated.success) {
        console.error('Gemini output validation failed:', validated.error.issues);
        return NextResponse.json(
          {
            error: 'AIの解析結果が期待された形式と一致しませんでした。別の画像をお試しください。',
            validationErrors: validated.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
            raw: parsed,
          },
          { status: 422 },
        );
      }

      return NextResponse.json(validated.data);
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
