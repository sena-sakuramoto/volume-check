import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

let client: Client | null = null;

async function getClient(): Promise<Client> {
  if (client) return client;
  client = new Client({ name: 'volume-check-plateau', version: '1.0.0' });
  const transport = new SSEClientTransport(
    new URL(process.env.PLATEAU_MCP_URL || 'https://api.plateauview.mlit.go.jp/mcp/sse')
  );
  await client.connect(transport);
  return client;
}

export interface PlateauBuilding {
  id: string;
  vertices: number[];  // flat array [x,y,z, x,y,z, ...]
  indices: number[];
  height: number;
  usage: string;
}

export async function fetchSurroundingBuildings(
  latitude: number,
  longitude: number,
  radius: number = 100, // meters
): Promise<PlateauBuilding[]> {
  try {
    const c = await getClient();
    const result = await c.callTool({
      name: 'search_buildings',
      arguments: { latitude, longitude, radius },
    });
    const content = result.content as Array<{ type: string; text: string }> | undefined;
    if (content && content.length > 0) {
      const text = content[0].text;
      try {
        return JSON.parse(text);
      } catch {
        return [];
      }
    }
    return [];
  } catch (error) {
    console.error('PLATEAU MCP error:', error);
    return [];
  }
}
