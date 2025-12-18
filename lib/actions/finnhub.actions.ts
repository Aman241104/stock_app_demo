'use server';

/* ==================================================
   Imports
================================================== */

import { cache } from 'react';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '../better-auth/auth';
import Watchlist from '@/database/models/watchlist.model';

import {
    getDateRange,
    validateArticle,
    formatArticle,
} from '@/lib/utils';

import { POPULAR_STOCK_SYMBOLS } from '@/lib/constants';

/* ==================================================
   Constants
================================================== */

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
const FINNHUB_API_KEY =
    process.env.FINNHUB_API_KEY ??
    process.env.NEXT_PUBLIC_FINNHUB_API_KEY;

/* ==================================================
   Helpers (NO redirects here)
================================================== */

const getUser = async () => {
    const session = await auth.api.getSession({
        headers: await headers(),
    });
    return session?.user ?? null;
};

const normalizeSymbol = (symbol: string) =>
    symbol.trim().toUpperCase();

/* ==================================================
   WATCHLIST ACTIONS
================================================== */

export const addToWatchlist = async (symbol: string, company: string) => {
    const user = await getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const normalizedSymbol = normalizeSymbol(symbol);

    const exists = await Watchlist.findOne({
        email: user.email,
        symbol: normalizedSymbol,
    });

    if (exists) {
        return { success: false, error: 'Stock already in watchlist' };
    }

    await Watchlist.create({
        email: user.email,
        symbol: normalizedSymbol,
        company: company.trim(),
    });

    revalidatePath('/watchlist');
    return { success: true };
};

export const removeFromWatchlist = async (symbol: string) => {
    const user = await getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    await Watchlist.deleteOne({
        email: user.email,
        symbol: normalizeSymbol(symbol),
    });

    revalidatePath('/watchlist');
    return { success: true };
};

export const getUserWatchlist = async () => {
    const user = await getUser();
    if (!user) return null;

    return Watchlist.find({ email: user.email })
        .sort({ addedAt: -1 })
        .lean();
};

export const getWatchlistSymbolsByEmail = async (
    email: string
): Promise<string[]> => {
    const watchlist = await Watchlist.find(
        { email },
        { symbol: 1, _id: 0 }
    ).lean();

    return watchlist.map((item) => item.symbol);
};

export const getWatchlistWithData = async () => {
    const user = await getUser();
    if (!user) return null;

    const watchlist = await Watchlist.find({ email: user.email })
        .sort({ addedAt: -1 })
        .lean();

    if (watchlist.length === 0) return [];

    return Promise.all(
        watchlist.map(async (item) => {
            const stock = await getStocksDetails(item.symbol);

            return {
                symbol: item.symbol,
                company: stock?.company ?? item.company,
                priceFormatted: stock?.priceFormatted ?? '—',
                changeFormatted: stock?.changeFormatted ?? '—',
                changePercent: stock?.changePercent ?? null,
                marketCap: stock?.marketCapFormatted ?? '—',
                peRatio: stock?.peRatio ?? null,
            };
        })
    );
};

/* ==================================================
   STOCK DETAILS
================================================== */

export const getStocksDetails = async (symbol: string) => {
    if (!FINNHUB_API_KEY) return null;

    const cleanSymbol = normalizeSymbol(symbol);

    try {
        const [quoteRes, profileRes, metricsRes] = await Promise.all([
            fetch(`${FINNHUB_BASE_URL}/quote?symbol=${cleanSymbol}&token=${FINNHUB_API_KEY}`),
            fetch(`${FINNHUB_BASE_URL}/stock/profile2?symbol=${cleanSymbol}&token=${FINNHUB_API_KEY}`),
            fetch(`${FINNHUB_BASE_URL}/stock/metric?symbol=${cleanSymbol}&metric=all&token=${FINNHUB_API_KEY}`),
        ]);

        const quote = await quoteRes.json();
        const profile = await profileRes.json();
        const metrics = await metricsRes.json();

        if (!quote?.c || !profile?.name) return null;

        return {
            symbol: cleanSymbol,
            company: profile.name,
            currentPrice: quote.c,
            priceFormatted: `$${quote.c.toFixed(2)}`,
            changeFormatted: `${quote.dp?.toFixed(2)}%`,
            changePercent: quote.dp ?? null,
            marketCapFormatted: profile.marketCapitalization
                ? `$${profile.marketCapitalization}B`
                : '—',
            peRatio: metrics?.metric?.peNormalizedAnnual ?? null,
        };
    } catch (err) {
        console.error('getStocksDetails error:', err);
        return null;
    }
};

/* ==================================================
   MARKET NEWS
================================================== */

export const getNews = cache(
    async (symbols?: string[]): Promise<MarketNewsArticle[]> => {
        if (!FINNHUB_API_KEY) return [];

        try {
            const range = getDateRange(5);
            const maxArticles = 6;
            const cleanSymbols = symbols?.map(normalizeSymbol) ?? [];

            if (cleanSymbols.length > 0) {
                const collected: MarketNewsArticle[] = [];

                for (const symbol of cleanSymbols) {
                    if (collected.length >= maxArticles) break;

                    const res = await fetch(
                        `${FINNHUB_BASE_URL}/company-news?symbol=${symbol}&from=${range.from}&to=${range.to}&token=${FINNHUB_API_KEY}`
                    );
                    const articles = await res.json();

                    for (const article of articles ?? []) {
                        if (!validateArticle(article)) continue;
                        collected.push(formatArticle(article, true, symbol));
                        if (collected.length >= maxArticles) break;
                    }
                }

                if (collected.length > 0) return collected;
            }

            const generalRes = await fetch(
                `${FINNHUB_BASE_URL}/news?category=general&token=${FINNHUB_API_KEY}`
            );
            const general = await generalRes.json();

            return (general ?? [])
                .filter(validateArticle)
                .slice(0, maxArticles)
                .map((a: any) => formatArticle(a, false));
        } catch (err) {
            console.error('getNews error:', err);
            return [];
        }
    }
);

/* ==================================================
   PUBLIC STOCK SEARCH (NO AUTH)
================================================== */

export const searchStocksPublic = cache(
    async (query?: string): Promise<StockWithWatchlistStatus[]> => {
        if (!FINNHUB_API_KEY) return [];

        try {
            const trimmed = query?.trim() ?? '';
            let results: FinnhubSearchResult[] = [];

            if (!trimmed) {
                const top = POPULAR_STOCK_SYMBOLS.slice(0, 10);

                const profiles = await Promise.all(
                    top.map(async (symbol) => {
                        const res = await fetch(
                            `${FINNHUB_BASE_URL}/stock/profile2?symbol=${symbol}&token=${FINNHUB_API_KEY}`,
                            { next: { revalidate: 3600 } }
                        );
                        const data = await res.json();
                        if (!data?.name) return null;

                        return {
                            symbol,
                            description: data.name,
                            displaySymbol: symbol,
                            type: 'Stock',
                        };
                    })
                );

                results = profiles.filter(Boolean) as FinnhubSearchResult[];
            } else {
                const res = await fetch(
                    `${FINNHUB_BASE_URL}/search?q=${encodeURIComponent(trimmed)}&token=${FINNHUB_API_KEY}`,
                    { next: { revalidate: 1800 } }
                );
                const data = await res.json();
                results = Array.isArray(data?.result) ? data.result : [];
            }

            return results.slice(0, 15).map((r) => ({
                symbol: r.symbol.toUpperCase(),
                name: r.description || r.symbol,
                exchange: r.displaySymbol || 'US',
                type: r.type || 'Stock',
                isInWatchlist: false,
            }));
        } catch (err) {
            console.error('searchStocksPublic error:', err);
            return [];
        }
    }
);


/* ==================================================
   USER STOCK SEARCH (WITH WATCHLIST STATE)
================================================== */

export const searchStocksUser = cache(
    async (query?: string): Promise<StockWithWatchlistStatus[]> => {
        const user = await getUser();
        if (!user) return [];

        const watchlistSymbols = await getWatchlistSymbolsByEmail(user.email);
        const publicResults = await searchStocksPublic(query);

        return publicResults.map((stock) => ({
            ...stock,
            isInWatchlist: watchlistSymbols.includes(stock.symbol),
        }));
    }
);
