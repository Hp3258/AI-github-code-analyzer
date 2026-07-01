import * as dotenv from 'dotenv'
dotenv.config()

import axios from 'axios'

export async function callMCPTool<T = any>(
  serverUrl: string,
  toolName: string,
  args: Record<string, any>
): Promise<T> {
  try {
    const response = await axios.post(`${serverUrl}/tools/call`, {
      name: toolName,
      arguments: args
    })

    const textContent = response.data.content?.[0]?.text

    if (!textContent) {
      throw new Error('MCP server returned no content')
    }

    return JSON.parse(textContent) as T

  } catch (err: any) {
    console.error(`MCP call failed: ${serverUrl}/${toolName}`, err.message)
    throw new Error(`Failed to call ${toolName}: ${err.message}`)
  }
}