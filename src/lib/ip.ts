export const getUserIP = async (): Promise<string> => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    if (!response.ok) {
      return 'unknown';
    }
    const data = (await response.json()) as { ip?: string };
    return data.ip || 'unknown';
  } catch {
    return 'unknown';
  }
};
