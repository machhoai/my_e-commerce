// Minimal test route: just check if ai SDK loads
export const runtime = 'nodejs';

export async function GET() {
    try {
        const { streamText } = await import('ai');
        const { google } = await import('@ai-sdk/google');
        return Response.json({ 
            ok: true, 
            streamText: typeof streamText,
            google: typeof google,
        });
    } catch (err) {
        return Response.json({ 
            ok: false, 
            error: String(err),
            stack: err instanceof Error ? err.stack : undefined
        }, { status: 500 });
    }
}
