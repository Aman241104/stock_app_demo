'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { auth } from '../better-auth/auth';
import Watchlist from '@/database/models/watchlist.model';
import { getStocksDetails } from '@/lib/actions/finnhub.actions';

/* --------------------------------------------------
   Helpers (NO redirect here)
-------------------------------------------------- */

const getUser = async () => {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    return session?.user ?? null;
};

const normalizeSymbol = (symbol: string) =>
    symbol.trim().toUpperCase();

/* --------------------------------------------------
   Add stock to watchlist
-------------------------------------------------- */

export const addToWatchlist = async (symbol: string, company: string) => {
    const user = await getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const normalizedSymbol = normalizeSymbol(symbol);

    const exists = await Watchlist.findOne({
        userId: user.id,
        symbol: normalizedSymbol,
    });

    if (exists) {
        return { success: false, error: 'Stock already in watchlist' };
    }

    await Watchlist.create({
        userId: user.id,
        symbol: normalizedSymbol,
        company: company.trim(),
    });

    revalidatePath('/watchlist');
    return { success: true };
};

/* --------------------------------------------------
   Remove stock from watchlist
-------------------------------------------------- */

export const removeFromWatchlist = async (symbol: string) => {
    const user = await getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const normalizedSymbol = normalizeSymbol(symbol);

    await Watchlist.deleteOne({
        userId: user.id,
        symbol: normalizedSymbol,
    });

    revalidatePath('/watchlist');
    return { success: true };
};

/* --------------------------------------------------
   Get user's watchlist (raw)
-------------------------------------------------- */

export const getUserWatchlist = async () => {
    const user = await getUser();
    if (!user) return null;

    return Watchlist.find({ userId: user.id })
        .sort({ addedAt: -1 })
        .lean();
};

/* --------------------------------------------------
   Get watchlist with live stock data
-------------------------------------------------- */

export const getWatchlistWithData = async () => {
    const user = await getUser();
    if (!user) return null;

    const watchlist = await Watchlist.find({ userId: user.id })
        .sort({ addedAt: -1 })
        .lean();

    if (watchlist.length === 0) return [];

    return Promise.all(
        watchlist.map(async (item) => {
            const stockData = await getStocksDetails(item.symbol);

            return {
                symbol: item.symbol,
                company: stockData?.company ?? item.company,
                priceFormatted: stockData?.priceFormatted ?? '—',
                changeFormatted: stockData?.changeFormatted ?? '—',
                changePercent: stockData?.changePercent ?? null,
                marketCap: stockData?.marketCapFormatted ?? '—',
                peRatio: stockData?.peRatio ?? null,
            };
        })
    );
};

/* --------------------------------------------------
   Get only symbols from user's watchlist
-------------------------------------------------- */

export const getWatchlistSymbolsByUserId = async (
    userId: string
): Promise<string[]> => {
    const watchlist = await Watchlist.find(
        { userId },
        { symbol: 1, _id: 0 }
    ).lean();

    return watchlist.map((item) => item.symbol);
};
