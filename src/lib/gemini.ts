import { GoogleGenAI } from '@google/genai';

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

interface ChatContext {
  zoning?: {
    district: string;
    coverageRatio: number;
    floorAreaRatio: number;
    absoluteHeightLimit: number | null;
    wallSetback: number | null;
    fireDistrict: string;
  };
  result?: {
    maxFloorArea: number;
    maxCoverageArea: number;
    maxHeight: number;
    maxFloors: number;
  };
  siteArea?: number;
}

const SYSTEM_PROMPT = `あなたは日本の建築基準法に精通した建築ボリュームチェックのAIアシスタントです。

役割:
- 法規制（用途地域、建ぺい率、容積率、斜線制限、日影規制、天空率）の解説
- 建築計画の最適化提案
- 法改正情報の提供

回答ルール:
- 簡潔に回答（3-5文以内）
- 建築基準法の条文番号を引用（例: 法56条1項1号）
- 数値は具体的に提示
- 不確実な場合は「確認が必要」と明記`;

export async function chatWithGemini(message: string, context: ChatContext): Promise<string> {
  const contextStr = context.zoning
    ? `\n\n【現在の敷地データ】\n用途地域: ${context.zoning.district}\n建ぺい率: ${(context.zoning.coverageRatio * 100).toFixed(0)}%\n容積率: ${(context.zoning.floorAreaRatio * 100).toFixed(0)}%\n防火地域: ${context.zoning.fireDistrict}\n絶対高さ制限: ${context.zoning.absoluteHeightLimit ?? 'なし'}m\n外壁後退: ${context.zoning.wallSetback ?? 'なし'}m\n敷地面積: ${context.siteArea ?? '不明'}㎡` +
      (context.result
        ? `\n\n【計算結果】\n最大延床面積: ${context.result.maxFloorArea.toFixed(1)}㎡\n最大建築面積: ${context.result.maxCoverageArea.toFixed(1)}㎡\n最大高さ: ${context.result.maxHeight.toFixed(1)}m\n最大階数: ${context.result.maxFloors}F`
        : '')
    : '';

  try {
    const response = await genai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: SYSTEM_PROMPT + contextStr + '\n\n質問: ' + message }],
        },
      ],
    });

    return response.text || '回答を生成できませんでした。';
  } catch (error) {
    console.error('Gemini API error:', error);
    if (error instanceof Error && error.message.includes('API key')) {
      return 'Gemini API キーが設定されていません。環境変数 GEMINI_API_KEY を設定してください。';
    }
    return 'AIアシスタントに接続できませんでした。しばらく待ってから再度お試しください。';
  }
}
