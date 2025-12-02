export async function fetcher<T>(url: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(url, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            ...options.headers,
        },
        ...options,
    });

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Fetch error: ${res.status} - ${errorText}`);
    }

    return res.json() as Promise<T>;
}