import Link from 'next/link';

export default function LandingPage() {
  return (
    <div
      style={{
        background: '#0b0d10',
        color: '#f5f6f8',
        fontFamily:
          '"Space Grotesk", "Noto Sans JP", -apple-system, "Helvetica Neue", Arial, sans-serif',
        minHeight: '100vh',
        overflowX: 'hidden',
      }}
    >
      {/* ── Nav ── */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(11,13,16,0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div
          style={{
            maxWidth: 1160,
            margin: '0 auto',
            padding: '0 32px',
            height: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: '#5de4c7',
                letterSpacing: '-0.5px',
              }}
            >
              VolumeCheck
            </span>
            <span
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.35)',
                fontWeight: 500,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                paddingTop: 2,
              }}
            >
              Beta
            </span>
          </div>
          <Link
            href="/project"
            style={{
              background: '#5de4c7',
              color: '#0b0d10',
              padding: '8px 20px',
              borderRadius: 500,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
              letterSpacing: '-0.2px',
              transition: 'opacity 0.15s',
            }}
          >
            今すぐ試す →
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section
        style={{
          maxWidth: 1160,
          margin: '0 auto',
          padding: '120px 32px 80px',
          textAlign: 'center',
        }}
      >
        {/* Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(93,228,199,0.1)',
            border: '1px solid rgba(93,228,199,0.25)',
            borderRadius: 500,
            padding: '5px 14px',
            marginBottom: 32,
          }}
        >
          <span style={{ fontSize: 11, color: '#5de4c7', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            PLATEAU × AMX PMTiles 連携
          </span>
        </div>

        <h1
          style={{
            fontSize: 'clamp(40px, 6vw, 72px)',
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: '-0.03em',
            marginBottom: 24,
            background: 'linear-gradient(160deg, #f5f6f8 40%, rgba(245,246,248,0.55))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          用地検討を、<br />住所ひとつで。
        </h1>

        <p
          style={{
            fontSize: 18,
            color: 'rgba(255,255,255,0.55)',
            lineHeight: 1.75,
            maxWidth: 540,
            margin: '0 auto 48px',
            fontWeight: 400,
          }}
        >
          法規制の自動取得から3D最大ボリューム表示・事業性概算まで、<br />
          デベロッパーの初期検討を数分で完結させるWebツール。
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/project"
            style={{
              background: '#5de4c7',
              color: '#0b0d10',
              padding: '14px 36px',
              borderRadius: 500,
              fontSize: 15,
              fontWeight: 700,
              textDecoration: 'none',
              letterSpacing: '-0.3px',
            }}
          >
            無料で試す
          </Link>
          <a
            href="#features"
            style={{
              background: 'transparent',
              color: 'rgba(255,255,255,0.7)',
              padding: '14px 36px',
              borderRadius: 500,
              fontSize: 15,
              fontWeight: 500,
              textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.15)',
              letterSpacing: '-0.3px',
            }}
          >
            機能を見る
          </a>
        </div>

        {/* Visual: 3D building mockup in CSS */}
        <div
          style={{
            marginTop: 72,
            position: 'relative',
            height: 320,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          {/* Glow */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 600,
              height: 200,
              background: 'radial-gradient(ellipse at center, rgba(93,228,199,0.12) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />
          {/* Grid floor */}
          <svg
            width="700"
            height="200"
            viewBox="0 0 700 200"
            style={{ position: 'absolute', bottom: 0, opacity: 0.18 }}
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <line
                key={`v${i}`}
                x1={350 + (i - 6) * 50}
                y1={0}
                x2={350 + (i - 6) * 50}
                y2={200}
                stroke="#5de4c7"
                strokeWidth="0.5"
              />
            ))}
            {Array.from({ length: 6 }).map((_, i) => (
              <line
                key={`h${i}`}
                x1={0}
                y1={i * 40}
                x2={700}
                y2={i * 40}
                stroke="#5de4c7"
                strokeWidth="0.5"
              />
            ))}
          </svg>

          {/* 3D building (CSS isometric) */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Main building - front face */}
            <div
              style={{
                width: 180,
                height: 240,
                background: 'linear-gradient(180deg, #1a2235 0%, #111827 100%)',
                border: '1px solid rgba(93,228,199,0.3)',
                borderRadius: '2px 2px 0 0',
                position: 'relative',
              }}
            >
              {/* Window grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gridTemplateRows: 'repeat(6, 1fr)',
                  gap: 6,
                  padding: 16,
                  height: '100%',
                  boxSizing: 'border-box',
                }}
              >
                {Array.from({ length: 24 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      background: i % 7 === 0 || i % 5 === 0
                        ? 'rgba(93,228,199,0.4)'
                        : 'rgba(93,228,199,0.08)',
                      borderRadius: 1,
                    }}
                  />
                ))}
              </div>

              {/* Teal accent stripe */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  background: '#5de4c7',
                  borderRadius: '2px 2px 0 0',
                }}
              />
            </div>

            {/* Right face (3D effect) */}
            <div
              style={{
                position: 'absolute',
                right: -40,
                top: 24,
                width: 40,
                height: 240,
                background: 'linear-gradient(90deg, #0d1626 0%, #0a1020 100%)',
                border: '1px solid rgba(93,228,199,0.15)',
                borderLeft: 'none',
                borderRadius: '0 2px 0 0',
                transform: 'skewY(-45deg)',
                transformOrigin: 'left top',
              }}
            />

            {/* Top face */}
            <div
              style={{
                position: 'absolute',
                top: -20,
                right: -40,
                width: 180,
                height: 42,
                background: 'linear-gradient(135deg, #1e3a3a 0%, #162d2a 100%)',
                border: '1px solid rgba(93,228,199,0.4)',
                transform: 'skewX(-45deg)',
                transformOrigin: 'left bottom',
              }}
            />
          </div>

          {/* Setback lines annotation */}
          <div
            style={{
              position: 'absolute',
              bottom: 40,
              left: '50%',
              transform: 'translateX(-160px)',
              fontSize: 10,
              color: 'rgba(93,228,199,0.6)',
              fontFamily: '"JetBrains Mono", monospace',
              whiteSpace: 'nowrap',
            }}
          >
            ← 道路斜線制限
          </div>
          <div
            style={{
              position: 'absolute',
              top: 60,
              left: '50%',
              transform: 'translateX(150px)',
              fontSize: 10,
              color: 'rgba(244,184,96,0.7)',
              fontFamily: '"JetBrains Mono", monospace',
              whiteSpace: 'nowrap',
            }}
          >
            北側斜線 ↗
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section
        id="features"
        style={{
          maxWidth: 1160,
          margin: '0 auto',
          padding: '80px 32px',
        }}
      >
        <p
          style={{
            fontSize: 11,
            color: '#5de4c7',
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            textAlign: 'center',
            marginBottom: 16,
          }}
        >
          Features
        </p>
        <h2
          style={{
            fontSize: 'clamp(28px, 4vw, 44px)',
            fontWeight: 700,
            textAlign: 'center',
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
            marginBottom: 64,
          }}
        >
          検討に必要な情報を<br />すべて自動で揃える
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 20,
          }}
        >
          {[
            {
              icon: '🗺️',
              title: '筆界ポリゴン自動取得',
              desc: '法務省登記所備付地図（AMX PMTiles）を活用。住所検索後に地図上をクリックするだけで敷地形状を自動設定。手動入力不要。',
              tag: 'AMX PMTiles',
            },
            {
              icon: '⚖️',
              title: '法規制を一括自動取得',
              desc: 'PLATEAU urf MVT連携で用途地域・高度地区・地区計画・防火地域を自動取得。上乗せ規制まで見落としゼロ。',
              tag: 'PLATEAU urf',
            },
            {
              icon: '🏗️',
              title: '3D最大ボリューム計算',
              desc: '道路斜線・隣地斜線・北側斜線・絶対高さ制限を全て考慮した最大建築可能ボリュームをリアルタイム3D表示。',
              tag: '法規制完全対応',
            },
            {
              icon: '📊',
              title: '事業性概算を即算',
              desc: '用途（マンション/オフィス/商業/ホテル）を選ぶだけで、概算建設費・表面利回り・事業収支を自動計算。',
              tag: 'デベ向け',
            },
            {
              icon: '📄',
              title: 'PDF帳票で即提出',
              desc: '法規制サマリー・最大ボリューム・事業性概算を含む事業検討レポートをPDFで出力。上司・クライアントにそのまま提出可能。',
              tag: '帳票出力',
            },
            {
              icon: '🤖',
              title: 'AI解説クイックアクション',
              desc: '「何階建て可能？」「斜線制限は？」のワンクリックで計算結果をAIが解説。Gemini API対応。',
              tag: 'AI連携',
            },
          ].map((f) => (
            <div
              key={f.title}
              style={{
                background: '#11151d',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 14,
                padding: '28px 24px',
                transition: 'border-color 0.2s, transform 0.2s',
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 14 }}>{f.icon}</div>
              <div
                style={{
                  display: 'inline-block',
                  fontSize: 10,
                  color: 'rgba(93,228,199,0.7)',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  background: 'rgba(93,228,199,0.08)',
                  border: '1px solid rgba(93,228,199,0.15)',
                  borderRadius: 4,
                  padding: '2px 8px',
                  marginBottom: 10,
                }}
              >
                {f.tag}
              </div>
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  marginBottom: 10,
                  lineHeight: 1.4,
                }}
              >
                {f.title}
              </h3>
              <p
                style={{
                  fontSize: 13.5,
                  color: 'rgba(255,255,255,0.5)',
                  lineHeight: 1.7,
                  margin: 0,
                }}
              >
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section
        style={{
          background: '#0e1118',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          padding: '80px 32px',
        }}
      >
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <p
            style={{
              fontSize: 11,
              color: '#5de4c7',
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              textAlign: 'center',
              marginBottom: 16,
            }}
          >
            How it works
          </p>
          <h2
            style={{
              fontSize: 'clamp(26px, 3.5vw, 40px)',
              fontWeight: 700,
              textAlign: 'center',
              letterSpacing: '-0.03em',
              lineHeight: 1.2,
              marginBottom: 60,
            }}
          >
            3ステップで検討完了
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 0,
              position: 'relative',
            }}
          >
            {[
              {
                step: '01',
                title: '住所を入力して検索',
                desc: '住所を入力するだけ。geocode + 筆界取得 + 法規制取得をバックグラウンドで自動実行。',
              },
              {
                step: '02',
                title: '地図で敷地をクリック選択',
                desc: '候補の筆界ポリゴンが地図上に表示される。クリックするだけで敷地形状が自動設定。',
              },
              {
                step: '03',
                title: 'ボリューム + 事業性を確認',
                desc: '最大ボリュームの3D表示と事業性概算が即座に表示。PDF帳票で上司・クライアントに共有。',
              },
            ].map((s, i) => (
              <div
                key={s.step}
                style={{
                  padding: '0 36px',
                  borderRight: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: 48,
                    fontWeight: 800,
                    color: 'rgba(93,228,199,0.12)',
                    letterSpacing: '-0.04em',
                    lineHeight: 1,
                    marginBottom: 20,
                    fontFamily: '"JetBrains Mono", monospace',
                  }}
                >
                  {s.step}
                </div>
                <h3
                  style={{
                    fontSize: 17,
                    fontWeight: 600,
                    letterSpacing: '-0.02em',
                    marginBottom: 12,
                  }}
                >
                  {s.title}
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    color: 'rgba(255,255,255,0.45)',
                    lineHeight: 1.75,
                    margin: 0,
                  }}
                >
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Target users ── */}
      <section
        style={{
          maxWidth: 1160,
          margin: '0 auto',
          padding: '80px 32px',
        }}
      >
        <p
          style={{
            fontSize: 11,
            color: '#5de4c7',
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            textAlign: 'center',
            marginBottom: 16,
          }}
        >
          For whom
        </p>
        <h2
          style={{
            fontSize: 'clamp(26px, 3.5vw, 40px)',
            fontWeight: 700,
            textAlign: 'center',
            letterSpacing: '-0.03em',
            lineHeight: 1.2,
            marginBottom: 52,
          }}
        >
          初期検討の時間を<br />劇的に短縮する
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 20,
          }}
        >
          {[
            {
              role: '不動産デベロッパー',
              pain: '用地取得前の初期検討で法規制調査に何時間もかかる',
              gain: '住所を入れて数分で最大ボリューム・事業性を把握。稟議資料を即日作成。',
            },
            {
              role: '設計事務所',
              pain: '斜線制限の計算ミスや地区計画の見落としがリスク',
              gain: 'PLATEAUデータで上乗せ規制まで自動取得。計算ミスゼロ。3Dで視覚的に確認。',
            },
            {
              role: '不動産仲介・コンサル',
              pain: '顧客への概算説明に時間がかかり、専門家の補助が必要',
              gain: 'その場で試算してPDFを出力。概算建設費・利回りまで込みの提案資料を即提示。',
            },
          ].map((t) => (
            <div
              key={t.role}
              style={{
                background: '#11151d',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 14,
                padding: '28px 24px',
              }}
            >
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                  marginBottom: 14,
                  color: '#5de4c7',
                }}
              >
                {t.role}
              </h3>
              <p
                style={{
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.35)',
                  lineHeight: 1.7,
                  marginBottom: 12,
                  paddingLeft: 12,
                  borderLeft: '2px solid rgba(255,255,255,0.1)',
                }}
              >
                "{t.pain}"
              </p>
              <p
                style={{
                  fontSize: 13.5,
                  color: 'rgba(255,255,255,0.65)',
                  lineHeight: 1.7,
                  margin: 0,
                }}
              >
                → {t.gain}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section
        style={{
          background: 'linear-gradient(135deg, rgba(93,228,199,0.08) 0%, rgba(93,228,199,0.03) 100%)',
          borderTop: '1px solid rgba(93,228,199,0.15)',
          borderBottom: '1px solid rgba(93,228,199,0.15)',
          padding: '80px 32px',
          textAlign: 'center',
        }}
      >
        <h2
          style={{
            fontSize: 'clamp(28px, 4vw, 48px)',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
            marginBottom: 20,
          }}
        >
          今すぐ試してみる
        </h2>
        <p
          style={{
            fontSize: 16,
            color: 'rgba(255,255,255,0.5)',
            marginBottom: 40,
          }}
        >
          無料・登録不要。住所を入れるだけで試せます。
        </p>
        <Link
          href="/project"
          style={{
            background: '#5de4c7',
            color: '#0b0d10',
            padding: '16px 48px',
            borderRadius: 500,
            fontSize: 16,
            fontWeight: 700,
            textDecoration: 'none',
            letterSpacing: '-0.3px',
            display: 'inline-block',
          }}
        >
          VolumeCheck を開く →
        </Link>
      </section>

      {/* ── Disclaimer ── */}
      <section
        style={{
          maxWidth: 1160,
          margin: '0 auto',
          padding: '48px 32px 32px',
        }}
      >
        <p
          style={{
            fontSize: 12,
            color: 'rgba(255,255,255,0.25)',
            lineHeight: 1.8,
            textAlign: 'center',
          }}
        >
          本ツールは建築ボリュームの概算ツールであり、法的確認書類を生成するものではありません。
          実際の建築計画には、所管行政機関への確認および建築士による法適合確認が必要です。
          計算結果は入力データの精度に依存し、特定建築物・地区計画等の個別規制は考慮されていない場合があります。
        </p>
      </section>

      {/* ── Footer ── */}
      <footer
        style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '24px 32px',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontSize: 12,
            color: 'rgba(255,255,255,0.2)',
          }}
        >
          © 2026 VolumeCheck — Archi-Prisma Design works
        </p>
      </footer>
    </div>
  );
}
