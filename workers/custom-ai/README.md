# Custom Alibaba AI proxy

Supports `GET /v1/models` as well as `POST /v1/chat/completions`. Dashboard endpoint normalization automatically maps the exact Alibaba base/chat URL to this proxy, and migrates saved Custom settings when the dashboard is opened. OpenRouter/Puter are unchanged. If Alibaba does not support model listing for this subscription, enter the model ID manually; upstream errors are returned with CORS headers.

Endpoint: `https://trendy-custom-ai.trendy-tools-ai.workers.dev/v1/chat/completions`

Select **Custom** in Trendy Tools AI settings and use this endpoint with your own Alibaba API key and model ID. The key remains browser-configured; this Worker forwards it only to the fixed Alibaba endpoint. OpenRouter and Puter remain direct and consume no Worker requests. Other custom URLs remain direct unless the user selects this proxy URL.

The Worker accepts only POST/OPTIONS on the documented path from the Trendy Tools origin. It forwards streamed response bodies without buffering, preserves upstream HTTP failures and Retry-After, refuses redirects and limits request bodies to 1 MiB. It has no stored provider credential, console logging, cache or application time cap. Worker observability is disabled. CORS is a browser boundary, not authentication: non-browser clients can forge Origin, but must supply their own upstream key. Cloudflare infrastructure still processes requests and platform limits still apply.

Only the allowlisted Alibaba endpoint is supported; this is not an arbitrary destination proxy. Deploy with `npx wrangler deploy` from this directory under the intended account, or upload the module through the Cloudflare API. No Trendy Tools tool build changes are required. AI traffic using this URL now traverses Cloudflare; other processing remains browser-local.
