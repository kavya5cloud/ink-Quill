function parseTextBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer | string) => {
      data += chunk.toString();
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export async function readJsonBody<T extends Record<string, any>>(req: any): Promise<T> {
  if (req.body && typeof req.body === 'object') {
    return req.body as T;
  }

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as T;
    } catch {
      return {} as T;
    }
  }

  const raw = await parseTextBody(req);
  if (!raw) return {} as T;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return {} as T;
  }
}
