import { NextRequest, NextResponse } from 'next/server';
import { chatWithGemini } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({
      reply: 'AIアシスタントを利用するには環境変数 GEMINI_API_KEY を設定してください。設定なしでもボリュームチェック機能はご利用いただけます。',
    });
  }

  try {
    const { message, context } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const reply = await chatWithGemini(message, context || {});
    return NextResponse.json({ reply });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'チャットAPIでエラーが発生しました' },
      { status: 500 },
    );
  }
}
