import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { path } = req.query;
  const method = req.method || 'GET';
  
  const tenantId = process.env.VITE_MSAL_TENANT_ID;
  const clientId = process.env.VITE_MSAL_CLIENT_ID;
  const clientSecret = process.env.VITE_MSAL_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    return res.status(500).json({ error: 'Credenciais não configuradas no ambiente do servidor.' });
  }

  try {
    // 1. Obter Token da Microsoft (sempre necessário para as chamadas subsequentes)
    const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://analysis.windows.net/powerbi/api/.default'
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      return res.status(tokenResponse.status).json({ error: 'Erro ao obter token da Microsoft', details: tokenData });
    }

    const accessToken = tokenData.access_token;

    // Se o path for 'token', retornamos apenas o access token (opcional, mas útil para manter compatibilidade)
    if (path === 'get-access-token') {
      return res.status(200).json({ access_token: accessToken });
    }

    // 2. Proxy para a API do Power BI
    const powerBiPath = Array.isArray(path) ? path.join('/') : (path as string);
    const url = `https://api.powerbi.com/${powerBiPath}`;
    
    const pbiResponse = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: method !== 'GET' ? JSON.stringify(req.body) : undefined
    });

    const pbiData = await pbiResponse.json().catch(() => ({}));
    return res.status(pbiResponse.status).json(pbiData);

  } catch (error: any) {
    console.error('Erro no Proxy Power BI:', error);
    return res.status(500).json({ error: 'Erro interno no servidor', message: error.message });
  }
}
