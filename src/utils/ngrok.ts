import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

type NgrokTunnel = {
    public_url?: string;
    proto?: string;
};

type NgrokTunnelsResponse = {
    tunnels?: NgrokTunnel[];
};

function requestText(url: string, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const requester = parsed.protocol === 'https:' ? https : http;

        const request = requester.request(
            {
                protocol: parsed.protocol,
                hostname: parsed.hostname,
                port: parsed.port,
                path: `${parsed.pathname}${parsed.search}`,
                method: 'GET',
            },
            (response) => {
                const chunks: Buffer[] = [];
                response.on('data', (chunk: Buffer) => chunks.push(chunk));
                response.on('end', () => {
                    resolve(Buffer.concat(chunks).toString('utf8'));
                });
            }
        );

        request.setTimeout(timeoutMs, () => {
            request.destroy(new Error('Request timed out'));
        });

        request.on('error', reject);
        request.end();
    });
}

export async function getNgrokPublicUrl(
    adminBaseUrl: string = 'http://127.0.0.1:4040',
    timeoutMs: number = 750
): Promise<string | undefined> {
    const base = adminBaseUrl.endsWith('/') ? adminBaseUrl.slice(0, -1) : adminBaseUrl;
    const body = await requestText(`${base}/api/tunnels`, timeoutMs);

    const parsed = JSON.parse(body) as NgrokTunnelsResponse;
    const tunnels = parsed.tunnels || [];

    const httpsTunnel = tunnels.find((t) => t.proto === 'https' && typeof t.public_url === 'string');
    if (httpsTunnel?.public_url) {
        return httpsTunnel.public_url;
    }

    const anyTunnel = tunnels.find((t) => typeof t.public_url === 'string');
    return anyTunnel?.public_url;
}

