# SmartChart for agents (MCP)

1. In SmartChart, open the account menu → **Connect an agent** → **Make a key**. Copy the command.
2. Run it:

   claude mcp add --transport http smartchart https://<host>/mcp/v1 --header "Authorization: Bearer <key>"

3. In Claude Code: "What decks do I have in SmartChart?" Open the editor link it gives you and keep it beside the chat; changes appear within seconds.

Other MCP clients: Streamable HTTP at `https://<host>/mcp/v1`, header `Authorization: Bearer <key>`, and `X-Client: <your agent's name>` so the deck's chat says who changed what.

REST: `POST https://<host>/api/v1/<tool>` with the tool's input as JSON and the same header. Tools and inputs: `tools/list` over MCP.

Replace or remove the key from the same menu; the old key stops working at once.
