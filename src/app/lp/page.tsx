'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Noto+Sans+JP:wght@400;500;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #060810;
    --bg2: #0a0d16;
    --surface: rgba(255,255,255,0.04);
    --surface-hover: rgba(255,255,255,0.07);
    --border: rgba(255,255,255,0.08);
    --border-hover: rgba(93,228,199,0.3);
    --text: #e2e8f4;
    --muted: rgba(255,255,255,0.42);
    --teal: #5de4c7;
    --teal-dim: rgba(93,228,199,0.12);
    --indigo: #818cf8;
    --indigo-dim: rgba(129,140,248,0.12);
    --font: "Space Grotesk", "Noto Sans JP", -apple-system, sans-serif;
    --mono: "JetBrains Mono", "SF Mono", monospace;
  }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font);
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
  }

  /* ── NAV ── */
  .nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    height: 56px;
    display: flex; align-items: center;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    background: rgba(6,8,16,0.7);
    backdrop-filter: saturate(180%) blur(20px);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
  }
  .nav-inner {
    max-width: 1160px; margin: 0 auto; padding: 0 32px;
    width: 100%; display: flex; align-items: center; justify-content: space-between;
  }
  .nav-logo {
    font-size: 17px; font-weight: 700; color: var(--teal);
    letter-spacing: -0.5px; text-decoration: none;
    display: flex; align-items: center; gap: 8px;
  }
  .nav-logo-badge {
    font-size: 10px; font-weight: 500; letter-spacing: 0.06em;
    color: rgba(255,255,255,0.3); text-transform: uppercase;
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 4px; padding: 2px 6px;
  }
  .nav-links {
    display: flex; gap: 32px; list-style: none;
  }
  .nav-links a {
    font-size: 13px; font-weight: 400;
    color: rgba(255,255,255,0.55); text-decoration: none;
    letter-spacing: -0.1px;
    transition: color 0.15s;
  }
  .nav-links a:hover { color: rgba(255,255,255,0.9); }
  .nav-cta {
    background: var(--teal); color: #060810;
    padding: 8px 20px; border-radius: 500px;
    font-size: 13px; font-weight: 700;
    text-decoration: none; letter-spacing: -0.2px;
    transition: opacity 0.15s;
  }
  .nav-cta:hover { opacity: 0.88; }

  /* ── HERO ── */
  .hero {
    position: relative;
    min-height: 100vh;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 140px 32px 80px;
    overflow: hidden;
  }

  /* Gradient blobs */
  .blob {
    position: absolute; border-radius: 50%;
    filter: blur(120px); pointer-events: none;
  }
  .blob-1 {
    width: 600px; height: 600px;
    background: radial-gradient(circle, rgba(93,228,199,0.18) 0%, transparent 70%);
    top: -100px; left: -200px;
    animation: float1 12s ease-in-out infinite;
  }
  .blob-2 {
    width: 500px; height: 500px;
    background: radial-gradient(circle, rgba(129,140,248,0.15) 0%, transparent 70%);
    top: 100px; right: -150px;
    animation: float2 15s ease-in-out infinite;
  }
  .blob-3 {
    width: 400px; height: 400px;
    background: radial-gradient(circle, rgba(244,114,182,0.08) 0%, transparent 70%);
    bottom: 0; left: 40%;
    animation: float3 18s ease-in-out infinite;
  }

  @keyframes float1 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(40px, 30px) scale(1.05); }
  }
  @keyframes float2 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(-30px, 40px) scale(0.95); }
  }
  @keyframes float3 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(20px, -30px) scale(1.08); }
  }

  /* Dot grid */
  .dot-grid {
    position: absolute; inset: 0; pointer-events: none;
    background-image: radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px);
    background-size: 32px 32px;
    mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%);
    -webkit-mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%);
  }

  /* Badge */
  .hero-badge {
    display: inline-flex; align-items: center; gap: 6px;
    background: rgba(93,228,199,0.08);
    border: 1px solid rgba(93,228,199,0.2);
    border-radius: 500px; padding: 5px 14px;
    margin-bottom: 28px;
    font-size: 11px; font-weight: 600;
    color: var(--teal); letter-spacing: 0.08em; text-transform: uppercase;
    animation: fadeUp 0.6s ease both;
  }
  .badge-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--teal);
    box-shadow: 0 0 6px var(--teal);
    animation: pulse 2s ease infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(0.8); }
  }

  /* Headline */
  .hero-h1 {
    font-size: clamp(44px, 7vw, 84px);
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 1.05;
    text-align: center;
    margin-bottom: 24px;
    animation: fadeUp 0.6s 0.1s ease both;
  }
  .hero-h1 .gradient {
    background: linear-gradient(135deg, #e2e8f4 30%, var(--teal) 70%, var(--indigo));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .hero-sub {
    font-size: clamp(15px, 2vw, 18px);
    color: var(--muted);
    line-height: 1.8;
    text-align: center;
    max-width: 520px;
    margin-bottom: 44px;
    font-weight: 400;
    animation: fadeUp 0.6s 0.2s ease both;
  }

  /* CTA group */
  .hero-ctas {
    display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;
    animation: fadeUp 0.6s 0.3s ease both;
  }
  .btn-primary {
    background: var(--teal); color: #060810;
    padding: 14px 36px; border-radius: 500px;
    font-size: 15px; font-weight: 700;
    text-decoration: none; letter-spacing: -0.3px;
    transition: opacity 0.15s, transform 0.15s;
    box-shadow: 0 0 32px rgba(93,228,199,0.25);
  }
  .btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }
  .btn-ghost {
    background: transparent; color: rgba(255,255,255,0.65);
    padding: 14px 36px; border-radius: 500px;
    font-size: 15px; font-weight: 500;
    text-decoration: none; letter-spacing: -0.3px;
    border: 1px solid rgba(255,255,255,0.12);
    transition: border-color 0.15s, color 0.15s;
  }
  .btn-ghost:hover { border-color: rgba(255,255,255,0.3); color: rgba(255,255,255,0.9); }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* ── APP MOCKUP ── */
  .mockup-wrap {
    position: relative;
    margin-top: 72px;
    width: 100%; max-width: 860px;
    animation: fadeUp 0.8s 0.4s ease both;
  }
  .mockup-glow {
    position: absolute; inset: -40px;
    background: radial-gradient(ellipse at 50% 100%, rgba(93,228,199,0.1) 0%, transparent 60%);
    pointer-events: none;
  }
  .mockup-frame {
    background: #0d1117;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05);
  }
  .mockup-titlebar {
    height: 36px; background: #0d1117;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    display: flex; align-items: center; padding: 0 16px; gap: 8px;
  }
  .dot-red { width:12px; height:12px; border-radius:50%; background:#ff5f57; }
  .dot-yellow { width:12px; height:12px; border-radius:50%; background:#ffbd2e; }
  .dot-green { width:12px; height:12px; border-radius:50%; background:#28c840; }
  .mockup-titlebar-label {
    flex: 1; text-align: center; font-size: 12px;
    color: rgba(255,255,255,0.25); font-family: var(--mono);
  }
  .mockup-body {
    display: flex; height: 420px;
  }
  .mockup-sidebar {
    width: 220px; min-width: 220px;
    background: #0d1117;
    border-right: 1px solid rgba(255,255,255,0.06);
    padding: 16px 12px;
    display: flex; flex-direction: column; gap: 6px;
  }
  .mockup-stepper-item {
    padding: 8px 10px; border-radius: 8px;
    display: flex; align-items: center; gap: 8px;
    font-size: 12px; color: rgba(255,255,255,0.4);
  }
  .mockup-stepper-item.active {
    background: rgba(93,228,199,0.1);
    color: var(--teal);
    border: 1px solid rgba(93,228,199,0.2);
  }
  .mockup-stepper-dot {
    width: 18px; height: 18px; border-radius: 50%;
    background: rgba(255,255,255,0.08);
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; font-family: var(--mono); font-weight: 700;
    flex-shrink: 0;
  }
  .mockup-stepper-item.active .mockup-stepper-dot {
    background: var(--teal); color: #060810;
  }
  .mockup-divider { height: 1px; background: rgba(255,255,255,0.05); margin: 4px 0; }
  .mockup-input-row {
    padding: 6px 10px; display: flex; align-items: center; gap: 6px;
  }
  .mockup-input-box {
    flex: 1; height: 28px; background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 6px;
    font-size: 10px; color: rgba(255,255,255,0.3);
    padding: 0 8px; display: flex; align-items: center;
    font-family: var(--mono);
  }
  .mockup-btn-search {
    height: 28px; padding: 0 10px;
    background: var(--teal); color: #060810;
    border-radius: 6px; font-size: 10px; font-weight: 700;
  }
  .mockup-badge-success {
    margin: 2px 10px; padding: 5px 10px; border-radius: 6px;
    background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.2);
    font-size: 10px; color: rgba(34,197,94,0.8);
    display: flex; align-items: center; gap: 5px;
  }
  .mockup-tag-row {
    padding: 4px 10px; display: flex; flex-wrap: wrap; gap: 4px;
  }
  .mockup-tag {
    font-size: 9px; padding: 2px 6px; border-radius: 4px;
    background: rgba(129,140,248,0.1); border: 1px solid rgba(129,140,248,0.2);
    color: var(--indigo); font-family: var(--mono);
  }

  /* 3D viewer area */
  .mockup-viewer {
    flex: 1; background: #080c14; position: relative; overflow: hidden;
  }
  .mockup-viewer-grid {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(rgba(93,228,199,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(93,228,199,0.04) 1px, transparent 1px);
    background-size: 40px 40px;
  }
  .mockup-viewer-glow {
    position: absolute; bottom: 0; left: 50%;
    transform: translateX(-50%);
    width: 400px; height: 200px;
    background: radial-gradient(ellipse at center bottom, rgba(93,228,199,0.12) 0%, transparent 70%);
  }

  /* CSS Building */
  .css-building {
    position: absolute;
    bottom: 60px; left: 50%; transform: translateX(-50%);
    display: flex; align-items: flex-end; gap: 8px;
  }
  .bldg {
    position: relative;
    background: linear-gradient(180deg, #1a2540 0%, #0f1a30 100%);
    border: 1px solid rgba(93,228,199,0.25);
    border-bottom: none;
  }
  .bldg-windows {
    position: absolute; inset: 8px;
    display: grid; gap: 3px;
  }
  .win {
    background: rgba(93,228,199,0.08);
    border-radius: 1px;
  }
  .win.lit { background: rgba(93,228,199,0.45); }
  .win.lit2 { background: rgba(244,184,96,0.5); }
  .bldg-top {
    position: absolute; top: -3px; left: -1px; right: -1px;
    height: 3px; background: var(--teal);
    box-shadow: 0 0 8px var(--teal);
  }

  .bldg-tall { width: 80px; height: 200px; }
  .bldg-tall .bldg-windows { grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(8, 1fr); }

  .bldg-mid { width: 60px; height: 140px; }
  .bldg-mid .bldg-windows { grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(5, 1fr); }

  .bldg-short { width: 50px; height: 100px; }
  .bldg-short .bldg-windows { grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(4, 1fr); }

  /* Slope line (道路斜線) */
  .slope-line {
    position: absolute;
    bottom: 60px; left: 30%;
    width: 200px; height: 160px;
    border-top: 1px dashed rgba(93,228,199,0.4);
    transform: rotate(-35deg);
    transform-origin: bottom left;
    pointer-events: none;
  }
  .slope-label {
    position: absolute; bottom: 30px; left: 10%;
    font-size: 9px; color: rgba(93,228,199,0.5);
    font-family: var(--mono); white-space: nowrap;
  }

  /* Metrics overlay */
  .mockup-metrics {
    position: absolute; top: 12px; right: 12px;
    display: flex; flex-direction: column; gap: 6px;
  }
  .metric-chip {
    background: rgba(13,17,23,0.85);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px; padding: 6px 10px;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  .metric-chip-label {
    font-size: 9px; color: var(--muted);
    font-family: var(--mono); letter-spacing: 0.06em; text-transform: uppercase;
  }
  .metric-chip-val {
    font-size: 14px; font-weight: 700;
    color: var(--teal); font-family: var(--mono);
  }

  /* ── STATS ── */
  .stats {
    border-top: 1px solid rgba(255,255,255,0.05);
    border-bottom: 1px solid rgba(255,255,255,0.05);
    padding: 40px 32px;
  }
  .stats-inner {
    max-width: 1160px; margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0;
  }
  .stat-item {
    text-align: center; padding: 0 32px;
    border-right: 1px solid rgba(255,255,255,0.05);
  }
  .stat-item:last-child { border-right: none; }
  .stat-num {
    font-size: 36px; font-weight: 700; letter-spacing: -0.04em;
    color: var(--teal); font-family: var(--mono);
    line-height: 1;
  }
  .stat-unit { font-size: 16px; font-weight: 400; color: var(--teal); }
  .stat-label { font-size: 12px; color: var(--muted); margin-top: 6px; }

  /* ── FEATURES BENTO ── */
  .features { max-width: 1160px; margin: 0 auto; padding: 100px 32px; }
  .section-eyebrow {
    font-size: 11px; font-weight: 600;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--teal); text-align: center; margin-bottom: 14px;
  }
  .section-title {
    font-size: clamp(28px, 4vw, 44px); font-weight: 700;
    letter-spacing: -0.04em; line-height: 1.12;
    text-align: center; margin-bottom: 60px;
  }
  .section-title span {
    background: linear-gradient(135deg, #e2e8f4 30%, var(--teal) 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .bento {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    grid-template-rows: auto;
    gap: 16px;
  }
  .bento-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px; padding: 28px 24px;
    transition: border-color 0.2s, background 0.2s;
    position: relative; overflow: hidden;
  }
  .bento-card:hover {
    border-color: rgba(93,228,199,0.25);
    background: rgba(255,255,255,0.055);
  }
  .bento-card::before {
    content: '';
    position: absolute; inset: 0;
    background: radial-gradient(circle at top left, rgba(93,228,199,0.05) 0%, transparent 60%);
    opacity: 0; transition: opacity 0.3s;
    pointer-events: none;
  }
  .bento-card:hover::before { opacity: 1; }

  .bc-1 { grid-column: span 5; }
  .bc-2 { grid-column: span 7; }
  .bc-3 { grid-column: span 4; }
  .bc-4 { grid-column: span 4; }
  .bc-5 { grid-column: span 4; }
  .bc-6 { grid-column: span 12; }

  .bento-icon {
    width: 40px; height: 40px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; margin-bottom: 16px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
  }
  .bento-tag {
    display: inline-block; font-size: 10px; font-weight: 600;
    letter-spacing: 0.07em; text-transform: uppercase;
    color: rgba(93,228,199,0.7); background: rgba(93,228,199,0.08);
    border: 1px solid rgba(93,228,199,0.15);
    border-radius: 4px; padding: 2px 8px; margin-bottom: 10px;
  }
  .bento-h3 {
    font-size: 17px; font-weight: 600; letter-spacing: -0.02em;
    line-height: 1.4; margin-bottom: 10px;
  }
  .bento-p {
    font-size: 13.5px; color: var(--muted); line-height: 1.7;
  }

  /* Feature card visual accent */
  .bento-visual {
    margin-top: 20px; padding: 14px 16px;
    background: rgba(0,0,0,0.3); border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.06);
    font-family: var(--mono); font-size: 11px; color: rgba(255,255,255,0.35);
    line-height: 1.8;
  }
  .bento-visual .kw { color: var(--teal); }
  .bento-visual .val { color: var(--indigo); }
  .bento-visual .comment { color: rgba(255,255,255,0.2); }

  /* ── STEPS ── */
  .steps-section {
    background: #070910;
    border-top: 1px solid rgba(255,255,255,0.04);
    border-bottom: 1px solid rgba(255,255,255,0.04);
    padding: 100px 32px;
  }
  .steps-inner { max-width: 1160px; margin: 0 auto; }
  .steps-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 40px; margin-top: 60px;
  }
  .step-item { display: flex; flex-direction: column; gap: 16px; }
  .step-num {
    font-size: 11px; font-weight: 700;
    font-family: var(--mono); color: var(--teal);
    letter-spacing: 0.1em;
  }
  .step-line {
    height: 1px; flex: 1;
    background: linear-gradient(90deg, var(--teal), transparent);
    margin-top: 6px;
  }
  .step-h3 {
    font-size: 20px; font-weight: 600; letter-spacing: -0.03em;
    line-height: 1.3;
  }
  .step-p { font-size: 14px; color: var(--muted); line-height: 1.75; }

  /* ── TARGET ── */
  .target-section { max-width: 1160px; margin: 0 auto; padding: 100px 32px; }
  .target-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
  }
  .target-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px; padding: 28px 24px;
    transition: border-color 0.2s;
  }
  .target-card:hover { border-color: rgba(93,228,199,0.2); }
  .target-role {
    font-size: 11px; font-weight: 700; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--teal); margin-bottom: 14px;
  }
  .target-pain {
    font-size: 14px; color: rgba(255,255,255,0.3);
    line-height: 1.7; margin-bottom: 14px;
    padding-left: 12px; border-left: 2px solid rgba(255,255,255,0.08);
    font-style: italic;
  }
  .target-gain {
    font-size: 14px; color: rgba(255,255,255,0.65); line-height: 1.75;
  }
  .target-gain::before {
    content: '→ '; color: var(--teal);
  }

  /* ── CTA ── */
  .cta-section {
    position: relative; overflow: hidden;
    padding: 120px 32px;
    background: linear-gradient(180deg, transparent 0%, rgba(93,228,199,0.04) 100%);
    border-top: 1px solid rgba(93,228,199,0.1);
    text-align: center;
  }
  .cta-glow {
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 800px; height: 400px;
    background: radial-gradient(ellipse at center, rgba(93,228,199,0.08) 0%, transparent 70%);
    pointer-events: none;
  }
  .cta-h2 {
    font-size: clamp(32px, 5vw, 56px); font-weight: 700;
    letter-spacing: -0.04em; line-height: 1.1;
    margin-bottom: 20px; position: relative;
  }
  .cta-sub {
    font-size: 16px; color: var(--muted);
    margin-bottom: 44px; position: relative;
  }

  /* ── DISCLAIMER + FOOTER ── */
  .disclaimer {
    max-width: 1160px; margin: 0 auto;
    padding: 40px 32px 24px;
    font-size: 11px; color: rgba(255,255,255,0.2);
    line-height: 1.8; text-align: center;
  }
  .footer {
    border-top: 1px solid rgba(255,255,255,0.05);
    padding: 20px 32px; text-align: center;
    font-size: 12px; color: rgba(255,255,255,0.18);
    font-family: var(--mono);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .nav-links { display: none; }
    .bento { grid-template-columns: 1fr; }
    .bc-1, .bc-2, .bc-3, .bc-4, .bc-5, .bc-6 { grid-column: span 1; }
    .mockup-sidebar { display: none; }
    .stat-item { border-right: none; border-bottom: 1px solid rgba(255,255,255,0.05); padding: 16px; }
    .stat-item:last-child { border-bottom: none; }
    .steps-grid { grid-template-columns: 1fr; }
  }
`;

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* NAV */}
      <nav className="nav">
        <div className="nav-inner">
          <a href="#" className="nav-logo">
            VolumeCheck
            <span className="nav-logo-badge">Beta</span>
          </a>
          <ul className="nav-links">
            <li><a href="#features">機能</a></li>
            <li><a href="#steps">使い方</a></li>
            <li><a href="#target">対象</a></li>
          </ul>
          <Link href="/project" className="nav-cta">今すぐ試す →</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="dot-grid" />

        {mounted && (
          <div className="hero-badge">
            <span className="badge-dot" />
            PLATEAU × AMX PMTiles 連携
          </div>
        )}

        <h1 className="hero-h1">
          <span className="gradient">用地検討を、</span>
          <br />
          <span className="gradient">住所ひとつで。</span>
        </h1>

        <p className="hero-sub">
          法規制の自動取得から3D最大ボリューム表示・事業性概算まで、<br />
          デベロッパーの初期検討を数分で完結させるWebツール。
        </p>

        <div className="hero-ctas">
          <Link href="/project" className="btn-primary">無料で試す</Link>
          <a href="#features" className="btn-ghost">機能を見る ↓</a>
        </div>

        {/* APP MOCKUP */}
        {mounted && (
          <div className="mockup-wrap">
            <div className="mockup-glow" />
            <div className="mockup-frame">
              {/* Titlebar */}
              <div className="mockup-titlebar">
                <span className="dot-red" />
                <span className="dot-yellow" />
                <span className="dot-green" />
                <span className="mockup-titlebar-label">VolumeCheck — 渋谷区代々木2丁目</span>
              </div>
              {/* Body */}
              <div className="mockup-body">
                {/* Sidebar */}
                <div className="mockup-sidebar">
                  {[
                    { n:'1', label:'敷地入力', active: false },
                    { n:'2', label:'用途地域', active: false },
                    { n:'3', label:'計算結果', active: true },
                  ].map(s => (
                    <div key={s.n} className={`mockup-stepper-item${s.active ? ' active' : ''}`}>
                      <div className="mockup-stepper-dot">{s.n}</div>
                      {s.label}
                    </div>
                  ))}
                  <div className="mockup-divider" />
                  {/* Address input */}
                  <div className="mockup-input-row">
                    <div className="mockup-input-box">渋谷区代々木2-2...</div>
                  </div>
                  <div className="mockup-badge-success">
                    <span style={{fontSize:10,color:'rgba(34,197,94,0.8)'}}>✓</span>
                    第二種住居地域
                  </div>
                  <div className="mockup-tag-row">
                    <span className="mockup-tag">容積率200%</span>
                    <span className="mockup-tag">建ぺい率60%</span>
                    <span className="mockup-tag">準防火</span>
                  </div>
                  <div className="mockup-divider" />
                  <div style={{padding:'6px 10px',fontSize:10,color:'rgba(255,255,255,0.25)',fontFamily:'var(--mono)'}}>
                    <div style={{color:'rgba(93,228,199,0.6)'}}>最大延床面積</div>
                    <div style={{fontSize:18,fontWeight:700,color:'#e2e8f4',letterSpacing:'-0.03em'}}>842 <span style={{fontSize:11,fontWeight:400}}>㎡</span></div>
                    <div style={{marginTop:4,color:'rgba(255,255,255,0.25)'}}>最大階数: 5F</div>
                  </div>
                </div>

                {/* 3D Viewer */}
                <div className="mockup-viewer">
                  <div className="mockup-viewer-grid" />
                  <div className="mockup-viewer-glow" />

                  {/* Buildings */}
                  <div className="css-building">
                    <div className="bldg bldg-short" style={{marginBottom:0}}>
                      <div className="bldg-top" />
                      <div className="bldg-windows">
                        {[...Array(8)].map((_,i)=>(
                          <div key={i} className={`win${i===3||i===6?' lit2':''}`} />
                        ))}
                      </div>
                    </div>
                    <div className="bldg bldg-tall">
                      <div className="bldg-top" />
                      <div className="bldg-windows">
                        {[...Array(24)].map((_,i)=>(
                          <div key={i} className={`win${i%7===0||i%5===0?' lit':i===3||i===11?' lit2':''}`} />
                        ))}
                      </div>
                    </div>
                    <div className="bldg bldg-mid">
                      <div className="bldg-top" />
                      <div className="bldg-windows">
                        {[...Array(10)].map((_,i)=>(
                          <div key={i} className={`win${i===4?' lit2':i===7?' lit':''}`} />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Slope line annotation */}
                  <div className="slope-line" />
                  <div className="slope-label">道路斜線制限</div>

                  {/* Metrics overlay */}
                  <div className="mockup-metrics">
                    <div className="metric-chip">
                      <div className="metric-chip-label">Max Height</div>
                      <div className="metric-chip-val">16.5m</div>
                    </div>
                    <div className="metric-chip">
                      <div className="metric-chip-label">Floor Area</div>
                      <div className="metric-chip-val">842㎡</div>
                    </div>
                    <div className="metric-chip">
                      <div className="metric-chip-label">FAR</div>
                      <div className="metric-chip-val">198.4%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* STATS */}
      <div className="stats">
        <div className="stats-inner">
          {[
            { num: '3', unit: '秒', label: '住所入力→法規制取得' },
            { num: '5', unit: '種', label: '斜線制限を同時計算' },
            { num: '23', unit: '区', label: 'PLATEAU東京全域対応' },
            { num: '0', unit: '円', label: '完全無料・登録不要' },
          ].map(s => (
            <div key={s.label} className="stat-item">
              <div className="stat-num">{s.num}<span className="stat-unit">{s.unit}</span></div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <section id="features" className="features">
        <p className="section-eyebrow">Features</p>
        <h2 className="section-title">
          <span>初期検討に必要な</span>すべてを<br />
          <span>自動で揃える</span>
        </h2>

        <div className="bento">
          {/* Large: 筆界自動取得 */}
          <div className="bento-card bc-1">
            <div className="bento-icon">🗺️</div>
            <span className="bento-tag">AMX PMTiles</span>
            <h3 className="bento-h3">筆界ポリゴン<br />自動取得</h3>
            <p className="bento-p">
              法務省登記所備付地図（AMX PMTiles）活用。地図をクリックするだけで敷地形状を自動設定。手動入力不要。
            </p>
            <div className="bento-visual">
              <div><span className="kw">parcel</span>.<span className="val">fude</span> <span className="comment">// 筆界ポリゴン</span></div>
              <div><span className="kw">z</span> = <span className="val">15</span>  <span className="comment">// タイルズーム</span></div>
              <div><span className="kw">source</span>: <span className="val">"AMX PMTiles"</span></div>
            </div>
          </div>

          {/* Large: PLATEAU urf */}
          <div className="bento-card bc-2">
            <div className="bento-icon">⚖️</div>
            <span className="bento-tag">PLATEAU urf</span>
            <h3 className="bento-h3">法規制を一括<br />自動取得</h3>
            <p className="bento-p">
              PLATEAU都市計画MVTタイル連携で用途地域・高度地区・地区計画・防火地域を自動取得。上乗せ規制まで見落としゼロ。
            </p>
            <div className="bento-visual" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px 20px'}}>
              {[
                ['用途地域','第二種住居'],['建ぺい率','60%'],
                ['容積率','200%'],['防火地域','準防火'],
                ['高度地区','第三種'],['地区計画','なし'],
              ].map(([k,v])=>(
                <div key={k}>
                  <span className="comment">{k}: </span>
                  <span className="val">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 3D Volume */}
          <div className="bento-card bc-3">
            <div className="bento-icon">🏗️</div>
            <span className="bento-tag">法規制完全対応</span>
            <h3 className="bento-h3">3D最大<br />ボリューム</h3>
            <p className="bento-p">
              道路・隣地・北側斜線 + 絶対高さ制限を考慮した最大形状をリアルタイム3D表示。
            </p>
          </div>

          {/* 事業性 */}
          <div className="bento-card bc-4">
            <div className="bento-icon">📊</div>
            <span className="bento-tag">デベ向け</span>
            <h3 className="bento-h3">事業性<br />概算</h3>
            <p className="bento-p">
              用途を選ぶだけで建設費・利回り・収支を自動計算。
            </p>
          </div>

          {/* PDF */}
          <div className="bento-card bc-5">
            <div className="bento-icon">📄</div>
            <span className="bento-tag">帳票出力</span>
            <h3 className="bento-h3">PDF帳票<br />即出力</h3>
            <p className="bento-p">
              事業検討レポートをPDFで出力。上司・クライアントにそのまま提出。
            </p>
          </div>

          {/* AI - wide */}
          <div className="bento-card bc-6" style={{display:'flex',alignItems:'center',gap:32,flexWrap:'wrap'}}>
            <div style={{flex:'0 0 auto'}}>
              <div className="bento-icon">🤖</div>
            </div>
            <div style={{flex:1,minWidth:200}}>
              <span className="bento-tag">AI連携</span>
              <h3 className="bento-h3">AIクイックアクション</h3>
              <p className="bento-p">「何階建て可能？」「斜線制限は？」のワンクリックで計算結果をGemini AIが解説。複雑な法規制をわかりやすく。</p>
            </div>
            <div className="bento-visual" style={{flex:'0 0 280px',minWidth:200}}>
              <div><span className="comment">Q: </span><span className="val">"何階建て可能？"</span></div>
              <div style={{marginTop:6,color:'rgba(93,228,199,0.6)'}}>→ 容積率200%・道路斜線より</div>
              <div style={{color:'rgba(93,228,199,0.6)'}}>　最大5階建て（16.5m）が可能。</div>
              <div style={{color:'rgba(93,228,199,0.6)'}}>　最大延床842㎡相当です。</div>
            </div>
          </div>
        </div>
      </section>

      {/* STEPS */}
      <section id="steps" className="steps-section">
        <div className="steps-inner">
          <p className="section-eyebrow">How it works</p>
          <h2 className="section-title" style={{textAlign:'center'}}>
            <span>3ステップで</span>検討完了
          </h2>
          <div className="steps-grid">
            {[
              {
                n: '01',
                title: '住所を入力して検索',
                body: 'geocode + 筆界取得 + 法規制取得を並列でバックグラウンド実行。数秒で全データが揃う。',
              },
              {
                n: '02',
                title: '地図で敷地を選択',
                body: '地図上に筆界ポリゴンが表示される。クリックするだけで敷地形状・接道道路が自動設定。',
              },
              {
                n: '03',
                title: 'ボリューム + 事業性を確認',
                body: '最大ボリュームの3D表示と事業性概算が即座に表示。PDF帳票で上司・クライアントに共有。',
              },
            ].map(s => (
              <div key={s.n} className="step-item">
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <span className="step-num">{s.n}</span>
                  <div className="step-line" />
                </div>
                <h3 className="step-h3">{s.title}</h3>
                <p className="step-p">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TARGET */}
      <section id="target" className="target-section">
        <p className="section-eyebrow">For whom</p>
        <h2 className="section-title">
          <span>初期検討の時間を</span><br />
          <span>劇的に短縮する</span>
        </h2>
        <div className="target-grid">
          {[
            {
              role: '不動産デベロッパー',
              pain: '用地取得前の初期検討で法規制調査に何時間もかかる',
              gain: '住所を入れて数分で最大ボリューム・事業性を把握。稟議資料を即日作成。',
            },
            {
              role: '設計事務所',
              pain: '斜線制限の計算ミスや地区計画の見落としがリスク',
              gain: 'PLATEAUデータで上乗せ規制まで自動取得。計算ミスゼロ。3Dで視覚確認。',
            },
            {
              role: '不動産仲介・コンサル',
              pain: '概算説明に時間がかかり、専門家補助が必要',
              gain: 'その場で試算しPDFを出力。建設費・利回り込みの提案資料を即提示。',
            },
          ].map(t => (
            <div key={t.role} className="target-card">
              <div className="target-role">{t.role}</div>
              <p className="target-pain">"{t.pain}"</p>
              <p className="target-gain">{t.gain}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="cta-glow" />
        <h2 className="cta-h2">今すぐ試してみる</h2>
        <p className="cta-sub">無料・登録不要。住所を入れるだけで試せます。</p>
        <Link href="/project" className="btn-primary" style={{fontSize:16,padding:'16px 48px'}}>
          VolumeCheck を開く →
        </Link>
      </section>

      {/* DISCLAIMER */}
      <p className="disclaimer">
        本ツールは建築ボリュームの概算ツールであり、法的確認書類を生成するものではありません。
        実際の建築計画には、所管行政機関への確認および建築士による法適合確認が必要です。
        計算結果は入力データの精度に依存し、特定建築物・地区計画等の個別規制は考慮されていない場合があります。
      </p>

      {/* FOOTER */}
      <footer className="footer">
        © 2026 VolumeCheck — Archi-Prisma Design works
      </footer>
    </>
  );
}
