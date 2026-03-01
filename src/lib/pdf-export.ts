import type { ZoningData, VolumeResult } from '@/engine/types';

/**
 * ボリュームチェック概算結果をPDF印刷用のHTMLとして新しいウィンドウに表示し、
 * 印刷ダイアログを開く。
 */
export function generatePdfReport(
  zoning: ZoningData,
  result: VolumeResult,
  siteArea: number,
  floorHeights: number[],
  roads: { direction: string; width: number }[]
): void {
  const now = new Date();
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;

  // 階別面積表の行を生成
  let cumulativeHeight = 0;
  const floorRows = floorHeights
    .map((h, i) => {
      cumulativeHeight += h;
      return `
        <tr>
          <td>${i + 1}階</td>
          <td>${h.toFixed(2)} m</td>
          <td>${cumulativeHeight.toFixed(2)} m</td>
        </tr>`;
    })
    .join('');

  // 道路情報の行を生成
  const roadRows = roads
    .map(
      (r) => `
        <tr>
          <td>${r.direction}</td>
          <td>${r.width.toFixed(1)} m</td>
        </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>ボリュームチェック概算結果</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 20mm;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Yu Gothic UI",
        "Meiryo", sans-serif;
      font-size: 10pt;
      line-height: 1.6;
      color: #1a1a1a;
      background: #fff;
      padding: 15mm 20mm;
    }

    h1 {
      font-size: 16pt;
      text-align: center;
      margin-bottom: 4px;
      letter-spacing: 0.1em;
      border-bottom: 2px solid #1a1a1a;
      padding-bottom: 8px;
    }

    .date {
      text-align: right;
      font-size: 9pt;
      color: #555;
      margin-bottom: 20px;
    }

    .section {
      margin-bottom: 18px;
      page-break-inside: avoid;
    }

    .section-title {
      font-size: 12pt;
      font-weight: bold;
      background: #f0f0f0;
      padding: 4px 8px;
      margin-bottom: 8px;
      border-left: 4px solid #333;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 4px;
    }

    th, td {
      border: 1px solid #ccc;
      padding: 5px 10px;
      text-align: left;
      font-size: 9.5pt;
    }

    th {
      background: #fafafa;
      font-weight: 600;
      width: 40%;
    }

    td {
      width: 60%;
    }

    .floor-table th,
    .floor-table td {
      text-align: center;
      width: auto;
    }

    .floor-table th:first-child,
    .floor-table td:first-child {
      width: 30%;
    }

    .road-table th,
    .road-table td {
      text-align: center;
      width: auto;
    }

    .footer {
      margin-top: 24px;
      padding-top: 8px;
      border-top: 1px solid #ccc;
      font-size: 8pt;
      color: #888;
      text-align: center;
    }

    @media print {
      body {
        padding: 0;
      }

      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>
  <h1>ボリュームチェック概算結果</h1>
  <p class="date">作成日: ${dateStr}</p>

  <!-- Section 1: 敷地概要 -->
  <div class="section">
    <div class="section-title">1. 敷地概要</div>
    <table>
      <tr>
        <th>敷地面積</th>
        <td>${siteArea.toFixed(2)} m²</td>
      </tr>
    </table>
    ${
      roads.length > 0
        ? `
    <table class="road-table" style="margin-top: 6px;">
      <thead>
        <tr>
          <th>接道方向</th>
          <th>道路幅員</th>
        </tr>
      </thead>
      <tbody>
        ${roadRows}
      </tbody>
    </table>`
        : ''
    }
  </div>

  <!-- Section 2: 法規制 -->
  <div class="section">
    <div class="section-title">2. 法規制</div>
    <table>
      <tr>
        <th>用途地域</th>
        <td>${zoning.district}</td>
      </tr>
      <tr>
        <th>建蔽率</th>
        <td>${(zoning.coverageRatio * 100).toFixed(0)}%</td>
      </tr>
      <tr>
        <th>容積率</th>
        <td>${(zoning.floorAreaRatio * 100).toFixed(0)}%</td>
      </tr>
      <tr>
        <th>防火地域</th>
        <td>${zoning.fireDistrict ?? '指定なし'}</td>
      </tr>
      <tr>
        <th>絶対高さ制限</th>
        <td>${zoning.absoluteHeightLimit != null ? zoning.absoluteHeightLimit + ' m' : '制限なし'}</td>
      </tr>
      <tr>
        <th>壁面後退</th>
        <td>${zoning.wallSetback != null ? zoning.wallSetback + ' m' : '指定なし'}</td>
      </tr>
      <tr>
        <th>高度地区</th>
        <td>${zoning.heightDistrict?.type ?? '指定なし'}</td>
      </tr>
    </table>
  </div>

  <!-- Section 3: 計算結果 -->
  <div class="section">
    <div class="section-title">3. 計算結果</div>
    <table>
      <tr>
        <th>最大延床面積</th>
        <td>${result.maxFloorArea.toFixed(2)} m²</td>
      </tr>
      <tr>
        <th>最大建築面積</th>
        <td>${result.maxCoverageArea.toFixed(2)} m²</td>
      </tr>
      <tr>
        <th>最大高さ</th>
        <td>${result.maxHeight.toFixed(2)} m</td>
      </tr>
      <tr>
        <th>最大階数</th>
        <td>${result.maxFloors}階</td>
      </tr>
    </table>
  </div>

  <!-- Section 4: 階別面積表 -->
  ${
    floorHeights.length > 0
      ? `
  <div class="section">
    <div class="section-title">4. 階別面積表</div>
    <table class="floor-table">
      <thead>
        <tr>
          <th>階</th>
          <th>階高</th>
          <th>累積高さ</th>
        </tr>
      </thead>
      <tbody>
        ${floorRows}
      </tbody>
    </table>
  </div>`
      : ''
  }

  <div class="footer">
    本資料はボリュームチェックの概算結果であり、正式な建築確認申請の根拠とはなりません。
  </div>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    console.warn('ポップアップがブロックされました。ブラウザの設定を確認してください。');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  // コンテンツが読み込まれた後に印刷ダイアログを開く
  printWindow.addEventListener('load', () => {
    printWindow.print();
  });
}
