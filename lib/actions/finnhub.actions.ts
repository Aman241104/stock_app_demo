'use server';

import { cache } from 'react';
import { headers } from 'next/headers';
import { auth } from '../better-auth/auth';
import {
    getDateRange,
    validateArticle,
    formatArticle,
    formatChangePercent,
    formatMarketCapValue,
    formatPrice
} from '@/lib/utils';
import { POPULAR_STOCK_SYMBOLS } from '@/lib/constants';
import { getWatchlistSymbolsByEmail } from './watchlist.actions';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

const FINNHUB_API_KEY =
    process.env.FINNHUB_API_KEY ??
    process.env.NEXT_PUBLIC_FINNHUB_API_KEY;

if (!FINNHUB_API_KEY) {
    throw new Error('FINNHUB API key is not configured');
}

/* --------------------------------------------------
   Shared fetch helper
-------------------------------------------------- */
async function fetchJSON<T>(
    url: string,
    revalidateSeconds?: number
): Promise<T> {
    const options: RequestInit & { next?: { revalidate?: number } } =
        revalidateSeconds
            ? { cache: 'force-cache', next: { revalidate: revalidateSeconds } }
            : { cache: 'no-store' };

    const res = await fetch(url, options);
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Fetch failed ${res.status}: ${text}`);
    }

    return (await res.json()) as T;
}

export { fetchJSON };



/* --------------------------------------------------
   NEWS (public, cached)
-------------------------------------------------- */
export async function getNews(
    symbols?: string[]
): Promise<MarketNewsArticle[]> {
    try {
        const range = getDateRange(5);
        const cleanSymbols = (symbols || [])
            .map((s) => s?.trim().toUpperCase())
            .filter(Boolean);

        const maxArticles = 6;

        if (cleanSymbols.length > 0) {
            const perSymbol: Record<string, RawNewsArticle[]> = {};

            await Promise.all(
                cleanSymbols.map(async (sym) => {
                    try {
                        const url = `${FINNHUB_BASE_URL}/company-news?symbol=${sym}&from=${range.from}&to=${range.to}&token=${FINNHUB_API_KEY}`;
                        const articles = await fetchJSON<RawNewsArticle[]>(url, 300);
                        perSymbol[sym] = articles.filter(validateArticle);
                    } catch {
                        perSymbol[sym] = [];
                    }
                })
            );

            const collected: MarketNewsArticle[] = [];

            for (let round = 0; round < maxArticles; round++) {
                for (const sym of cleanSymbols) {
                    const article = perSymbol[sym]?.shift();
                    if (!article) continue;
                    collected.push(formatArticle(article, true, sym, round));
                    if (collected.length >= maxArticles) break;
                }
                if (collected.length >= maxArticles) break;
            }

            if (collected.length > 0) {
                collected.sort((a, b) => (b.datetime || 0) - (a.datetime || 0));
                return collected.slice(0, maxArticles);
            }
        }

        const generalUrl = `${FINNHUB_BASE_URL}/news?category=general&token=${FINNHUB_API_KEY}`;
        const general = await fetchJSON<RawNewsArticle[]>(generalUrl, 300);

        return general
            .filter(validateArticle)
            .slice(0, maxArticles)
            .map((a, i) => formatArticle(a, false, undefined, i));
    } catch (err) {
        console.error('getNews error:', err);
        return [];
    }
}



/* --------------------------------------------------
   STOCK SEARCH (PUBLIC, cached, no auth)
-------------------------------------------------- */
export const searchStocksPublic = cache(
    async (query?: string): Promise<StockWithWatchlistStatus[]> => {
        try {
            const trimmed = query?.trim() ?? '';
            let results: FinnhubSearchResult[] = [];

            if (!trimmed) {
                const top = POPULAR_STOCK_SYMBOLS.slice(0, 10);
                const profiles = await Promise.all(
                    top.map(async (sym) => {
                        try {
                            const url = `${FINNHUB_BASE_URL}/stock/profile2?symbol=${sym}&token=${FINNHUB_API_KEY}`;
                            const profile = await fetchJSON<any>(url, 3600);
                            return { sym, profile };
                        } catch {
                            return null;
                        }
                    })
                );

                results = profiles
                    .filter(Boolean)
                    .map(({ sym, profile }: any) => ({
                        symbol: sym,
                        description: profile?.name ?? sym,
                        displaySymbol: sym,
                        type: 'Stock',
                    }));
            } else {
                const url = `${FINNHUB_BASE_URL}/search?q=${trimmed}&token=${FINNHUB_API_KEY}`;
                const data = await fetchJSON<FinnhubSearchResponse>(url, 1800);
                results = data?.result ?? [];
            }

            return results.slice(0, 15).map((r) => ({
                symbol: r.symbol.toUpperCase(),
                name: r.description || r.symbol,
                exchange: 'US',
                type: r.type || 'Stock',
                isInWatchlist: false,
            }));
        } catch (err) {
            console.error('searchStocksPublic error:', err);
            return [];
        }
    }
);



/* --------------------------------------------------
   STOCK SEARCH (USER, auth, NO cache)
-------------------------------------------------- */
export async function searchStocksUser(
    query?: string
): Promise<StockWithWatchlistStatus[]> {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.user) return [];

        const watchlistSymbols = await getWatchlistSymbolsByEmail(
            session.user.email
        );

        const publicResults = await searchStocksPublic(query);

        return publicResults.map((item) => ({
            ...item,
            isInWatchlist: watchlistSymbols.includes(item.symbol),
        }));
    } catch (err) {
        console.error('searchStocksUser error:', err);
        return [];
    }
}



/* --------------------------------------------------
   STOCK DETAILS (public, cached, nullable)
-------------------------------------------------- */
export const getStocksDetails = cache(
    async (symbol: string): Promise<{
        symbol: string;
        company: string;
        currentPrice: number;
        changePercent: number;
        priceFormatted: string;
        changeFormatted: string;
        marketCapFormatted: string;
        peRatio: number | null;
    } | null> => {
        const cleanSymbol = symbol.trim().toUpperCase();

        try {
            const [quote, profile, financials] = await Promise.all([
                fetchJSON<QuoteData>(
                    `${FINNHUB_BASE_URL}/quote?symbol=${cleanSymbol}&token=${FINNHUB_API_KEY}`
                ),
                fetchJSON<ProfileData>(
                    `${FINNHUB_BASE_URL}/stock/profile2?symbol=${cleanSymbol}&token=${FINNHUB_API_KEY}`,
                    3600
                ),
                fetchJSON<FinancialsData>(
                    `${FINNHUB_BASE_URL}/stock/metric?symbol=${cleanSymbol}&metric=all&token=${FINNHUB_API_KEY}`,
                    1800
                ),
            ]);

            if (!quote?.c || !profile?.name) return null;

            return {
                symbol: cleanSymbol,
                company: profile.name,
                currentPrice: quote.c,
                changePercent: quote.dp ?? 0,
                priceFormatted: formatPrice(quote.c),
                changeFormatted: formatChangePercent(quote.dp ?? 0),
                marketCapFormatted: formatMarketCapValue(
                    profile.marketCapitalization ?? 0
                ),
                peRatio:
                    financials?.metric?.peNormalizedAnnual ?? null,
            };
        } catch (err) {
            console.error(`getStocksDetails error (${cleanSymbol}):`, err);
            return null;
        }
    }
);
