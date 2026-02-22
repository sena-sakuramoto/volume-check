import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

let client: Client | null = null;

async function getClient(): Promise<Client> {
  if (client) return client;
  client = new Client({ name: 'volume-check', version: '1.0.0' });
  // MLIT MCP endpoint - will need real URL from MLIT once configured
  const transport = new SSEClientTransport(
    new URL(process.env.MLIT_MCP_URL || 'https://www.mlit-data.jp/api/mcp/sse')
  );
  await client.connect(transport);
  return client;
}

export interface MLITZoningResult {
  district: string;
  coverageRatio: number;
  floorAreaRatio: number;
  fireDistrict: string;
  heightLimit: number | null;
  wallSetback: number | null;
}

export async function fetchZoningData(address: string): Promise<MLITZoningResult | null> {
  try {
    const c = await getClient();
    const result = await c.callTool({
      name: 'search_urban_planning',
      arguments: { address, query: `${address}の用途地域、建ぺい率、容積率、防火地域を教えてください` },
    });
    const content = result.content as Array<{ type: string; text: string }> | undefined;
    if (content && content.length > 0) {
      const text = content[0].text;
      return parseZoningResponse(text);
    }
    return null;
  } catch (error) {
    console.error('MLIT MCP error:', error);
    return null;
  }
}

function parseZoningResponse(text: string): MLITZoningResult | null {
  try {
    // Try JSON parse first
    const parsed = JSON.parse(text);
    return parsed;
  } catch {
    // Try to extract from natural language response
    const result: Partial<MLITZoningResult> = {};

    // Extract district
    const districtMatch = text.match(/(第[一二]種(?:低層|中高層)住居専用地域|第[一二]種住居地域|準住居地域|田園住居地域|近隣商業地域|商業地域|準工業地域|工業地域|工業専用地域)/);
    if (districtMatch) result.district = districtMatch[1];

    // Extract coverage ratio
    const coverageMatch = text.match(/建[ぺペ]い率[：:]\s*(\d+)/);
    if (coverageMatch) result.coverageRatio = parseInt(coverageMatch[1]) / 100;

    // Extract floor area ratio
    const farMatch = text.match(/容積率[：:]\s*(\d+)/);
    if (farMatch) result.floorAreaRatio = parseInt(farMatch[1]) / 100;

    // Extract fire district
    const fireMatch = text.match(/(防火地域|準防火地域)/);
    result.fireDistrict = fireMatch ? fireMatch[1] : '指定なし';

    if (result.district && result.coverageRatio && result.floorAreaRatio) {
      return result as MLITZoningResult;
    }
    return null;
  }
}
